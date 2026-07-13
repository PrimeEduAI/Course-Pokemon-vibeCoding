'use client'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CapsuleCollider, type RapierRigidBody } from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import { Group, Vector3 } from 'three'
import { canFire } from '@/lib/battle/cooldown'
import { ENEMY_GIMMICK_HP_RATIO, ENEMY_GIMMICK_METER_MIN, resolveGimmick } from '@/lib/battle/gimmicks'
import { isActionLocked, isMoveLocked, speedMult } from '@/lib/battle/status'
import { useBattle } from '@/stores/useBattle'
import { useArena } from '@/stores/useArena'
import { useStyleMode } from '@/stores/useStyleMode'
import { battleWorld, ENEMY_SPAWN } from '@/stores/battleWorld'
import { maybeCry, playCryFile, playLaunch, sfxGimmickCharge, sfxSlash, sfxWhoosh } from '@/lib/sfx'
import { hitPlayer, MELEE_Y_TOLERANCE } from './combat'
import { ARENAS } from './arenas/types'
import { modelUrl } from './PokemonModel'
import PokemonRenderable from './renderables/PokemonRenderable'

// ---------------------------------------------------------------------------
// BOSS AI v2 調校參數（單一難度；改這裡就能整體調手感）
// ---------------------------------------------------------------------------
/** 追擊移動速度（m/s；slow 狀態再乘 0.55） */
const APPROACH_SPEED = 3.5
/** 進入攻擊決策圈的距離 */
const ATTACK_RANGE = 6
/** 近戰觸發距離 */
const PUNCH_RANGE = 3.2
/** 決策節拍（人味反應延遲） */
const REACTION_MS = 400
/** 懸浮基準高度（飛行型）：capsule 半高 1.35 是地板下限，抬高讓 ±0.8 織動全幅可讀、玩家得抬頭瞄 */
const HOVER_Y = 2.3
/** 陸戰型：capsule 半高（0.65+0.7）→ 靜置中心高度 */
const GROUND_Y = 1.35
/** —— 閃避 —— 玩家彈體出膛後的反應延遲 / 觸發半徑 / 機率 / 內建冷卻（冷卻中直接吃彈，濫射仍會命中一部分） */
const DODGE_REACTION_MS = 350
const DODGE_RADIUS = 1.5
const DODGE_CHANCE = 0.6
const DODGE_COOLDOWN_MS = 2200
/** 閃避側移：速度 × 時長；陸戰另有 50% 機率改用跳躍閃避 */
const DODGE_STRAFE_SPEED = 9
const DODGE_STRAFE_MS = 320
/** 飛行型垂直閃避幅度（±），1.5s 內回復 */
const DODGE_HOVER_OFFSET = 1.6
const DODGE_HOVER_RECOVER_S = 1.5
/** —— 跳躍 —— 陸戰跳躍初速；玩家貼身超過 1.2s → 壓力跳；平時 4–7s 一次換位小跳 */
const HOP_VY = 7
const MELEE_PRESSURE_MS = 1200
const REPOSITION_HOP_MIN_MS = 4000
const REPOSITION_HOP_MAX_MS = 7000
/** 飛行型高度織動（sin）幅度：讓玩家得抬頭瞄 */
const HOVER_WEAVE_AMP = 0.8
/** —— 間距腦 —— 投射待命時偏好的距離帶；連 2 次出招後脫離 1.2s */
const PROJ_BAND_MIN = 8
const DISENGAGE_AFTER_ATTACKS = 2
const DISENGAGE_MS = 1200
/** —— 控制技 —— 連 2 次普通出招後輪替；或玩家頻繁疾走（衰減計分 ≥2）時提前丟 */
const CONTROL_AFTER_ATTACKS = 2
const DASH_SCORE_TRIGGER = 2
/** 全域出招間隔：任何攻擊後至少隔 1.5s，避免連續拳擊瞬殺 */
const ATTACK_GAP_MS = 1500

const toPlayer = new Vector3()
const aim = new Vector3()
const hitPos = new Vector3()
const strafeDir = new Vector3()

interface AiState {
  mode: 'approach' | 'attack' | 'retreat' | 'space' | 'disengage'
  nextDecisionAt: number
  nextAttackAt: number
  cooldowns: { melee: number; projectile: number; control: number }
  preferPunch: boolean
  lungeUntil: number
  punchAt: number
  punchPending: boolean
  retreatUntil: number
  disengageUntil: number
  /** 連續出招數（≥2 → 脫離） / 距上次控制技的普通出招數 */
  attacksInARow: number
  attacksSinceControl: number
  /** 閃避：最後看過的玩家彈體 id、排程評估時刻、內建冷卻、側移窗口 */
  lastSeenProjId: number
  dodgeEvalAt: number
  dodgeReadyAt: number
  strafeUntil: number
  strafeSign: number
  /** 飛行型垂直閃避偏移（往 0 回復） */
  hoverDodge: number
  /** 陸戰壓力跳：玩家進貼身圈的起始時間（0 = 不在圈內）、下次換位跳 */
  pressureSince: number
  nextHopAt: number
  /** 玩家疾走頻率計分（指數衰減；≥2 = 疾走頻繁） */
  dashScore: number
  lastDashSeen: number
  knockUntil: number
  knockVel: Vector3
  koT: number
}

/** 世代 BOSS AI v2：閃避 / 跳躍 / 間距腦 / 控制技輪替，招式與體型由 enemyFighter 定義驅動 */
export default function EnemyFighter() {
  const boss = useBattle((s) => s.enemyFighter)
  const flying = boss.types.includes('flying')
  const spawnY = flying ? ENEMY_SPAWN[1] : GROUND_Y
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<Group>(null)
  const ai = useRef<AiState>({
    mode: 'approach',
    nextDecisionAt: 0,
    nextAttackAt: 0,
    cooldowns: { melee: 0, projectile: 0, control: 0 },
    preferPunch: true,
    lungeUntil: 0,
    punchAt: 0,
    punchPending: false,
    retreatUntil: 0,
    disengageUntil: 0,
    attacksInARow: 0,
    attacksSinceControl: 0,
    lastSeenProjId: 0,
    dodgeEvalAt: 0,
    dodgeReadyAt: 0,
    strafeUntil: 0,
    strafeSign: 1,
    hoverDodge: 0,
    pressureSince: 0,
    nextHopAt: 0,
    dashScore: 0,
    lastDashSeen: -Infinity,
    knockUntil: 0,
    knockVel: new Vector3(),
    koT: 0,
  })
  const resetNonce = useBattle((s) => s.resetNonce)
  const mode = useStyleMode((s) => s.mode)
  const arenaId = useArena((s) => s.arenaId)
  const arenaGen = ARENAS.find((a) => a.id === arenaId)?.gen

  // 世代招牌能力：模型換裝（reactive）+ 體型倍率補間；計量過門檻先預載換裝 GLB
  const gimmickForm = useBattle((s) => s.enemyGimmick.active?.modelSwap ?? 'regular')
  const scaleG = useRef<Group>(null)
  const meterNear = useBattle((s) => s.enemyGimmick.meter >= ENEMY_GIMMICK_METER_MIN && !s.enemyGimmick.used)
  useEffect(() => {
    if (!meterNear) return
    const def = resolveGimmick(arenaGen ?? 1, boss.dexId)
    if (def.modelSwap) useGLTF.preload(modelUrl(boss.dexId, def.modelSwap))
  }, [meterNear, arenaGen, boss.dexId])

  useEffect(() => {
    if (!body.current) return
    body.current.setTranslation({ x: ENEMY_SPAWN[0], y: spawnY, z: ENEMY_SPAWN[2] }, true)
    body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
    const a = ai.current
    const now = performance.now()
    a.mode = 'approach'
    a.nextDecisionAt = now + REACTION_MS
    a.nextAttackAt = now + 2000 // 開場緩衝
    a.cooldowns = { melee: 0, projectile: 0, control: 0 }
    a.punchPending = false
    a.attacksInARow = 0
    a.attacksSinceControl = 0
    a.lastSeenProjId = 0
    a.dodgeEvalAt = 0
    a.dodgeReadyAt = 0
    a.strafeUntil = 0
    a.hoverDodge = 0
    a.pressureSince = 0
    a.nextHopAt = now + REPOSITION_HOP_MIN_MS
    a.dashScore = 0
    a.lastDashSeen = -Infinity
    a.koT = 0
    if (visual.current) {
      visual.current.rotation.set(0, 0, 0)
      visual.current.position.y = 0
    }
  }, [resetNonce, spawnY])

  useFrame((_, dt) => {
    if (!body.current || !visual.current) return
    const st = useBattle.getState()
    const now = performance.now()
    const a = ai.current
    const p = body.current.translation()
    battleWorld.enemyPos.set(p.x, p.y, p.z)
    const melee = boss.moves[0]
    const projectile = boss.moves[1]
    const control = boss.moves[2]

    // KO：翻倒下沉（模型自帶 down01 片段時交給骨骼動畫，剛體只負責降到地面）
    if (st.phase === 'victory') {
      battleWorld.enemyMotion.state = 'ko'
      if (battleWorld.enemyMotion.hasKoClip) {
        const vy = flying ? (p.y > GROUND_Y ? -1.0 : 0) : body.current.linvel().y
        body.current.setLinvel({ x: 0, y: vy, z: 0 }, true)
      } else {
        body.current.setLinvel({ x: 0, y: a.koT >= 1 ? 0 : -0.5, z: 0 }, true)
        a.koT = Math.min(1, a.koT + dt / 1.2)
        visual.current.rotation.z = a.koT * (Math.PI / 2) * 0.95
        visual.current.position.y = -a.koT * 0.75
      }
      return
    }
    if (st.phase !== 'fighting') {
      battleWorld.enemyMotion.state = 'idle'
      body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
      return
    }

    // 控制狀態：stun 全鎖、root 鎖移動、slow 減速（灼傷/弱化由 store/combat 統一處理）
    const eff = st.enemyEffects
    const stunned = isActionLocked(eff, now)
    const rooted = isMoveLocked(eff, now)
    const sMult = speedMult(eff, now)

    toPlayer.copy(battleWorld.playerPos).sub(battleWorld.enemyPos)
    const dist = toPlayer.length()
    toPlayer.setY(0)
    const distXZ = toPlayer.length()
    if (distXZ > 0.001) toPlayer.divideScalar(distXZ)

    // 永遠面向玩家
    visual.current.rotation.y = Math.atan2(toPlayer.x, toPlayer.z)

    // AI 招牌能力：HP ≤50% 且計量 ≥60 → 立即發動（一場一次；tryActivate 內建把關）
    const eg = st.enemyGimmick
    if (!eg.used && st.enemyHp / st.enemyMaxHp <= ENEMY_GIMMICK_HP_RATIO && eg.meter >= ENEMY_GIMMICK_METER_MIN) {
      const def = resolveGimmick(arenaGen ?? 1, boss.dexId)
      if (st.tryActivateGimmick('enemy', def, now)) {
        sfxGimmickCharge()
        playCryFile(boss.dexId, 0.7) // 發動吼叫：直接播、不吃節流
        if (def.kind === 'zmove') battleWorld.enemyMotion.attackAt = now
      }
    }

    // 招牌能力體型補間（極巨化 2.3× 從腳底長大）
    if (scaleG.current) {
      const targetScale = eg.active?.scale ?? 1
      const cur = scaleG.current.scale.x
      scaleG.current.scale.setScalar(cur + (targetScale - cur) * Math.min(1, dt * 2.8))
    }

    // —— 感知：玩家疾走頻率（指數衰減計分，半衰期約 2s）——
    a.dashScore *= Math.exp(-dt * 0.35)
    if (st.dashLastAt > a.lastDashSeen) {
      a.lastDashSeen = st.dashLastAt
      a.dashScore += 1
    }

    // —— 閃避感知：玩家新彈體出膛 → 350ms 反應延遲後評估 ——
    for (const proj of st.projectiles) {
      if (proj.owner !== 'player' || proj.id <= a.lastSeenProjId) continue
      a.lastSeenProjId = proj.id
      if (a.dodgeEvalAt === 0) a.dodgeEvalAt = now + DODGE_REACTION_MS
    }
    if (a.dodgeEvalAt > 0 && now >= a.dodgeEvalAt && !stunned && !rooted) {
      a.dodgeEvalAt = 0
      // 威脅判定：任何存活玩家彈體的直線路徑最近點 < 1.5m
      const threatened = st.projectiles.some((proj) => {
        if (proj.owner !== 'player') return false
        const [ox, oy, oz] = proj.origin
        const [dx0, dy0, dz0] = proj.dir
        const wx = p.x - ox, wy = p.y - oy, wz = p.z - oz
        const t = wx * dx0 + wy * dy0 + wz * dz0
        if (t < 0) return false // 背對而去
        const cx = wx - dx0 * t, cy = wy - dy0 * t, cz = wz - dz0 * t
        return Math.hypot(cx, cy, cz) < DODGE_RADIUS
      })
      if (threatened && now >= a.dodgeReadyAt && Math.random() < DODGE_CHANCE) {
        a.dodgeReadyAt = now + DODGE_COOLDOWN_MS
        a.strafeSign = Math.random() < 0.5 ? 1 : -1
        if (flying) {
          // 飛行型：垂直躲（±1.6，1.5s 回復）+ 順帶側移
          a.hoverDodge = a.strafeSign * DODGE_HOVER_OFFSET
          a.strafeUntil = now + DODGE_STRAFE_MS * 0.6
        } else if (Math.random() < 0.5 && Math.abs(body.current.linvel().y) < 0.3) {
          // 陸戰型 50%：跳躍閃避
          const v = body.current.linvel()
          body.current.setLinvel({ x: v.x, y: HOP_VY * 0.85, z: v.z }, true)
          sfxWhoosh()
        } else {
          // 垂直於玩家連線的爆發側移
          a.strafeUntil = now + DODGE_STRAFE_MS
          sfxWhoosh()
        }
      }
    }

    // —— 陸戰跳躍：貼身壓力跳 + 定期換位小跳（飛行型改走高度織動）——
    if (!flying && !stunned && !rooted) {
      const groundedNow = Math.abs(body.current.linvel().y) < 0.3 && p.y <= GROUND_Y + 0.15
      if (distXZ <= PUNCH_RANGE + 0.4) {
        if (a.pressureSince === 0) a.pressureSince = now
        else if (now - a.pressureSince > MELEE_PRESSURE_MS && groundedNow) {
          // 玩家貼身輸出超過 1.2s：跳離 + 側移擺脫
          a.pressureSince = now
          a.strafeSign = Math.random() < 0.5 ? 1 : -1
          a.strafeUntil = now + DODGE_STRAFE_MS
          body.current.setLinvel({ x: body.current.linvel().x, y: HOP_VY, z: body.current.linvel().z }, true)
          sfxWhoosh()
        }
      } else {
        a.pressureSince = 0
      }
      if (now >= a.nextHopAt && groundedNow && dist <= ATTACK_RANGE + 4) {
        a.nextHopAt = now + REPOSITION_HOP_MIN_MS + Math.random() * (REPOSITION_HOP_MAX_MS - REPOSITION_HOP_MIN_MS)
        a.strafeSign = Math.random() < 0.5 ? 1 : -1
        a.strafeUntil = now + DODGE_STRAFE_MS * 0.8
        body.current.setLinvel({ x: body.current.linvel().x, y: HOP_VY * 0.7, z: body.current.linvel().z }, true)
      }
    }

    // —— 決策（反應延遲 400ms）——
    if (now >= a.nextDecisionAt) {
      a.nextDecisionAt = now + REACTION_MS
      const hpRatio = st.enemyHp / st.enemyMaxHp
      const meleeReady = canFire(a.cooldowns.melee, melee.cooldownMs, now)
      const projReady = canFire(a.cooldowns.projectile, projectile.cooldownMs, now)
      const controlReady = canFire(a.cooldowns.control, control.cooldownMs, now)
      if (now < a.disengageUntil) {
        a.mode = 'disengage'
      } else if (hpRatio < 0.25 && Math.random() < 0.3 && now >= a.retreatUntil) {
        a.mode = 'retreat'
        a.retreatUntil = now + 1200
      } else if (projReady && !meleeReady && distXZ < PROJ_BAND_MIN) {
        // 間距腦：投射待命、近戰還沒好 → 退到 8–14m 投射帶再打
        a.mode = 'space'
      } else if (dist > ATTACK_RANGE) {
        a.mode = 'approach'
      } else {
        a.mode = 'attack'
        // 出招：全域間隔 + 震懾封招；控制技輪替（2 次普攻後 / 玩家疾走頻繁）
        if (now >= a.nextAttackAt && !stunned) {
          const wantControl = controlReady && (a.attacksSinceControl >= CONTROL_AFTER_ATTACKS || a.dashScore >= DASH_SCORE_TRIGGER)
          const punchReady = dist <= PUNCH_RANGE && meleeReady
          if (wantControl) {
            a.cooldowns.control = now
            a.attacksSinceControl = 0
            a.nextAttackAt = now + ATTACK_GAP_MS
            battleWorld.enemyMotion.rangeAttackAt = now
            aim.copy(battleWorld.playerPos).sub(battleWorld.enemyPos).normalize()
            st.spawnProjectile({
              move: control,
              owner: 'enemy',
              origin: [p.x + aim.x * 1.1, p.y + 0.4, p.z + aim.z * 1.1],
              dir: [aim.x, aim.y, aim.z],
              scale: eg.active?.kind === 'dynamax' ? 1.8 : 1,
            })
            playLaunch(control.visual)
            maybeCry(boss.dexId, 'enemy-attack')
            a.attacksInARow += 1
          } else if (punchReady && (a.preferPunch || !projReady)) {
            a.cooldowns.melee = now
            a.preferPunch = false
            a.attacksSinceControl += 1
            a.nextAttackAt = now + ATTACK_GAP_MS
            a.lungeUntil = now + 220
            a.punchAt = now + 260
            a.punchPending = true
            battleWorld.enemyMotion.attackAt = now // 骨骼動畫：出拳當前搖
            sfxSlash()
            a.attacksInARow += 1
          } else if (projReady) {
            a.cooldowns.projectile = now
            a.preferPunch = true
            a.attacksSinceControl += 1
            a.nextAttackAt = now + ATTACK_GAP_MS
            battleWorld.enemyMotion.rangeAttackAt = now
            aim.copy(battleWorld.playerPos).sub(battleWorld.enemyPos).normalize()
            st.spawnProjectile({
              move: projectile,
              owner: 'enemy',
              origin: [p.x + aim.x * 1.1, p.y + 0.4, p.z + aim.z * 1.1],
              dir: [aim.x, aim.y, aim.z],
              scale: eg.active?.kind === 'dynamax' ? 1.8 : 1,
            })
            playLaunch(projectile.visual)
            maybeCry(boss.dexId, 'enemy-attack')
            a.attacksInARow += 1
          }
          // 連 2 次出招 → 脫離爆發 1.2s（別站樁互毆）
          if (a.attacksInARow >= DISENGAGE_AFTER_ATTACKS) {
            a.attacksInARow = 0
            a.disengageUntil = now + DISENGAGE_MS
          }
        }
      }
    }

    // 近戰結算：突進尾端判定（垂直容差 ±1.6m；被震懾時取消這一拳）
    if (a.punchPending && now >= a.punchAt) {
      a.punchPending = false
      if (!stunned) {
        const dxz = Math.hypot(battleWorld.playerPos.x - battleWorld.enemyPos.x, battleWorld.playerPos.z - battleWorld.enemyPos.z)
        const dyNow = Math.abs(battleWorld.playerPos.y - battleWorld.enemyPos.y)
        if (dxz <= (melee.range ?? 2.6) + 0.6 && dyNow <= MELEE_Y_TOLERANCE && !st.isInvulnerable(now)) {
          hitPos.copy(battleWorld.playerPos)
          hitPlayer(melee, hitPos)
          st.addFx({ kind: 'burst', pos: [hitPos.x, hitPos.y + 0.3, hitPos.z], color: melee.color, angle: 0, scale: 1 })
        }
      }
    }

    // 擊退消耗
    if (battleWorld.enemyKnock.lengthSq() > 0) {
      a.knockVel.copy(battleWorld.enemyKnock)
      battleWorld.enemyKnock.set(0, 0, 0)
      a.knockUntil = now + 130
    }

    // —— 移動 ——
    // 飛行型：懸浮織動（±0.8 sin）+ 垂直閃避偏移（1.5s 回復）；陸戰型交給重力
    if (a.hoverDodge !== 0) {
      const recover = (DODGE_HOVER_OFFSET / DODGE_HOVER_RECOVER_S) * dt
      a.hoverDodge = a.hoverDodge > 0 ? Math.max(0, a.hoverDodge - recover) : Math.min(0, a.hoverDodge + recover)
    }
    const hoverTarget = Math.max(0.9, HOVER_Y + Math.sin(now * 0.0011) * HOVER_WEAVE_AMP + a.hoverDodge)
    const vy = flying ? (hoverTarget - p.y) * 4 : body.current.linvel().y
    let movingNow = false
    if (now < a.knockUntil) {
      body.current.setLinvel({ x: a.knockVel.x, y: vy, z: a.knockVel.z }, true)
    } else if (stunned || rooted) {
      // 震懾 / 禁錮：原地（飛行型維持懸浮、陸戰型自由落體）
      body.current.setLinvel({ x: 0, y: vy, z: 0 }, true)
    } else if (now < a.strafeUntil) {
      // 閃避 / 擺脫：垂直於玩家連線的爆發側移
      strafeDir.set(-toPlayer.z, 0, toPlayer.x).multiplyScalar(a.strafeSign * DODGE_STRAFE_SPEED * sMult)
      body.current.setLinvel({ x: strafeDir.x, y: vy, z: strafeDir.z }, true)
      movingNow = true
    } else if (now < a.lungeUntil) {
      body.current.setLinvel({ x: toPlayer.x * 9 * sMult, y: vy, z: toPlayer.z * 9 * sMult }, true)
      movingNow = true
    } else if ((a.mode === 'retreat' && now < a.retreatUntil) || (a.mode === 'disengage' && now < a.disengageUntil)) {
      const spd = (a.mode === 'disengage' ? 4.5 : 4) * sMult
      body.current.setLinvel({ x: -toPlayer.x * spd, y: vy, z: -toPlayer.z * spd }, true)
      movingNow = true
    } else if (a.mode === 'space' && distXZ < PROJ_BAND_MIN) {
      // 退到投射帶（8–14m）
      const spd = APPROACH_SPEED * sMult
      body.current.setLinvel({ x: -toPlayer.x * spd, y: vy, z: -toPlayer.z * spd }, true)
      movingNow = true
    } else if (a.mode === 'approach' || dist > ATTACK_RANGE) {
      const spd = (distXZ > 2.6 ? APPROACH_SPEED : 0) * sMult
      body.current.setLinvel({ x: toPlayer.x * spd, y: vy, z: toPlayer.z * spd }, true)
      movingNow = spd > 0
    } else {
      // 攻擊模式：保持間距（別貼進鏡頭），緩慢逼近
      const spd = (distXZ > 2.7 ? 1.4 : 0) * sMult
      body.current.setLinvel({ x: toPlayer.x * spd, y: vy, z: toPlayer.z * spd }, true)
      movingNow = spd > 0
    }
    battleWorld.enemyMotion.state = movingNow ? 'move' : 'idle'
  })

  return (
    <RigidBody
      key={`${boss.dexId}-${flying ? 'air' : 'ground'}`}
      ref={body}
      colliders={false}
      lockRotations
      gravityScale={flying ? 0 : 1}
      position={[ENEMY_SPAWN[0], spawnY, ENEMY_SPAWN[2]]}
    >
      <CapsuleCollider args={[0.65, 0.7]} />
      <group ref={visual}>
        <group position={[0, -1.35, 0]}>
          {/* 招牌能力縮放群組：以腳底為原點長大（極巨化 BOSS 變 kaiju） */}
          <group ref={scaleG}>
            <PokemonRenderable dexId={boss.dexId} mode={mode} facing="front" targetHeight={boss.targetHeight} arenaGen={arenaGen} entity="enemy" motion={battleWorld.enemyMotion} form={gimmickForm} />
          </group>
        </group>
      </group>
    </RigidBody>
  )
}
