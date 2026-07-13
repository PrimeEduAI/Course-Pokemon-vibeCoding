'use client'
import { useKeyboardControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CapsuleCollider, type RapierRigidBody } from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import { Group, Vector3 } from 'three'
import { dirFromKeys, lerpAngle, lockOnDir, yawBetween, type KeyState } from '@/lib/movement'
import { useLockOnCamera } from './CameraRig'
import { useBattle } from '@/stores/useBattle'
import { useArena } from '@/stores/useArena'
import { useStyleMode } from '@/stores/useStyleMode'
import { battleWorld, PLAYER_SPAWN } from '@/stores/battleWorld'
import { maybeCry, playLaunch, sfxSlash, sfxWhoosh } from '@/lib/sfx'
import { hitEnemy } from './combat'
import { slashVariantForType } from './moveVisuals'
import { ARENAS } from './arenas/types'
import PokemonRenderable from './renderables/PokemonRenderable'

const SPEED = 6
const DASH_MULT = 3
const LUNGE_MS = 150
const toEnemy = new Vector3()
const facingV = new Vector3()
const aimDir = new Vector3()
const hitPos = new Vector3()

export type BattleKeys = KeyState & { attack1: boolean; attack2: boolean; dash: boolean }

export default function Player() {
  const fighter = useBattle((s) => s.playerFighter)
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
  const mode = useStyleMode((s) => s.mode)
  const camera = useLockOnCamera()
  const arenaId = useArena((s) => s.arenaId)
  const arenaGen = ARENAS.find((a) => a.id === arenaId)?.gen

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

  useFrame((rootState, dt) => {
    if (!body.current || !visual.current) return
    const st = useBattle.getState()
    const now = performance.now()
    const keys = getKeys() as BattleKeys
    const p = body.current.translation()
    battleWorld.playerPos.set(p.x, p.y, p.z)
    const motion = battleWorld.playerMotion

    // KO：倒下 + 下沉（模型自帶 down01 片段時交給骨骼動畫，只停住剛體）
    if (st.phase === 'defeat') {
      motion.state = 'ko'
      body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
      if (!motion.hasKoClip) {
        koT.current = Math.min(1, koT.current + dt / 1.1)
        const k = koT.current
        visual.current.rotation.z = k * (Math.PI / 2) * 0.92
        visual.current.position.y = -k * 0.55
      }
    } else if (st.phase === 'fighting') {
      // 鎖定移動：W 朝敵、S 遠離、A/D 繞敵側移（不吃滑鼠，方向永遠以敵人為準）
      const yawE = yawBetween(p.x, p.z, battleWorld.enemyPos.x, battleWorld.enemyPos.z)
      const [mx, mz] = lockOnDir(...dirFromKeys(keys), yawE)
      const moving = mx !== 0 || mz !== 0
      motion.state = moving ? 'move' : 'idle'
      // 鎖定面向：永遠平滑轉向敵人（側移＝繞著對手打，近戰錐角因此恆對準敵人）
      battleWorld.playerFacing = lerpAngle(battleWorld.playerFacing, yawE, Math.min(1, dt * 10))
      const facing = battleWorld.playerFacing
      facingV.set(Math.sin(facing), 0, Math.cos(facing))

      // 技能輸入：邊緣觸發佇列 + 按住持續補位（冷卻在 store 把關）
      const wantA1 = wants.current.attack1 || keys.attack1
      const wantA2 = wants.current.attack2 || keys.attack2
      const wantDash = wants.current.dash || keys.dash
      wants.current.attack1 = false
      wants.current.attack2 = false
      wants.current.dash = false
      const meleeMove = st.playerFighter.moves[0]
      const projMove = st.playerFighter.moves[1]
      if (wantA1 && st.tryFire(0, now)) {
        // 近戰（J）：向面向衝刺 + 弧形斬擊，命中 = 距離內且 ±60° 前方錐角
        lungeUntil.current = now + LUNGE_MS
        motion.attackAt = now
        sfxSlash()
        st.addFx({
          kind: 'slash',
          pos: [p.x + facingV.x * 1.0, p.y + 0.35, p.z + facingV.z * 1.0],
          color: meleeMove.color,
          angle: facing,
          scale: 1,
          variant: slashVariantForType(meleeMove.type),
        })
        toEnemy.copy(battleWorld.enemyPos).sub(battleWorld.playerPos)
        const dist = toEnemy.length()
        toEnemy.setY(0).normalize()
        // 有效距離隨對手體型微幅放大（大型 BOSS 剛體較寬）
        const range = (meleeMove.range ?? 2.2) + st.enemyFighter.targetHeight * 0.3
        if (dist <= range && facingV.dot(toEnemy) > 0.5) {
          hitPos.copy(battleWorld.enemyPos)
          hitEnemy(meleeMove, hitPos)
          st.addFx({ kind: 'burst', pos: [hitPos.x, hitPos.y + 0.4, hitPos.z], color: meleeMove.color, angle: 0, scale: 0.8 })
        }
      }
      if (wantA2 && st.tryFire(1, now)) {
        // 投射（K）：自動瞄準敵人方向
        aimDir.copy(battleWorld.enemyPos).sub(battleWorld.playerPos).normalize()
        battleWorld.playerFacing = Math.atan2(aimDir.x, aimDir.z)
        motion.rangeAttackAt = now
        st.spawnProjectile({
          move: projMove,
          owner: 'player',
          origin: [p.x + aimDir.x * 0.7, p.y + 0.5, p.z + aimDir.z * 0.7],
          dir: [aimDir.x, aimDir.y, aimDir.z],
        })
        playLaunch(projMove.visual)
        maybeCry(st.playerFighter.dexId, 'player-attack')
      }
      if (wantDash && st.tryDash(now)) sfxWhoosh()

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
      // victory：停住慶祝（待機動畫 / idleBob 演出）
      motion.state = 'idle'
      body.current.setLinvel({ x: 0, y: body.current.linvel().y, z: 0 }, true)
    }

    // 鎖定鏡頭：永遠站在「玩家背對敵人」的延長線上，敵我同框；勝負底定後慢速漂移
    camera.update(rootState.camera, dt, st.phase === 'fighting')
    // 受擊微震
    const sinceHit = now - st.lastPlayerHitAt
    if (sinceHit < 220) {
      const a = (1 - sinceHit / 220) * 0.06
      rootState.camera.position.x += (Math.random() - 0.5) * a
      rootState.camera.position.y += (Math.random() - 0.5) * a
    }
  })

  return (
    <RigidBody ref={body} colliders={false} lockRotations position={PLAYER_SPAWN}>
      <CapsuleCollider args={[0.5, 0.55]} />
      <group ref={visual}>
        <group position={[0, -1.05, 0]}>
          <PokemonRenderable dexId={fighter.dexId} mode={mode} facing="back" targetHeight={fighter.targetHeight} arenaGen={arenaGen} entity="player" motion={battleWorld.playerMotion} />
        </group>
      </group>
    </RigidBody>
  )
}
