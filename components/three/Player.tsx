'use client'
import { useGLTF, useKeyboardControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CapsuleCollider, type RapierRigidBody } from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import { Group, Vector3, type PerspectiveCamera } from 'three'
import { dirFromKeys, lerpAngle, lockOnDir, yawBetween, type KeyState } from '@/lib/movement'
import { METER_MAX, resolveGimmick } from '@/lib/battle/gimmicks'
import { isMoveLocked, speedMult } from '@/lib/battle/status'
import { useLockOnCamera } from './CameraRig'
import { useBattle } from '@/stores/useBattle'
import { useArena } from '@/stores/useArena'
import { useStyleMode } from '@/stores/useStyleMode'
import { battleWorld, PLAYER_SPAWN } from '@/stores/battleWorld'
import { maybeCry, playCryFile, playLaunch, sfxGimmickCharge, sfxSlash, sfxThud, sfxWhoosh } from '@/lib/sfx'
import { hitEnemy, MELEE_Y_TOLERANCE } from './combat'
import { slashVariantForType } from './moveVisuals'
import { ARENAS } from './arenas/types'
import { modelUrl } from './PokemonModel'
import PokemonRenderable from './renderables/PokemonRenderable'

const SPEED = 6
const DASH_MULT = 3
const LUNGE_MS = 150
/** 跳躍初速（預設重力 -9.81 → 約 1.6s 滯空）；空中 WASD 控制力 60% */
const JUMP_VY = 7.8
const AIR_CONTROL = 0.6
/** 著地判定：capsule 靜置中心 y ≈ 1.05，低於此高度且 |vy| 小 = 站在地上 */
const GROUNDED_Y = 1.18
const GROUNDED_VY = 0.25
/** 招牌能力發動的鏡頭演出：FOV 拉寬 punch 的長度 */
const FOV_PUNCH_MS = 1100
const BASE_FOV = 50
const toEnemy = new Vector3()
const facingV = new Vector3()
const aimDir = new Vector3()
const hitPos = new Vector3()

export type BattleKeys = KeyState & { attack1: boolean; attack2: boolean; attack3: boolean; dash: boolean; jump: boolean; gimmick: boolean }

export default function Player() {
  const fighter = useBattle((s) => s.playerFighter)
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<Group>(null)
  const [sub, getKeys] = useKeyboardControls<keyof BattleKeys>()
  // 邊緣觸發輸入佇列：keydown 當下記錄，useFrame 消耗（避免短按落在幀間被漏掉）
  const wants = useRef({ attack1: false, attack2: false, attack3: false, dash: false, jump: false, gimmick: false })
  useEffect(() => {
    const u1 = sub((s) => s.attack1, (v) => { if (v) wants.current.attack1 = true })
    const u2 = sub((s) => s.attack2, (v) => { if (v) wants.current.attack2 = true })
    const u3 = sub((s) => s.dash, (v) => { if (v) wants.current.dash = true })
    const u4 = sub((s) => s.gimmick, (v) => { if (v) wants.current.gimmick = true })
    const u5 = sub((s) => s.attack3, (v) => { if (v) wants.current.attack3 = true })
    const u6 = sub((s) => s.jump, (v) => { if (v) wants.current.jump = true })
    return () => { u1(); u2(); u3(); u4(); u5(); u6() }
  }, [sub])
  const lungeUntil = useRef(0)
  const airborne = useRef(false)
  const knockUntil = useRef(0)
  const knockVel = useRef(new Vector3())
  const koT = useRef(0)
  const resetNonce = useBattle((s) => s.resetNonce)
  const mode = useStyleMode((s) => s.mode)
  const camera = useLockOnCamera()
  const arenaId = useArena((s) => s.arenaId)
  const arenaGen = ARENAS.find((a) => a.id === arenaId)?.gen

  // 世代招牌能力：模型換裝（reactive）+ 體型倍率（useFrame 平滑補間）
  const gimmickForm = useBattle((s) => s.playerGimmick.active?.modelSwap ?? 'regular')
  const scaleG = useRef<Group>(null)
  const fovPunched = useRef(false)
  // 計量集滿 → 預載換裝 GLB，發動當下不卡頓
  const meterFull = useBattle((s) => s.playerGimmick.meter >= METER_MAX && !s.playerGimmick.used)
  useEffect(() => {
    if (!meterFull) return
    const def = resolveGimmick(arenaGen ?? 1, fighter.dexId)
    if (def.modelSwap) useGLTF.preload(modelUrl(fighter.dexId, def.modelSwap))
  }, [meterFull, arenaGen, fighter.dexId])

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
    // 控制狀態結算（雙方共用；過期修剪 / 灼傷 DoT / 模型染色頻道）
    st.tickStatus(now)

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
      // 控制狀態：root/stun 鎖移動（含跳躍）、slow 減速；stun 的鎖招在 store tryFire/tryDash 把關
      const moveLocked = isMoveLocked(st.playerEffects, now)
      const spdMult = speedMult(st.playerEffects, now)
      // 著地判定：capsule 靜置高度附近且垂直速度趨零
      const vy0 = body.current.linvel().y
      const grounded = p.y <= GROUNDED_Y && Math.abs(vy0) <= GROUNDED_VY
      // 鎖定移動：W 朝敵、S 遠離、A/D 繞敵側移（不吃滑鼠，方向永遠以敵人為準）
      const yawE = yawBetween(p.x, p.z, battleWorld.enemyPos.x, battleWorld.enemyPos.z)
      const [mxRaw, mzRaw] = lockOnDir(...dirFromKeys(keys), yawE)
      const mx = moveLocked ? 0 : mxRaw
      const mz = moveLocked ? 0 : mzRaw
      const moving = mx !== 0 || mz !== 0
      motion.state = moving ? 'move' : 'idle'
      // 鎖定面向：永遠平滑轉向敵人（側移＝繞著對手打，近戰錐角因此恆對準敵人）
      battleWorld.playerFacing = lerpAngle(battleWorld.playerFacing, yawE, Math.min(1, dt * 10))
      const facing = battleWorld.playerFacing
      facingV.set(Math.sin(facing), 0, Math.cos(facing))

      // 技能輸入：邊緣觸發佇列 + 按住持續補位（冷卻在 store 把關）
      const wantA1 = wants.current.attack1 || keys.attack1
      const wantA2 = wants.current.attack2 || keys.attack2
      const wantA3 = wants.current.attack3 || keys.attack3
      const wantDash = wants.current.dash || keys.dash
      const wantJump = wants.current.jump || keys.jump
      const wantGimmick = wants.current.gimmick || keys.gimmick
      wants.current.attack1 = false
      wants.current.attack2 = false
      wants.current.attack3 = false
      wants.current.dash = false
      wants.current.jump = false
      wants.current.gimmick = false

      // Space：跳躍（僅著地時、無二段跳；root/stun 中不可起跳）
      if (wantJump && grounded && !moveLocked) {
        const v = body.current.linvel()
        body.current.setLinvel({ x: v.x, y: JUMP_VY, z: v.z }, true)
        sfxWhoosh()
      }
      // 著地：塵土 + 悶響（僅在真的離過地後觸發）
      if (grounded && airborne.current) {
        airborne.current = false
        st.addFx({ kind: 'burst', pos: [p.x, 0.12, p.z], color: '#d8cdb8', angle: 0, scale: 0.55, variant: 'wind' })
        sfxThud()
      } else if (!grounded && p.y > GROUNDED_Y + 0.15) {
        airborne.current = true
      }

      // R：發動世代招牌能力（計量滿 100、一場一次）
      if (wantGimmick && st.playerGimmick.meter >= METER_MAX && !st.playerGimmick.used) {
        const def = resolveGimmick(arenaGen ?? 1, st.playerFighter.dexId)
        if (st.tryActivateGimmick('player', def, now)) {
          sfxGimmickCharge()
          playCryFile(st.playerFighter.dexId, 0.7) // 發動吼叫：直接播、不吃節流
          if (def.kind === 'zmove') motion.attackAt = now // Z 招式：蓄力 pose
        }
      }
      const meleeMove = st.playerFighter.moves[0]
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
        const dy = Math.abs(toEnemy.y)
        toEnemy.setY(0)
        const distXZ = toEnemy.length()
        toEnemy.normalize()
        // 有效距離隨對手體型微幅放大（大型 BOSS 剛體較寬）；
        // 垂直規則：水平距離達標 + 高低差 ≤ MELEE_Y_TOLERANCE（±1.6m）→ 地面打空中不至於全空振
        const range = (meleeMove.range ?? 2.2) + st.enemyFighter.targetHeight * 0.3
        if (distXZ <= range && dy <= MELEE_Y_TOLERANCE && facingV.dot(toEnemy) > 0.5) {
          hitPos.copy(battleWorld.enemyPos)
          hitEnemy(meleeMove, hitPos)
          st.addFx({ kind: 'burst', pos: [hitPos.x, hitPos.y + 0.4, hitPos.z], color: meleeMove.color, angle: 0, scale: 0.8 })
        }
      }
      // 投射（K）/ 控制技（U）：同一條 3D 自動瞄準管線（含 Y，空中對地、對空都命中）
      const fireProjectile = (slot: 1 | 2) => {
        const move = st.playerFighter.moves[slot]
        aimDir.copy(battleWorld.enemyPos).sub(battleWorld.playerPos).normalize()
        battleWorld.playerFacing = Math.atan2(aimDir.x, aimDir.z)
        motion.rangeAttackAt = now
        st.spawnProjectile({
          move,
          owner: 'player',
          origin: [p.x + aimDir.x * 0.7, p.y + 0.5, p.z + aimDir.z * 0.7],
          dir: [aimDir.x, aimDir.y, aimDir.z],
          // 極巨化中：招式視覺放大
          scale: st.playerGimmick.active?.kind === 'dynamax' ? 1.8 : 1,
        })
        playLaunch(move.visual)
        maybeCry(st.playerFighter.dexId, 'player-attack')
      }
      if (wantA2 && st.tryFire(1, now)) fireProjectile(1)
      if (wantA3 && st.tryFire(2, now)) fireProjectile(2)
      if (wantDash && !moveLocked && st.tryDash(now)) sfxWhoosh()

      // 速度決策：擊退 > 衝刺/突進 > 一般移動；slow ×0.55、空中操控 ×0.6（衝刺水平爆發保留 vy → 空中可用）
      const dashing = now < st.dashingUntil
      if (now < knockUntil.current) {
        body.current.setLinvel({ x: knockVel.current.x, y: grounded ? 0 : body.current.linvel().y, z: knockVel.current.z }, true)
      } else if (dashing || now < lungeUntil.current) {
        const spd = (dashing ? SPEED * DASH_MULT : 13) * spdMult
        const dir = moving && dashing ? { x: mx, z: mz } : { x: facingV.x, z: facingV.z }
        body.current.setLinvel({ x: dir.x * spd, y: body.current.linvel().y, z: dir.z * spd }, true)
      } else {
        const vel = body.current.linvel()
        const spd = SPEED * spdMult * (grounded ? 1 : AIR_CONTROL)
        body.current.setLinvel({ x: mx * spd, y: vel.y, z: mz * spd }, true)
      }

      // 擊退觸發（由敵方寫入）
      if (battleWorld.playerKnock.lengthSq() > 0) {
        knockVel.current.copy(battleWorld.playerKnock)
        battleWorld.playerKnock.set(0, 0, 0)
        knockUntil.current = now + 130
      }

      // 面向 + 衝刺拉伸殘影感；滯空 = 輕微縱向拉伸（程序式 jump pose）
      visual.current.rotation.y = battleWorld.playerFacing
      const targetSz = dashing ? 1.28 : airborne.current ? 0.94 : 1
      const targetSy = dashing ? 0.82 : airborne.current ? 1.1 : 1
      visual.current.scale.z += (targetSz - visual.current.scale.z) * Math.min(1, dt * 18)
      visual.current.scale.y += (targetSy - visual.current.scale.y) * Math.min(1, dt * 18)
    } else {
      // victory：停住慶祝（待機動畫 / idleBob 演出）
      motion.state = 'idle'
      body.current.setLinvel({ x: 0, y: body.current.linvel().y, z: 0 }, true)
    }

    // 招牌能力體型補間：極巨化 2.3× 從腳底長大（縮回也走同一條）
    if (scaleG.current) {
      const targetScale = st.playerGimmick.active?.scale ?? 1
      const cur = scaleG.current.scale.x
      scaleG.current.scale.setScalar(cur + (targetScale - cur) * Math.min(1, dt * 2.8))
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

    // 招牌能力發動運鏡：任一方發動 → FOV 拉寬 punch + 震動（極巨化的「巨」要讀得出來）
    const actAt = Math.max(st.playerGimmick.activatedAt, st.enemyGimmick.activatedAt)
    const sinceAct = now - actAt
    const cam = rootState.camera as PerspectiveCamera
    if (actAt > 0 && sinceAct < FOV_PUNCH_MS) {
      const k = sinceAct / FOV_PUNCH_MS
      cam.fov = BASE_FOV + Math.sin(k * Math.PI) * 15
      cam.updateProjectionMatrix()
      const sh = (1 - k) * 0.1
      cam.position.x += (Math.random() - 0.5) * sh
      cam.position.y += (Math.random() - 0.5) * sh
      fovPunched.current = true
    } else if (fovPunched.current) {
      fovPunched.current = false
      cam.fov = BASE_FOV
      cam.updateProjectionMatrix()
    }
  })

  return (
    <RigidBody ref={body} colliders={false} lockRotations position={PLAYER_SPAWN}>
      <CapsuleCollider args={[0.5, 0.55]} />
      <group ref={visual}>
        <group position={[0, -1.05, 0]}>
          {/* 招牌能力縮放群組：以腳底為原點長大（極巨化 / MEGA） */}
          <group ref={scaleG}>
            <PokemonRenderable dexId={fighter.dexId} mode={mode} facing="back" targetHeight={fighter.targetHeight} arenaGen={arenaGen} entity="player" motion={battleWorld.playerMotion} form={gimmickForm} />
          </group>
        </group>
      </group>
    </RigidBody>
  )
}
