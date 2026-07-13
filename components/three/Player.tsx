'use client'
import { useKeyboardControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CapsuleCollider, type RapierRigidBody } from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import { Group, Vector3 } from 'three'
import { dirFromKeys, type KeyState } from '@/lib/movement'
import { MOVES } from '@/lib/battle/moves'
import { useBattle } from '@/stores/useBattle'
import { battleWorld, PLAYER_SPAWN } from '@/stores/battleWorld'
import { hitEnemy } from './combat'
import PokemonModel from './PokemonModel'

const SPEED = 6
const DASH_MULT = 3
const LUNGE_MS = 150
const camTarget = new Vector3()
const toEnemy = new Vector3()
const facingV = new Vector3()
const aimDir = new Vector3()
const hitPos = new Vector3()

export type BattleKeys = KeyState & { attack1: boolean; attack2: boolean; dash: boolean }

export default function Player({ dexId }: { dexId: number }) {
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<Group>(null)
  const [sub, getKeys] = useKeyboardControls<keyof BattleKeys>()
  // 邊緣觸發輸入佇列：keydown 當下記錄，useFrame 消耗（避免短按落在幀間被漏掉）
  const wants = useRef({ attack1: false, attack2: false, dash: false })
  useEffect(() => {
    const u1 = sub((s) => s.attack1, (v) => { if (v) wants.current.attack1 = true })
    const u2 = sub((s) => s.attack2, (v) => { if (v) wants.current.attack2 = true })
    const u3 = sub((s) => s.dash, (v) => { if (v) wants.current.dash = true })
    return () => { u1(); u2(); u3() }
  }, [sub])
  const lungeUntil = useRef(0)
  const knockUntil = useRef(0)
  const knockVel = useRef(new Vector3())
  const koT = useRef(0)
  const resetNonce = useBattle((s) => s.resetNonce)

  // 再戰：重置位置與姿態
  useEffect(() => {
    if (!body.current) return
    body.current.setTranslation({ x: PLAYER_SPAWN[0], y: PLAYER_SPAWN[1], z: PLAYER_SPAWN[2] }, true)
    body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
    koT.current = 0
    if (visual.current) {
      visual.current.rotation.set(0, 0, 0)
      visual.current.scale.set(1, 1, 1)
      visual.current.position.y = 0
    }
  }, [resetNonce])

  useFrame(({ camera }, dt) => {
    if (!body.current || !visual.current) return
    const st = useBattle.getState()
    const now = performance.now()
    const keys = getKeys() as BattleKeys
    const p = body.current.translation()
    battleWorld.playerPos.set(p.x, p.y, p.z)

    // KO：倒下 + 下沉
    if (st.phase === 'defeat') {
      body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
      koT.current = Math.min(1, koT.current + dt / 1.1)
      const k = koT.current
      visual.current.rotation.z = k * (Math.PI / 2) * 0.92
      visual.current.position.y = -k * 0.55
    } else if (st.phase === 'fighting') {
      const [mx, mz] = dirFromKeys(keys)
      const moving = mx !== 0 || mz !== 0
      if (moving) battleWorld.playerFacing = Math.atan2(mx, mz)
      const facing = battleWorld.playerFacing
      facingV.set(Math.sin(facing), 0, Math.cos(facing))

      // 技能輸入：邊緣觸發佇列 + 按住持續補位（冷卻在 store 把關）
      const wantA1 = wants.current.attack1 || keys.attack1
      const wantA2 = wants.current.attack2 || keys.attack2
      const wantDash = wants.current.dash || keys.dash
      wants.current.attack1 = false
      wants.current.attack2 = false
      wants.current.dash = false
      if (wantA1 && st.tryFire('quickAttack', now)) {
        // 電光一閃：向面向衝刺 + 弧形斬擊，命中 = 距離內且 ±60° 前方錐角
        lungeUntil.current = now + LUNGE_MS
        st.addFx({
          kind: 'slash',
          pos: [p.x + facingV.x * 1.0, p.y + 0.35, p.z + facingV.z * 1.0],
          color: '#c8f6ff',
          angle: facing,
          scale: 1,
        })
        toEnemy.copy(battleWorld.enemyPos).sub(battleWorld.playerPos)
        const dist = toEnemy.length()
        toEnemy.setY(0).normalize()
        const range = (MOVES.quickAttack.range ?? 2.2) + 0.8
        if (dist <= range && facingV.dot(toEnemy) > 0.5) {
          hitPos.copy(battleWorld.enemyPos)
          hitEnemy(MOVES.quickAttack, hitPos)
          st.addFx({ kind: 'burst', pos: [hitPos.x, hitPos.y + 0.4, hitPos.z], color: '#e8fbff', angle: 0, scale: 0.8 })
        }
      }
      if (wantA2 && st.tryFire('thunderbolt', now)) {
        // 十萬伏特：自動瞄準敵人方向的電球
        aimDir.copy(battleWorld.enemyPos).sub(battleWorld.playerPos).normalize()
        battleWorld.playerFacing = Math.atan2(aimDir.x, aimDir.z)
        st.spawnProjectile({
          moveId: 'thunderbolt',
          owner: 'player',
          origin: [p.x + aimDir.x * 0.7, p.y + 0.5, p.z + aimDir.z * 0.7],
          dir: [aimDir.x, aimDir.y, aimDir.z],
        })
      }
      if (wantDash) st.tryDash(now)

      // 速度決策：擊退 > 衝刺/突進 > 一般移動
      const dashing = now < st.dashingUntil
      if (now < knockUntil.current) {
        body.current.setLinvel({ x: knockVel.current.x, y: 0, z: knockVel.current.z }, true)
      } else if (dashing || now < lungeUntil.current) {
        const spd = dashing ? SPEED * DASH_MULT : 13
        const dir = moving && dashing ? { x: mx, z: mz } : { x: facingV.x, z: facingV.z }
        body.current.setLinvel({ x: dir.x * spd, y: body.current.linvel().y, z: dir.z * spd }, true)
      } else {
        const vel = body.current.linvel()
        body.current.setLinvel({ x: mx * SPEED, y: vel.y, z: mz * SPEED }, true)
      }

      // 擊退觸發（由敵方寫入）
      if (battleWorld.playerKnock.lengthSq() > 0) {
        knockVel.current.copy(battleWorld.playerKnock)
        battleWorld.playerKnock.set(0, 0, 0)
        knockUntil.current = now + 130
      }

      // 面向 + 衝刺拉伸殘影感
      visual.current.rotation.y = battleWorld.playerFacing
      const targetSz = dashing ? 1.28 : 1
      const targetSy = dashing ? 0.82 : 1
      visual.current.scale.z += (targetSz - visual.current.scale.z) * Math.min(1, dt * 18)
      visual.current.scale.y += (targetSy - visual.current.scale.y) * Math.min(1, dt * 18)
    } else {
      // victory：停住慶祝（原地小跳由 idleBob 提供）
      body.current.setLinvel({ x: 0, y: body.current.linvel().y, z: 0 }, true)
    }

    // 鏡頭跟隨：更近更低（過肩視角），凸顯主角
    camTarget.set(p.x, p.y + 2.45, p.z + 5.0)
    camera.position.lerp(camTarget, 0.09)
    camera.lookAt(p.x, p.y + 1.05, p.z - 0.6)
    // 受擊微震
    const sinceHit = now - st.lastPlayerHitAt
    if (sinceHit < 220) {
      const a = (1 - sinceHit / 220) * 0.06
      camera.position.x += (Math.random() - 0.5) * a
      camera.position.y += (Math.random() - 0.5) * a
    }
  })

  return (
    <RigidBody ref={body} colliders={false} lockRotations position={PLAYER_SPAWN}>
      <CapsuleCollider args={[0.5, 0.55]} />
      <group ref={visual}>
        <group position={[0, -1.05, 0]}>
          <PokemonModel dexId={dexId} targetHeight={1.9} entity="player" />
        </group>
      </group>
    </RigidBody>
  )
}
