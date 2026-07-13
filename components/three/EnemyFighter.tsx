'use client'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CapsuleCollider, type RapierRigidBody } from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import { Group, Vector3 } from 'three'
import { canFire } from '@/lib/battle/cooldown'
import { useBattle } from '@/stores/useBattle'
import { useArena } from '@/stores/useArena'
import { useStyleMode } from '@/stores/useStyleMode'
import { battleWorld, ENEMY_SPAWN } from '@/stores/battleWorld'
import { maybeCry, playLaunch, sfxSlash } from '@/lib/sfx'
import { hitPlayer } from './combat'
import { ARENAS } from './arenas/types'
import PokemonRenderable from './renderables/PokemonRenderable'

const APPROACH_SPEED = 3.5
const ATTACK_RANGE = 6
const PUNCH_RANGE = 3.2
const REACTION_MS = 400
const HOVER_Y = 1.6
/** 陸戰型：capsule 半高（0.65+0.7）→ 靜置中心高度 */
const GROUND_Y = 1.35

const toPlayer = new Vector3()
const aim = new Vector3()
const hitPos = new Vector3()

interface AiState {
  mode: 'approach' | 'attack' | 'retreat'
  nextDecisionAt: number
  /** 全域出招間隔：任何攻擊後至少隔 1.5s，避免連續拳擊瞬殺 */
  nextAttackAt: number
  cooldowns: { melee: number; projectile: number }
  preferPunch: boolean
  lungeUntil: number
  punchAt: number
  punchPending: boolean
  retreatUntil: number
  knockUntil: number
  knockVel: Vector3
  koT: number
}

/** 世代 BOSS AI：招式 / 體型 / 飛行姿態全部由 enemyFighter 定義驅動 */
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
    cooldowns: { melee: 0, projectile: 0 },
    preferPunch: true,
    lungeUntil: 0,
    punchAt: 0,
    punchPending: false,
    retreatUntil: 0,
    knockUntil: 0,
    knockVel: new Vector3(),
    koT: 0,
  })
  const resetNonce = useBattle((s) => s.resetNonce)
  const mode = useStyleMode((s) => s.mode)
  const arenaId = useArena((s) => s.arenaId)
  const arenaGen = ARENAS.find((a) => a.id === arenaId)?.gen

  useEffect(() => {
    if (!body.current) return
    body.current.setTranslation({ x: ENEMY_SPAWN[0], y: spawnY, z: ENEMY_SPAWN[2] }, true)
    body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
    const a = ai.current
    a.mode = 'approach'
    a.nextDecisionAt = performance.now() + REACTION_MS
    a.nextAttackAt = performance.now() + 2000 // 開場緩衝
    a.cooldowns = { melee: 0, projectile: 0 }
    a.punchPending = false
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

    toPlayer.copy(battleWorld.playerPos).sub(battleWorld.enemyPos)
    const dist = toPlayer.length()
    toPlayer.setY(0)
    const distXZ = toPlayer.length()
    if (distXZ > 0.001) toPlayer.divideScalar(distXZ)

    // 永遠面向玩家
    visual.current.rotation.y = Math.atan2(toPlayer.x, toPlayer.z)

    // 決策（反應延遲 400ms）
    if (now >= a.nextDecisionAt) {
      a.nextDecisionAt = now + REACTION_MS
      const hpRatio = st.enemyHp / st.enemyMaxHp
      if (hpRatio < 0.25 && Math.random() < 0.3 && now >= a.retreatUntil) {
        a.mode = 'retreat'
        a.retreatUntil = now + 1200
      } else if (dist > ATTACK_RANGE) {
        a.mode = 'approach'
      } else {
        a.mode = 'attack'
        // 交替出招：近距離用近戰，否則投射；全域間隔避免連拳瞬殺
        if (now >= a.nextAttackAt) {
          const punchReady = dist <= PUNCH_RANGE && canFire(a.cooldowns.melee, melee.cooldownMs, now)
          const projReady = canFire(a.cooldowns.projectile, projectile.cooldownMs, now)
          if (punchReady && (a.preferPunch || !projReady)) {
            a.cooldowns.melee = now
            a.preferPunch = false
            a.nextAttackAt = now + 1500
            a.lungeUntil = now + 220
            a.punchAt = now + 260
            a.punchPending = true
            battleWorld.enemyMotion.attackAt = now // 骨骼動畫：出拳當前搖
            sfxSlash()
          } else if (projReady) {
            a.cooldowns.projectile = now
            a.preferPunch = true
            a.nextAttackAt = now + 1500
            battleWorld.enemyMotion.rangeAttackAt = now
            aim.copy(battleWorld.playerPos).sub(battleWorld.enemyPos).normalize()
            st.spawnProjectile({
              move: projectile,
              owner: 'enemy',
              origin: [p.x + aim.x * 1.1, p.y + 0.4, p.z + aim.z * 1.1],
              dir: [aim.x, aim.y, aim.z],
            })
            playLaunch(projectile.visual)
            maybeCry(boss.dexId, 'enemy-attack')
          }
        }
      }
    }

    // 近戰結算：突進尾端判定
    if (a.punchPending && now >= a.punchAt) {
      a.punchPending = false
      const d = battleWorld.playerPos.distanceTo(battleWorld.enemyPos)
      if (d <= (melee.range ?? 2.6) + 0.6 && !st.isInvulnerable(now)) {
        hitPos.copy(battleWorld.playerPos)
        hitPlayer(melee, hitPos)
        st.addFx({ kind: 'burst', pos: [hitPos.x, hitPos.y + 0.3, hitPos.z], color: melee.color, angle: 0, scale: 1 })
      }
    }

    // 擊退消耗
    if (battleWorld.enemyKnock.lengthSq() > 0) {
      a.knockVel.copy(battleWorld.enemyKnock)
      battleWorld.enemyKnock.set(0, 0, 0)
      a.knockUntil = now + 130
    }

    // 移動：飛行型懸浮補間、陸戰型貼地（重力管 y）+ 模式速度
    const hoverTarget = HOVER_Y + Math.sin(now * 0.0018) * 0.18
    const vy = flying ? (hoverTarget - p.y) * 4 : body.current.linvel().y
    let movingNow = false
    if (now < a.knockUntil) {
      body.current.setLinvel({ x: a.knockVel.x, y: vy, z: a.knockVel.z }, true)
    } else if (now < a.lungeUntil) {
      body.current.setLinvel({ x: toPlayer.x * 9, y: vy, z: toPlayer.z * 9 }, true)
      movingNow = true
    } else if (a.mode === 'retreat' && now < a.retreatUntil) {
      body.current.setLinvel({ x: -toPlayer.x * 4, y: vy, z: -toPlayer.z * 4 }, true)
      movingNow = true
    } else if (a.mode === 'approach' || dist > ATTACK_RANGE) {
      const spd = distXZ > 2.6 ? APPROACH_SPEED : 0
      body.current.setLinvel({ x: toPlayer.x * spd, y: vy, z: toPlayer.z * spd }, true)
      movingNow = spd > 0
    } else {
      // 攻擊模式：保持間距（別貼進鏡頭），緩慢逼近
      const spd = distXZ > 2.7 ? 1.4 : 0
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
          <PokemonRenderable dexId={boss.dexId} mode={mode} facing="front" targetHeight={boss.targetHeight} arenaGen={arenaGen} entity="enemy" motion={battleWorld.enemyMotion} />
        </group>
      </group>
    </RigidBody>
  )
}
