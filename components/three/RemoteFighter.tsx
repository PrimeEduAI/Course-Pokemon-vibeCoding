'use client'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CapsuleCollider, type RapierRigidBody } from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import { Group, Vector3 } from 'three'
import { lerpAngle } from '@/lib/movement'
import { useBattle } from '@/stores/useBattle'
import { useArena } from '@/stores/useArena'
import { useStyleMode } from '@/stores/useStyleMode'
import { battleWorld, type MotionState } from '@/stores/battleWorld'
import { netWorld } from '@/stores/useNetwork'
import { ARENAS } from './arenas/types'
import PokemonRenderable from './renderables/PokemonRenderable'

/**
 * PvP 對手實體：取代 EnemyFighter（無 AI），由網路快照驅動。
 * - 位置/朝向：渲染 INTERP_MS 前的狀態，在跨越該時刻的兩張快照間補間（20Hz 快照永遠有料）。
 * - 動作：快照的 motion state（含對方倒下的 'ko'）直接寫進 enemyMotion 頻道，
 *   骨骼動畫 / 受擊白閃 / 染色與 BOSS 共用同一條 PokemonRenderable 管線。
 * - 剛體：kinematicPosition —— 有實體碰撞（不會互相穿模）但不受力。
 */

/** 快照插值延遲：晚 90ms 渲染對手（區網 RTT ~1ms，體感無感但補間永遠平滑） */
const INTERP_MS = 90
/** 快照斷流時的外插上限：短暫掉幀繼續沿速度前進，超過就停住（避免飛出去） */
const EXTRAP_MAX_MS = 150
/** 對手出生點 = 鏡像後的玩家出生點 */
const REMOTE_SPAWN: [number, number, number] = [0, 1, -6]
/** 平滑跟隨：位移平方超過此值視為重生/傳送 → 直接貼齊不補間 */
const TELEPORT_SQ = 25

const target = new Vector3()

export default function RemoteFighter() {
  const fighter = useBattle((s) => s.enemyFighter)
  const resetNonce = useBattle((s) => s.resetNonce)
  const gimmickForm = useBattle((s) => s.enemyGimmick.active?.modelSwap ?? 'regular')
  const mode = useStyleMode((s) => s.mode)
  const arenaId = useArena((s) => s.arenaId)
  const arenaGen = ARENAS.find((a) => a.id === arenaId)?.gen

  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<Group>(null)
  const scaleG = useRef<Group>(null)
  const yaw = useRef(Math.PI)
  const koT = useRef(0)
  const smoothed = useRef(new Vector3(...REMOTE_SPAWN))

  // 再戰：回出生點、姿態歸零
  useEffect(() => {
    koT.current = 0
    yaw.current = Math.PI
    smoothed.current.set(...REMOTE_SPAWN)
    if (visual.current) {
      visual.current.rotation.set(0, Math.PI, 0)
      visual.current.position.y = 0
    }
    body.current?.setNextKinematicTranslation({ x: REMOTE_SPAWN[0], y: REMOTE_SPAWN[1], z: REMOTE_SPAWN[2] })
  }, [resetNonce])

  useFrame((_, dt) => {
    if (!body.current || !visual.current) return
    const motion = battleWorld.enemyMotion
    const snaps = netWorld.snaps
    const renderT = performance.now() - INTERP_MS

    // 找跨越 renderT 的兩張快照補間；比最新快照還新 → 沿速度短暫外插（上限 150ms）
    let x = REMOTE_SPAWN[0], y = REMOTE_SPAWN[1], z = REMOTE_SPAWN[2]
    let targetYaw = yaw.current
    let state: MotionState = 'idle'
    if (snaps.length > 0) {
      let i = snaps.length - 1
      while (i > 0 && snaps[i - 1].t > renderT) i--
      const a = i > 0 ? snaps[i - 1] : snaps[0]
      const b = snaps[i]
      const span = b.t - a.t
      if (renderT > b.t && span > 0) {
        // 外插：掉幀/抖動時對手繼續順著走，而不是停格等下一張快照
        const ahead = Math.min(renderT - b.t, EXTRAP_MAX_MS)
        x = b.p[0] + ((b.p[0] - a.p[0]) / span) * ahead
        y = b.p[1] + ((b.p[1] - a.p[1]) / span) * ahead
        z = b.p[2] + ((b.p[2] - a.p[2]) / span) * ahead
      } else {
        const k = span > 0 ? Math.min(1, Math.max(0, (renderT - a.t) / span)) : 1
        x = a.p[0] + (b.p[0] - a.p[0]) * k
        y = a.p[1] + (b.p[1] - a.p[1]) * k
        z = a.p[2] + (b.p[2] - a.p[2]) * k
      }
      targetYaw = b.f
      state = b.m
    }

    // 平滑跟隨：吸收快照到達時間的抖動（大位移 = 重生/傳送 → 直接貼齊）
    target.set(x, y, z)
    if (smoothed.current.distanceToSquared(target) > TELEPORT_SQ) smoothed.current.copy(target)
    else smoothed.current.lerp(target, Math.min(1, dt * 18))
    battleWorld.enemyPos.copy(smoothed.current)
    body.current.setNextKinematicTranslation(smoothed.current)
    yaw.current = lerpAngle(yaw.current, targetYaw, Math.min(1, dt * 14))
    visual.current.rotation.y = yaw.current
    motion.state = state

    // 對手倒下（= 我方勝利）：模型無 down01 片段時做程序式翻倒
    if (state === 'ko' && !motion.hasKoClip) {
      koT.current = Math.min(1, koT.current + dt / 1.1)
      visual.current.rotation.z = koT.current * (Math.PI / 2) * 0.92
      visual.current.position.y = -koT.current * 0.55
    }

    // 招牌能力體型補間（極巨化 2.3× 從腳底長大）
    if (scaleG.current) {
      const target = useBattle.getState().enemyGimmick.active?.scale ?? 1
      const cur = scaleG.current.scale.x
      scaleG.current.scale.setScalar(cur + (target - cur) * Math.min(1, dt * 2.8))
    }
  })

  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} lockRotations position={REMOTE_SPAWN}>
      <CapsuleCollider args={[0.5, 0.55]} />
      <group ref={visual} rotation={[0, Math.PI, 0]}>
        <group position={[0, -1.05, 0]}>
          {/* 招牌能力縮放群組：以腳底為原點長大（MEGA / 極巨化） */}
          <group ref={scaleG}>
            <PokemonRenderable dexId={fighter.dexId} mode={mode} facing="front" targetHeight={fighter.targetHeight} arenaGen={arenaGen} entity="enemy" motion={battleWorld.enemyMotion} form={gimmickForm} />
          </group>
        </group>
      </group>
    </RigidBody>
  )
}
