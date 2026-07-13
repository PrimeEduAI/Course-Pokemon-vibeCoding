'use client'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { AdditiveBlending, Group, Mesh, MeshBasicMaterial } from 'three'
import { useBattle, type BurstFx } from '@/stores/useBattle'

const BURST_MS = 320
const SLASH_MS = 240

/** 命中爆閃：加法混合球體，放大 + 淡出 */
function Burst({ fx }: { fx: BurstFx }) {
  const mesh = useRef<Mesh>(null)
  useFrame(() => {
    if (!mesh.current) return
    const k = (performance.now() - fx.at) / BURST_MS
    if (k >= 1) {
      useBattle.getState().removeFx(fx.id)
      return
    }
    const s = fx.scale * (0.35 + k * 1.9)
    mesh.current.scale.setScalar(s)
    ;(mesh.current.material as MeshBasicMaterial).opacity = (1 - k) * 0.9
  })
  return (
    <mesh ref={mesh} position={fx.pos}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial color={fx.color} transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

/** 近戰弧形斬擊：水平圓環弧段，展開 + 淡出 */
function Slash({ fx }: { fx: BurstFx }) {
  const group = useRef<Group>(null)
  const mat = useRef<MeshBasicMaterial>(null)
  useFrame(() => {
    if (!group.current || !mat.current) return
    const k = (performance.now() - fx.at) / SLASH_MS
    if (k >= 1) {
      useBattle.getState().removeFx(fx.id)
      return
    }
    const s = 0.7 + k * 1.1
    group.current.scale.setScalar(s)
    mat.current.opacity = (1 - k) * 0.95
  })
  return (
    <group ref={group} position={fx.pos} rotation={[0, fx.angle, 0]}>
      {/* 弧段置於面向正前方 ±60° */}
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2 - Math.PI / 3]}>
        <torusGeometry args={[1.15, 0.09, 8, 32, (Math.PI * 2) / 3]} />
        <meshBasicMaterial ref={mat} color={fx.color} transparent opacity={0.95} blending={AdditiveBlending} depthWrite={false} toneMapped={false} side={2} />
      </mesh>
    </group>
  )
}

export default function FXLayer() {
  const fx = useBattle((s) => s.fx)
  return (
    <>
      {fx.map((f) => (f.kind === 'slash' ? <Slash key={f.id} fx={f} /> : <Burst key={f.id} fx={f} />))}
    </>
  )
}
