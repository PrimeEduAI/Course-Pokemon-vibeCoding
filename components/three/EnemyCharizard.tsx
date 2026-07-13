'use client'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CapsuleCollider, type RapierRigidBody } from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import { Group, Vector3 } from 'three'
import { MOVES } from '@/lib/battle/moves'
import { canFire } from '@/lib/battle/cooldown'
import { useBattle } from '@/stores/useBattle'
import { useArena } from '@/stores/useArena'
import { useStyleMode } from '@/stores/useStyleMode'
import { battleWorld, ENEMY_SPAWN } from '@/stores/battleWorld'
import { hitPlayer } from './combat'
import { ARENAS } from './arenas/types'
import PokemonRenderable from './renderables/PokemonRenderable'

const APPROACH_SPEED = 3.5
const ATTACK_RANGE = 6
const PUNCH_RANGE = 3.2
const REACTION_MS = 400
const HOVER_Y = 1.6

const toPlayer = new Vector3()
const aim = new Vector3()
const hitPos = new Vector3()

interface AiState {
  mode: 'approach' | 'attack' | 'retreat'
  nextDecisionAt: number
  /** 全域出招間隔：任何攻擊後至少隔 1.5s，避免連續拳擊瞬殺 */
  nextAttackAt: number
  cooldowns: { firePunch: number; flamethrower: number }
  preferPunch: boolean
  lungeUntil: number
  punchAt: number
  punchPending: boolean
  retreatUntil: number
  knockUntil: number
  knockVel: Vector3
  koT: number
}

export default function EnemyCharizard() {
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<Group>(null)
  const ai = useRef<AiState>({
    mode: 'approach',
    nextDecisionAt: 0,
    nextAttackAt: 0,
    cooldowns: { firePunch: 0, flamethrower: 0 },
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
    body.current.setTranslation({ x: ENEMY_SPAWN[0], y: ENEMY_SPAWN[1], z: ENEMY_SPAWN[2] }, true)
    body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
    const a = ai.current
    a.mode = 'approach'
    a.nextDecisionAt = performance.now() + REACTION_MS
    a.nextAttackAt = performance.now() + 2000 // 開場緩衝
    a.cooldowns = { firePunch: 0, flamethrower: 0 }
    a.punchPending = false
    a.koT = 0
    if (visual.current) {
      visual.current.rotation.set(0, 0, 0)
      visual.current.position.y = 0
    }
  }, [resetNonce])

  useFrame((_, dt) => {
    if (!body.current || !visual.current) return
    const st = useBattle.getState()
    const now = performance.now()
    const a = ai.current
    const p = body.current.translation()
    battleWorld.enemyPos.set(p.x, p.y, p.z)

    // KO：翻倒下沉
    if (st.phase === 'victory') {
      body.current.setLinvel({ x: 0, y: a.koT >= 1 ? 0 : -0.5, z: 0 }, true)
      a.koT = Math.min(1, a.koT + dt / 1.2)
      visual.current.rotation.z = a.koT * (Math.PI / 2) * 0.95
      visual.current.position.y = -a.koT * 0.75
      return
    }
    if (st.phase !== 'fighting') {
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
        // 交替出招：近距離火焰拳，否則噴射火焰；全域間隔避免連拳瞬殺
        if (now >= a.nextAttackAt) {
          const punchReady = dist <= PUNCH_RANGE && canFire(a.cooldowns.firePunch, MOVES.firePunch.cooldownMs, now)
          const flameReady = canFire(a.cooldowns.flamethrower, MOVES.flamethrower.cooldownMs, now)
          if (punchReady && (a.preferPunch || !flameReady)) {
            a.cooldowns.firePunch = now
            a.preferPunch = false
            a.nextAttackAt = now + 1500
            a.lungeUntil = now + 220
            a.punchAt = now + 260
            a.punchPending = true
          } else if (flameReady) {
            a.cooldowns.flamethrower = now
            a.preferPunch = true
            a.nextAttackAt = now + 1500
            aim.copy(battleWorld.playerPos).sub(battleWorld.enemyPos).normalize()
            st.spawnProjectile({
              moveId: 'flamethrower',
              owner: 'enemy',
              origin: [p.x + aim.x * 1.1, p.y + 0.4, p.z + aim.z * 1.1],
              dir: [aim.x, aim.y, aim.z],
            })
          }
        }
      }
    }

    // 火焰拳結算：突進尾端判定
    if (a.punchPending && now >= a.punchAt) {
      a.punchPending = false
      const d = battleWorld.playerPos.distanceTo(battleWorld.enemyPos)
      if (d <= (MOVES.firePunch.range ?? 2.6) + 0.6 && !st.isInvulnerable(now)) {
        hitPos.copy(battleWorld.playerPos)
        hitPlayer(MOVES.firePunch, hitPos)
        st.addFx({ kind: 'burst', pos: [hitPos.x, hitPos.y + 0.3, hitPos.z], color: '#ffab5e', angle: 0, scale: 1 })
      }
    }

    // 擊退消耗
    if (battleWorld.enemyKnock.lengthSq() > 0) {
      a.knockVel.copy(battleWorld.enemyKnock)
      battleWorld.enemyKnock.set(0, 0, 0)
      a.knockUntil = now + 130
    }

    // 移動：懸浮 + 模式速度
    const hoverTarget = HOVER_Y + Math.sin(now * 0.0018) * 0.18
    const vy = (hoverTarget - p.y) * 4
    if (now < a.knockUntil) {
      body.current.setLinvel({ x: a.knockVel.x, y: vy, z: a.knockVel.z }, true)
    } else if (now < a.lungeUntil) {
      body.current.setLinvel({ x: toPlayer.x * 9, y: vy, z: toPlayer.z * 9 }, true)
    } else if (a.mode === 'retreat' && now < a.retreatUntil) {
      body.current.setLinvel({ x: -toPlayer.x * 4, y: vy, z: -toPlayer.z * 4 }, true)
    } else if (a.mode === 'approach' || dist > ATTACK_RANGE) {
      const spd = distXZ > 2.6 ? APPROACH_SPEED : 0
      body.current.setLinvel({ x: toPlayer.x * spd, y: vy, z: toPlayer.z * spd }, true)
    } else {
      // 攻擊模式：保持間距（別貼進鏡頭），緩慢逼近
      const spd = distXZ > 2.7 ? 1.4 : 0
      body.current.setLinvel({ x: toPlayer.x * spd, y: vy, z: toPlayer.z * spd }, true)
    }
  })

  return (
    <RigidBody ref={body} colliders={false} lockRotations gravityScale={0} position={ENEMY_SPAWN}>
      <CapsuleCollider args={[0.65, 0.7]} />
      <group ref={visual}>
        <group position={[0, -1.35, 0]}>
          <PokemonRenderable dexId={6} mode={mode} facing="front" targetHeight={2.2} arenaGen={arenaGen} entity="enemy" />
        </group>
      </group>
    </RigidBody>
  )
}
