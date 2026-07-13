'use client'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, DoubleSide, Group, Mesh, MeshBasicMaterial } from 'three'
import type { ComponentType } from 'react'
import { STATUS_META, type StatusKind } from '@/lib/battle/status'
import { useBattle } from '@/stores/useBattle'
import { battleWorld } from '@/stores/battleWorld'
import { ImpactFxRenderer, SlashFxRenderer } from './moveVisuals'
import { getGlowTexture } from './glowTexture'

// ---------------------------------------------------------------------------
// 控制狀態光環：施加中的每個狀態一組跟隨粒子（跟著剛體走，非一次性爆閃）
// ---------------------------------------------------------------------------

interface AuraProps { side: 'player' | 'enemy' }

/** 跟隨戰鬥實體中心的錨點群組 */
function useFollow(side: 'player' | 'enemy') {
  const g = useRef<Group>(null)
  useFrame(() => {
    const pos = side === 'player' ? battleWorld.playerPos : battleWorld.enemyPos
    g.current?.position.copy(pos)
  })
  return g
}

/** slow（麻痺）：黃色電花在身側跳動 */
function SlowAura({ side }: AuraProps) {
  const g = useFollow(side)
  const sparks = useRef<(Mesh | null)[]>([])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    for (let i = 0; i < 4; i++) {
      const m = sparks.current[i]
      if (!m) continue
      const jump = Math.floor(t * 9 + i * 3.7) // 離散跳點（電花感）
      const a = (jump * 2.399 + i) % (Math.PI * 2)
      m.position.set(Math.cos(a) * 0.75, 0.2 + ((jump * 0.37 + i * 0.5) % 1.1), Math.sin(a) * 0.75)
      m.rotation.z = jump
      m.visible = Math.sin(t * 21 + i * 2) > -0.4
    }
  })
  return (
    <group ref={g}>
      {Array.from({ length: 4 }, (_, i) => (
        <mesh key={i} ref={(el) => { sparks.current[i] = el }}>
          <octahedronGeometry args={[0.08, 0]} />
          <meshBasicMaterial color={STATUS_META.slow.color} toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.95} />
        </mesh>
      ))}
    </group>
  )
}

/** root（禁錮）：腳邊冰藍晶柱環 */
function RootAura({ side }: AuraProps) {
  const g = useFollow(side)
  const ring = useRef<Group>(null)
  useFrame((state) => {
    if (ring.current) ring.current.rotation.y = state.clock.elapsedTime * 0.8
  })
  const N = 6
  return (
    <group ref={g}>
      <group ref={ring} position={[0, -0.85, 0]}>
        {Array.from({ length: N }, (_, i) => {
          const a = (i / N) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(a) * 0.85, 0.3, Math.sin(a) * 0.85]} rotation={[0.25 * Math.cos(a), 0, 0.25 * Math.sin(a)]}>
              <coneGeometry args={[0.11, 0.62, 5]} />
              <meshBasicMaterial color={STATUS_META.root.color} toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.85} />
            </mesh>
          )
        })}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.85, 0.05, 8, 32]} />
          <meshBasicMaterial color="#e8fbff" toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.7} side={DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}

/** stun（震懾）：頭頂環繞星星 */
function StunAura({ side }: AuraProps) {
  const g = useFollow(side)
  const stars = useRef<(Mesh | null)[]>([])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    for (let i = 0; i < 3; i++) {
      const m = stars.current[i]
      if (!m) continue
      const a = t * 6 + (i / 3) * Math.PI * 2
      m.position.set(Math.cos(a) * 0.55, 1.15 + Math.sin(t * 4 + i) * 0.06, Math.sin(a) * 0.55)
      m.rotation.y = t * 3
    }
  })
  return (
    <group ref={g}>
      {Array.from({ length: 3 }, (_, i) => (
        <mesh key={i} ref={(el) => { stars.current[i] = el }}>
          <octahedronGeometry args={[0.11, 0]} />
          <meshBasicMaterial color={STATUS_META.stun.color} toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.95} />
        </mesh>
      ))}
    </group>
  )
}

/** burn（灼傷）：橙紅餘燼上飄 */
function BurnAura({ side }: AuraProps) {
  const g = useFollow(side)
  const embers = useRef<(Mesh | null)[]>([])
  const glowMap = useMemo(() => getGlowTexture(), [])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    for (let i = 0; i < 5; i++) {
      const m = embers.current[i]
      if (!m) continue
      const k = (t * 0.9 + i * 0.23) % 1
      const a = i * 2.4 + t * 0.6
      m.position.set(Math.cos(a) * (0.5 - k * 0.2), -0.6 + k * 1.8, Math.sin(a) * (0.5 - k * 0.2))
      m.scale.setScalar(0.6 + (1 - k) * 0.6)
      ;(m.material as MeshBasicMaterial).opacity = (1 - k) * 0.9
    }
  })
  return (
    <group ref={g}>
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} ref={(el) => { embers.current[i] = el }}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshBasicMaterial color={i % 2 === 0 ? STATUS_META.burn.color : '#ffcf6b'} toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.9} />
        </mesh>
      ))}
      <sprite scale={[1.4, 1.4, 1]} position={[0, 0.1, 0]}>
        <spriteMaterial map={glowMap} color={STATUS_META.burn.color} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.22} />
      </sprite>
    </group>
  )
}

/** weaken（弱化）：紫色下沉箭頭氣場 */
function WeakenAura({ side }: AuraProps) {
  const g = useFollow(side)
  const arrows = useRef<(Mesh | null)[]>([])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    for (let i = 0; i < 3; i++) {
      const m = arrows.current[i]
      if (!m) continue
      const k = (t * 0.7 + i / 3) % 1
      const a = (i / 3) * Math.PI * 2 + t * 0.5
      m.position.set(Math.cos(a) * 0.7, 1.2 - k * 1.7, Math.sin(a) * 0.7)
      ;(m.material as MeshBasicMaterial).opacity = Math.sin(k * Math.PI) * 0.9
    }
  })
  return (
    <group ref={g}>
      {Array.from({ length: 3 }, (_, i) => (
        <mesh key={i} ref={(el) => { arrows.current[i] = el }} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.13, 0.34, 4]} />
          <meshBasicMaterial color={STATUS_META.weaken.color} toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  )
}

const STATUS_AURAS: Record<StatusKind, ComponentType<AuraProps>> = {
  slow: SlowAura,
  root: RootAura,
  stun: StunAura,
  burn: BurnAura,
  weaken: WeakenAura,
}

/** 雙方施加中的狀態光環（效果過期由 useBattle.tickStatus 修剪 → 自動卸載） */
function StatusAuras() {
  const playerEffects = useBattle((s) => s.playerEffects)
  const enemyEffects = useBattle((s) => s.enemyEffects)
  return (
    <>
      {playerEffects.map((e) => {
        const C = STATUS_AURAS[e.kind]
        return <C key={`p-${e.kind}`} side="player" />
      })}
      {enemyEffects.map((e) => {
        const C = STATUS_AURAS[e.kind]
        return <C key={`e-${e.kind}`} side="enemy" />
      })}
    </>
  )
}

/**
 * 打擊特效層：命中爆閃 / 近戰斬擊，全部依 fx.variant 分派到 moveVisuals 註冊表
 * （burst.variant = MoveVisualId、slash.variant = SlashVariant；未指定走通用外觀）
 * + 控制狀態光環（跟隨實體的持續粒子）。
 */
export default function FXLayer() {
  const fx = useBattle((s) => s.fx)
  return (
    <>
      {fx.map((f) => (f.kind === 'slash' ? <SlashFxRenderer key={f.id} fx={f} /> : <ImpactFxRenderer key={f.id} fx={f} />))}
      <StatusAuras />
    </>
  )
}
