'use client'
/**
 * 招式視覺註冊表：每個 MoveVisualId 一組專屬「彈體外觀 + 命中特效」。
 * 彈體元件一律渲染在 Projectiles 的定向群組內（+z = 飛行方向），
 * 移動 / 命中判定仍由 Projectiles 的模擬層負責 —— 這裡只管好看。
 */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  AdditiveBlending, Color, DoubleSide, Group, Mesh, MeshBasicMaterial,
  PointLight, Shape, ShapeGeometry, Vector3,
} from 'three'
import type { ComponentType } from 'react'
import type { MoveDef, MoveVisualId, PokeType } from '@/lib/battle/moves'
import { useBattle, type BurstFx } from '@/stores/useBattle'
import { getGlowTexture } from './glowTexture'

// ---------------------------------------------------------------------------
// 共用工具
// ---------------------------------------------------------------------------

export function resolveVisual(move: MoveDef): MoveVisualId {
  return move.visual ?? 'beam'
}

/** 近戰斬擊樣式：依招式屬性挑外形 */
export type SlashVariant = 'arc' | 'cross' | 'flamearc' | 'claws' | 'rings'
export function slashVariantForType(t: PokeType): SlashVariant {
  switch (t) {
    case 'fighting': case 'steel': return 'cross'
    case 'fire': return 'flamearc'
    case 'dragon': return 'claws'
    case 'psychic': return 'rings'
    default: return 'arc'
  }
}

const toWhite = (hex: string, k: number) => `#${new Color(hex).lerp(new Color('#ffffff'), k).getHexString()}`

/** 星形 ShapeGeometry（快取：{角數-外徑-內徑}） */
const starGeomCache = new Map<string, ShapeGeometry>()
function getStarGeometry(points: number, outer: number, inner: number): ShapeGeometry {
  const key = `${points}-${outer}-${inner}`
  const hit = starGeomCache.get(key)
  if (hit) return hit
  const shape = new Shape()
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  const geom = new ShapeGeometry(shape)
  starGeomCache.set(key, geom)
  return geom
}

/** 固定亂數序列（每顆彈體 / 特效自帶 seed，避免每幀 Math.random 抖動不連貫） */
function makeRand(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

interface VisualProps { move: MoveDef }

// ---------------------------------------------------------------------------
// 彈體視覺（+z = 飛行方向）
// ---------------------------------------------------------------------------

const Y_AXIS = new Vector3(0, 1, 0)
const segDir = new Vector3()

/** bolt：鋸齒閃電鏈 —— 每幀重擲折點的圓柱鏈 + 電弧光暈 + 爆閃點光 */
function BoltVisual({ move }: VisualProps) {
  const SEGS = 6
  const segs = useRef<(Mesh | null)[]>([])
  const light = useRef<PointLight>(null)
  const pts = useMemo(() => Array.from({ length: SEGS + 1 }, () => new Vector3()), [])
  const glowMap = useMemo(() => getGlowTexture(), [])
  const jitterAt = useRef(0)

  useFrame(() => {
    const now = performance.now()
    // 每 45ms 重擲一次折線（太快會糊成毛球）
    if (now >= jitterAt.current) {
      jitterAt.current = now + 45
      for (let i = 0; i <= SEGS; i++) {
        const t = i / SEGS
        const amp = i === 0 ? 0 : 0.22
        pts[i].set((Math.random() - 0.5) * 2 * amp, (Math.random() - 0.5) * 2 * amp, -t * 1.5)
      }
      for (let i = 0; i < SEGS; i++) {
        const m = segs.current[i]
        if (!m) continue
        segDir.copy(pts[i + 1]).sub(pts[i])
        const len = segDir.length()
        m.position.copy(pts[i]).addScaledVector(segDir, 0.5)
        m.quaternion.setFromUnitVectors(Y_AXIS, segDir.normalize())
        m.scale.set(1, len, 1)
      }
    }
    if (light.current) light.current.intensity = 7 + Math.random() * 8
  })

  return (
    <group>
      {Array.from({ length: SEGS }, (_, i) => (
        <mesh key={i} ref={(el) => { segs.current[i] = el }}>
          <cylinderGeometry args={[0.045, 0.045, 1, 5]} />
          <meshBasicMaterial color="#fffbd0" toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.95} />
        </mesh>
      ))}
      {/* 電弧光暈：頭部大、尾部小 */}
      <sprite scale={[1.5, 1.5, 1]}>
        <spriteMaterial map={glowMap} color={move.color} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.85} />
      </sprite>
      <sprite position={[0, 0, -0.8]} scale={[0.9, 0.9, 1]}>
        <spriteMaterial map={glowMap} color="#aef2ff" blending={AdditiveBlending} depthWrite={false} transparent opacity={0.5} />
      </sprite>
      <pointLight ref={light} color={move.color} intensity={9} distance={8} decay={2} />
    </group>
  )
}

/** stars：3–5 顆金色星星繞飛行軸螺旋 + 亮片尾跡 */
function StarsVisual({ move }: VisualProps) {
  const stars = useRef<(Group | null)[]>([])
  const N = 4
  const glowMap = useMemo(() => getGlowTexture(), [])
  const geom = useMemo(() => getStarGeometry(5, 0.19, 0.08), [])

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    for (let i = 0; i < N; i++) {
      const g = stars.current[i]
      if (!g) continue
      const a = t * 9 + i * ((Math.PI * 2) / N)
      g.position.set(Math.cos(a) * 0.3, Math.sin(a) * 0.3, -i * 0.24)
      g.rotation.z += dt * 7
    }
  })

  return (
    <group>
      {Array.from({ length: N }, (_, i) => (
        <group key={i} ref={(el) => { stars.current[i] = el }}>
          <mesh geometry={geom}>
            <meshBasicMaterial color={toWhite(move.color, 0.35)} toneMapped={false} side={DoubleSide} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.95} />
          </mesh>
        </group>
      ))}
      <sprite scale={[1.1, 1.1, 1]}>
        <spriteMaterial map={glowMap} color={move.color} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.7} />
      </sprite>
      <sprite position={[0, 0, -0.9]} scale={[0.6, 0.6, 1]}>
        <spriteMaterial map={glowMap} color="#fff3b0" blending={AdditiveBlending} depthWrite={false} transparent opacity={0.4} />
      </sprite>
      <pointLight color={move.color} intensity={6} distance={6} decay={2} />
    </group>
  )
}

/** flame：拉長火舌 —— 圓錐核心 + 層疊火焰光暈閃爍（青焰用 MoveDef 顏色自然變藍白） */
function FlameVisual({ move }: VisualProps) {
  const sprites = useRef<(Group | null)[]>([])
  const rand = useMemo(() => makeRand(97), [])
  const layers = useMemo(() => Array.from({ length: 4 }, (_, i) => ({
    z: -0.25 - i * 0.32,
    base: 0.9 - i * 0.14,
    phase: rand() * 10,
  })), [rand])
  const glowMap = useMemo(() => getGlowTexture(), [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    for (let i = 0; i < layers.length; i++) {
      const g = sprites.current[i]
      if (!g) continue
      const L = layers[i]
      const s = L.base * (0.85 + Math.abs(Math.sin(t * 13 + L.phase)) * 0.45)
      g.scale.setScalar(s)
      g.position.set(Math.sin(t * 17 + L.phase) * 0.06, Math.cos(t * 15 + L.phase) * 0.06, L.z)
    }
  })

  return (
    <group>
      {/* 火舌核心：尖端朝前 */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.35]}>
        <coneGeometry args={[0.24, 1.5, 10]} />
        <meshBasicMaterial color={toWhite(move.color, 0.55)} toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.85} />
      </mesh>
      {layers.map((L, i) => (
        <group key={i} ref={(el) => { sprites.current[i] = el }} position={[0, 0, L.z]}>
          <sprite>
            <spriteMaterial map={glowMap} color={i % 2 === 0 ? move.color : toWhite(move.color, 0.4)} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.75} />
          </sprite>
        </group>
      ))}
      <pointLight color={move.color} intensity={8} distance={7} decay={2} />
    </group>
  )
}

/** wind：白青螺旋 —— 疊層圓環像鑽頭般向前旋轉 */
function WindVisual({ move }: VisualProps) {
  const rings = useRef<(Mesh | null)[]>([])
  const RINGS = [
    { r: 0.3, z: 0.05, spd: 12 },
    { r: 0.42, z: -0.35, spd: -9 },
    { r: 0.55, z: -0.78, spd: 7 },
  ]
  const glowMap = useMemo(() => getGlowTexture(), [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    for (let i = 0; i < RINGS.length; i++) {
      const m = rings.current[i]
      if (!m) continue
      m.rotation.z = t * RINGS[i].spd
      // 微橢圓讓旋轉讀得出來
      m.scale.set(1 + Math.sin(t * RINGS[i].spd) * 0.12, 1 - Math.sin(t * RINGS[i].spd) * 0.12, 1)
    }
  })

  return (
    <group>
      {RINGS.map((R, i) => (
        <mesh key={i} ref={(el) => { rings.current[i] = el }} position={[0, 0, R.z]}>
          <torusGeometry args={[R.r, 0.05, 8, 28]} />
          <meshBasicMaterial color={i === 0 ? '#ffffff' : move.color} toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.85 - i * 0.18} />
        </mesh>
      ))}
      <sprite scale={[0.9, 0.9, 1]}>
        <spriteMaterial map={glowMap} color="#e6feff" blending={AdditiveBlending} depthWrite={false} transparent opacity={0.55} />
      </sprite>
      <pointLight color={move.color} intensity={6} distance={6} decay={2} />
    </group>
  )
}

/** shuriken：水平高速自旋的四芒水裏劍 + 水珠尾跡 */
function ShurikenVisual({ move }: VisualProps) {
  const star = useRef<Mesh>(null)
  const geom = useMemo(() => getStarGeometry(4, 0.55, 0.15), [])
  const glowMap = useMemo(() => getGlowTexture(), [])

  useFrame((_, dt) => {
    if (star.current) star.current.rotation.z += dt * 26
  })

  return (
    <group>
      {/* 微傾的水平面：純水平從戰鬥鏡頭看會變一條線，傾 35° 讓四芒輪廓讀得出來 */}
      <group rotation={[-Math.PI / 2 + 0.6, 0, 0]}>
        <mesh ref={star} geometry={geom}>
          <meshBasicMaterial color={toWhite(move.color, 0.3)} toneMapped={false} side={DoubleSide} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.95} />
        </mesh>
      </group>
      <mesh>
        <sphereGeometry args={[0.11, 10, 10]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.9} />
      </mesh>
      {[0.35, 0.7, 1.05].map((z, i) => (
        <sprite key={i} position={[0, -0.05 * i, -z]} scale={[0.34 - i * 0.08, 0.34 - i * 0.08, 1]}>
          <spriteMaterial map={glowMap} color={move.color} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.55 - i * 0.14} />
        </sprite>
      ))}
      <pointLight color={move.color} intensity={5} distance={5} decay={2} />
    </group>
  )
}

/** aura：充能法球 —— 亮核心 + 波動外殼 + 流動尾跡（波導彈/暗影球/能量球家族，顏色跟招式走） */
function AuraVisual({ move }: VisualProps) {
  const shell = useRef<Mesh>(null)
  const glowMap = useMemo(() => getGlowTexture(), [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (shell.current) {
      const s = 1 + Math.sin(t * 11) * 0.16
      shell.current.scale.setScalar(s)
      shell.current.rotation.y = t * 3
    }
  })

  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.16, 14, 14]} />
        <meshBasicMaterial color={toWhite(move.color, 0.7)} toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={1} />
      </mesh>
      <mesh ref={shell}>
        <sphereGeometry args={[0.32, 18, 18]} />
        <meshBasicMaterial color={move.color} toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.35} wireframe />
      </mesh>
      <sprite scale={[1.4, 1.4, 1]}>
        <spriteMaterial map={glowMap} color={move.color} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.8} />
      </sprite>
      {[0.4, 0.8, 1.2, 1.6].map((z, i) => (
        <sprite key={i} position={[0, 0, -z]} scale={[0.5 - i * 0.09, 0.5 - i * 0.09, 1]}>
          <spriteMaterial map={glowMap} color={move.color} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.5 - i * 0.11} />
        </sprite>
      ))}
      <pointLight color={move.color} intensity={7} distance={7} decay={2} />
    </group>
  )
}

/** moon：粉色新月彗星 —— 出膛先長大再定型，彎月弧 + 柔光尾 */
function MoonVisual({ move }: VisualProps) {
  const root = useRef<Group>(null)
  const born = useMemo(() => performance.now(), [])
  const glowMap = useMemo(() => getGlowTexture(), [])

  useFrame((state) => {
    if (!root.current) return
    const age = (performance.now() - born) / 1000
    root.current.scale.setScalar(Math.min(1, 0.35 + age * 2.6))
    root.current.rotation.z = state.clock.elapsedTime * 2.4
  })

  return (
    <group ref={root}>
      {/* 新月：加粗 3/5 圓弧 torus（光暈縮小，弧形輪廓才不被 bloom 吃掉） */}
      <mesh>
        <torusGeometry args={[0.38, 0.12, 10, 28, Math.PI * 1.25]} />
        <meshBasicMaterial color={toWhite(move.color, 0.45)} toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.95} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.95} />
      </mesh>
      <sprite scale={[1.25, 1.25, 1]}>
        <spriteMaterial map={glowMap} color={move.color} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.7} />
      </sprite>
      {[0.5, 1.0].map((z, i) => (
        <sprite key={i} position={[0, 0, -z]} scale={[0.8 - i * 0.3, 0.8 - i * 0.3, 1]}>
          <spriteMaterial map={glowMap} color={move.color} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.4 - i * 0.15} />
        </sprite>
      ))}
      <pointLight color={move.color} intensity={7} distance={7} decay={2} />
    </group>
  )
}

/** beam：細長光束段列車（冰凍光束/加農光炮/水炮等，顏色跟招式走） */
function BeamVisual({ move }: VisualProps) {
  const glowMap = useMemo(() => getGlowTexture(), [])
  const SEGZ = [0, -0.95, -1.9, -2.85]
  return (
    <group>
      {SEGZ.map((z, i) => (
        <mesh key={i} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, z - 0.35]}>
          <cylinderGeometry args={[i === 0 ? 0.07 : 0.055, i === 0 ? 0.07 : 0.055, 0.75, 8]} />
          <meshBasicMaterial color={i === 0 ? toWhite(move.color, 0.6) : move.color} toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.95 - i * 0.18} />
        </mesh>
      ))}
      <sprite scale={[0.8, 0.8, 1]}>
        <spriteMaterial map={glowMap} color={move.color} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.75} />
      </sprite>
      <pointLight color={move.color} intensity={6} distance={6} decay={2} />
    </group>
  )
}

/** rock：三塊翻滾晶石 */
function RockVisual({ move }: VisualProps) {
  const chunks = useRef<(Mesh | null)[]>([])
  const rand = useMemo(() => makeRand(1337), [])
  const spins = useMemo(() => Array.from({ length: 3 }, () => ({
    x: 2 + rand() * 4, y: 2 + rand() * 4, ph: rand() * Math.PI * 2,
  })), [rand])
  const glowMap = useMemo(() => getGlowTexture(), [])

  useFrame((_, dt) => {
    for (let i = 0; i < 3; i++) {
      const m = chunks.current[i]
      if (!m) continue
      m.rotation.x += dt * spins[i].x
      m.rotation.y += dt * spins[i].y
    }
  })

  return (
    <group>
      {Array.from({ length: 3 }, (_, i) => {
        const a = spins[i].ph
        return (
          <mesh key={i} ref={(el) => { chunks.current[i] = el }} position={[Math.cos(a) * 0.24, Math.sin(a) * 0.24, -i * 0.2]}>
            <dodecahedronGeometry args={[i === 0 ? 0.2 : 0.15, 0]} />
            <meshStandardMaterial color={move.color} emissive={move.color} emissiveIntensity={1.4} roughness={0.4} metalness={0.3} toneMapped={false} />
          </mesh>
        )
      })}
      <sprite scale={[0.9, 0.9, 1]}>
        <spriteMaterial map={glowMap} color={move.color} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.45} />
      </sprite>
      <pointLight color={move.color} intensity={4} distance={5} decay={2} />
    </group>
  )
}

export const PROJECTILE_VISUALS: Record<MoveVisualId, ComponentType<VisualProps>> = {
  bolt: BoltVisual,
  stars: StarsVisual,
  flame: FlameVisual,
  wind: WindVisual,
  shuriken: ShurikenVisual,
  aura: AuraVisual,
  moon: MoonVisual,
  beam: BeamVisual,
  rock: RockVisual,
}

// ---------------------------------------------------------------------------
// 命中特效（FXLayer 依 fx.variant 分派；未指定 → 通用爆閃）
// ---------------------------------------------------------------------------

/** 特效生命週期：回傳 0..1，超時自動移除 */
function useFxLife(fx: BurstFx, ms: number, onFrame: (k: number) => void) {
  const dead = useRef(false)
  useFrame(() => {
    if (dead.current) return
    const k = (performance.now() - fx.at) / ms
    if (k >= 1) {
      dead.current = true
      useBattle.getState().removeFx(fx.id)
      return
    }
    onFrame(k)
  })
}

interface FxProps { fx: BurstFx }

/** 通用爆閃（beam / 射程耗盡） */
function GenericBurst({ fx }: FxProps) {
  const mesh = useRef<Mesh>(null)
  useFxLife(fx, 320, (k) => {
    if (!mesh.current) return
    mesh.current.scale.setScalar(fx.scale * (0.35 + k * 1.9))
    ;(mesh.current.material as MeshBasicMaterial).opacity = (1 - k) * 0.9
  })
  return (
    <mesh ref={mesh} position={fx.pos}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial color={fx.color} transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

/** bolt 命中：放射狀電火花 + 爆閃 */
function SparkBurst({ fx }: FxProps) {
  const root = useRef<Group>(null)
  const flash = useRef<Mesh>(null)
  const rand = useMemo(() => makeRand(fx.id * 7919 + 3), [fx.id])
  const dirs = useMemo(() => Array.from({ length: 9 }, () => {
    const v = new Vector3(rand() * 2 - 1, rand() * 1.6 - 0.3, rand() * 2 - 1)
    return v.lengthSq() < 0.01 ? v.set(1, 0.3, 0) : v.normalize()
  }), [rand])
  useFxLife(fx, 360, (k) => {
    if (root.current) {
      for (let i = 0; i < dirs.length; i++) {
        const m = root.current.children[i] as Mesh
        m.position.copy(dirs[i]).multiplyScalar(k * 1.9 * fx.scale)
        m.quaternion.setFromUnitVectors(Y_AXIS, dirs[i])
        m.scale.set(1 - k * 0.7, 1 - k * 0.6, 1 - k * 0.7)
        ;(m.material as MeshBasicMaterial).opacity = 1 - k
      }
    }
    if (flash.current) {
      flash.current.scale.setScalar(fx.scale * (0.3 + k * 1.2))
      ;(flash.current.material as MeshBasicMaterial).opacity = Math.max(0, 0.9 - k * 2.2)
    }
  })
  return (
    <group position={fx.pos}>
      <group ref={root}>
        {dirs.map((_, i) => (
          <mesh key={i}>
            <cylinderGeometry args={[0.03, 0.008, 0.55, 4]} />
            <meshBasicMaterial color="#fff9c0" toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={1} />
          </mesh>
        ))}
      </group>
      <mesh ref={flash}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial color={fx.color} toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.9} />
      </mesh>
    </group>
  )
}

/** stars 命中：星星四散彈跳 */
function StarPop({ fx }: FxProps) {
  const root = useRef<Group>(null)
  const geom = useMemo(() => getStarGeometry(5, 0.16, 0.07), [])
  const rand = useMemo(() => makeRand(fx.id * 6151 + 11), [fx.id])
  const dirs = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 + rand()
    return new Vector3(Math.cos(a), 0.5 + rand() * 0.7, Math.sin(a)).normalize()
  }), [rand])
  useFxLife(fx, 420, (k) => {
    if (!root.current) return
    for (let i = 0; i < dirs.length; i++) {
      const m = root.current.children[i] as Mesh
      m.position.copy(dirs[i]).multiplyScalar(k * 1.6)
      m.position.y -= k * k * 0.8
      m.rotation.z = k * 9 + i
      ;(m.material as MeshBasicMaterial).opacity = 1 - k
    }
  })
  return (
    <group ref={root} position={fx.pos}>
      {dirs.map((_, i) => (
        <mesh key={i} geometry={geom}>
          <meshBasicMaterial color={fx.color} toneMapped={false} side={DoubleSide} blending={AdditiveBlending} depthWrite={false} transparent opacity={1} />
        </mesh>
      ))}
    </group>
  )
}

/** flame 命中：火焰綻放（三層球體錯峰膨脹 + 上飄） */
function FireBlossom({ fx }: FxProps) {
  const root = useRef<Group>(null)
  useFxLife(fx, 460, (k) => {
    if (!root.current) return
    for (let i = 0; i < 3; i++) {
      const m = root.current.children[i] as Mesh
      const kk = Math.max(0, Math.min(1, k * 1.5 - i * 0.22))
      m.scale.setScalar(0.15 + kk * (1.5 - i * 0.35) * fx.scale)
      m.position.y = kk * (0.5 + i * 0.25)
      ;(m.material as MeshBasicMaterial).opacity = kk >= 1 ? 0 : (1 - kk) * 0.8
    }
  })
  const cols = [toWhite(fx.color, 0.5), fx.color, '#c2452a']
  return (
    <group ref={root} position={fx.pos}>
      {cols.map((c, i) => (
        <mesh key={i}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshBasicMaterial color={c} toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  )
}

/** wind 命中：環形衝擊波 */
function RingShockwave({ fx }: FxProps) {
  const ring = useRef<Mesh>(null)
  const core = useRef<Mesh>(null)
  useFxLife(fx, 380, (k) => {
    if (ring.current) {
      ring.current.scale.setScalar(0.35 + k * 2.6 * fx.scale)
      ;(ring.current.material as MeshBasicMaterial).opacity = (1 - k) * 0.9
    }
    if (core.current) {
      core.current.scale.setScalar(0.2 + k * 0.9)
      ;(core.current.material as MeshBasicMaterial).opacity = Math.max(0, 0.7 - k * 1.6)
    }
  })
  return (
    <group position={fx.pos}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.07, 8, 36]} />
        <meshBasicMaterial color="#e6feff" toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.9} side={DoubleSide} />
      </mesh>
      <mesh ref={core}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial color={fx.color} toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.7} />
      </mesh>
    </group>
  )
}

/** shuriken 命中：水花四濺 + 水環 */
function WaterSplash({ fx }: FxProps) {
  const root = useRef<Group>(null)
  const ring = useRef<Mesh>(null)
  const rand = useMemo(() => makeRand(fx.id * 4409 + 29), [fx.id])
  const vels = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * Math.PI * 2 + rand()
    return new Vector3(Math.cos(a) * (0.8 + rand()), 1.6 + rand() * 1.2, Math.sin(a) * (0.8 + rand()))
  }), [rand])
  useFxLife(fx, 470, (k) => {
    if (root.current) {
      for (let i = 0; i < vels.length; i++) {
        const m = root.current.children[i] as Mesh
        m.position.set(vels[i].x * k, vels[i].y * k - 2.6 * k * k, vels[i].z * k)
        ;(m.material as MeshBasicMaterial).opacity = 1 - k
      }
    }
    if (ring.current) {
      ring.current.scale.setScalar(0.3 + k * 1.8)
      ;(ring.current.material as MeshBasicMaterial).opacity = (1 - k) * 0.7
    }
  })
  return (
    <group position={fx.pos}>
      <group ref={root}>
        {vels.map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.075, 8, 8]} />
            <meshBasicMaterial color={toWhite(fx.color, 0.35)} toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={1} />
          </mesh>
        ))}
      </group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.06, 8, 30]} />
        <meshBasicMaterial color={fx.color} toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.7} side={DoubleSide} />
      </mesh>
    </group>
  )
}

/** aura 命中：先內縮再爆開 */
function ImplosionBurst({ fx }: FxProps) {
  const shell = useRef<Mesh>(null)
  const burst = useRef<Mesh>(null)
  useFxLife(fx, 460, (k) => {
    const inK = Math.min(1, k / 0.32)
    const outK = Math.max(0, (k - 0.32) / 0.68)
    if (shell.current) {
      shell.current.scale.setScalar(Math.max(0.05, (1.3 - inK * 1.15) * fx.scale))
      ;(shell.current.material as MeshBasicMaterial).opacity = k < 0.32 ? 0.75 : 0
    }
    if (burst.current) {
      burst.current.scale.setScalar(0.05 + outK * 2.3 * fx.scale)
      ;(burst.current.material as MeshBasicMaterial).opacity = outK > 0 ? (1 - outK) * 0.95 : 0
    }
  })
  return (
    <group position={fx.pos}>
      <mesh ref={shell}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={fx.color} toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.75} wireframe />
      </mesh>
      <mesh ref={burst}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={toWhite(fx.color, 0.4)} toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0} />
      </mesh>
    </group>
  )
}

/** moon 命中：柔光花瓣綻放 */
function BloomFlower({ fx }: FxProps) {
  const root = useRef<Group>(null)
  const core = useRef<Mesh>(null)
  const N = 5
  useFxLife(fx, 500, (k) => {
    if (root.current) {
      for (let i = 0; i < N; i++) {
        const m = root.current.children[i] as Mesh
        const a = (i / N) * Math.PI * 2 + k * 1.2
        m.position.set(Math.cos(a) * k * 1.3, Math.sin(a) * k * 1.3, 0)
        m.scale.setScalar(0.25 + k * 0.5)
        ;(m.material as MeshBasicMaterial).opacity = (1 - k) * 0.85
      }
      root.current.rotation.y = k * 0.8
    }
    if (core.current) {
      core.current.scale.setScalar(0.3 + k * 1.4)
      ;(core.current.material as MeshBasicMaterial).opacity = (1 - k) * 0.6
    }
  })
  return (
    <group position={fx.pos}>
      <group ref={root}>
        {Array.from({ length: N }, (_, i) => (
          <mesh key={i} scale={[1, 0.55, 1]}>
            <sphereGeometry args={[1, 10, 10]} />
            <meshBasicMaterial color={toWhite(fx.color, 0.3)} toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.85} />
          </mesh>
        ))}
      </group>
      <mesh ref={core}>
        <sphereGeometry args={[1, 14, 14]} />
        <meshBasicMaterial color={fx.color} toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.6} />
      </mesh>
    </group>
  )
}

/** rock 命中：碎石飛散（含重力 + 翻滾） */
function ShardScatter({ fx }: FxProps) {
  const root = useRef<Group>(null)
  const rand = useMemo(() => makeRand(fx.id * 2741 + 17), [fx.id])
  const vels = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 + rand()
    return new Vector3(Math.cos(a) * (1 + rand()), 1.4 + rand() * 1.4, Math.sin(a) * (1 + rand()))
  }), [rand])
  useFxLife(fx, 520, (k) => {
    if (!root.current) return
    for (let i = 0; i < vels.length; i++) {
      const m = root.current.children[i] as Mesh
      m.position.set(vels[i].x * k, vels[i].y * k - 3 * k * k, vels[i].z * k)
      m.rotation.x = k * (5 + i)
      m.rotation.y = k * (4 + i)
      ;(m.material as MeshBasicMaterial).opacity = Math.min(1, (1 - k) * 1.6)
    }
  })
  return (
    <group ref={root} position={fx.pos}>
      {vels.map((_, i) => (
        <mesh key={i}>
          <tetrahedronGeometry args={[0.12 + (i % 3) * 0.04, 0]} />
          <meshBasicMaterial color={fx.color} toneMapped={false} transparent opacity={1} />
        </mesh>
      ))}
    </group>
  )
}

const IMPACT_FX: Record<MoveVisualId, ComponentType<FxProps>> = {
  bolt: SparkBurst,
  stars: StarPop,
  flame: FireBlossom,
  wind: RingShockwave,
  shuriken: WaterSplash,
  aura: ImplosionBurst,
  moon: BloomFlower,
  beam: GenericBurst,
  rock: ShardScatter,
}

export function ImpactFxRenderer({ fx }: FxProps) {
  const C = (fx.variant && IMPACT_FX[fx.variant as MoveVisualId]) || GenericBurst
  return <C fx={fx} />
}

// ---------------------------------------------------------------------------
// 近戰斬擊特效（依 fx.variant = SlashVariant 分派）
// ---------------------------------------------------------------------------

const SLASH_MS = 240

/** 單弧（原版）：水平弧段展開 + 淡出；tilt/yOff/thick 供變體重用 */
function ArcMesh({ color, tilt = 0, yOff = 0, thick = 0.09, arc = (Math.PI * 2) / 3, opacity = 0.95 }: {
  color: string; tilt?: number; yOff?: number; thick?: number; arc?: number; opacity?: number
}) {
  return (
    <mesh position={[0, yOff, 0]} rotation={[-Math.PI / 2 + tilt, 0, Math.PI / 2 - arc / 2]}>
      <torusGeometry args={[1.15, thick, 8, 32, arc]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} blending={AdditiveBlending} depthWrite={false} toneMapped={false} side={DoubleSide} />
    </mesh>
  )
}

function useSlashLife(fx: BurstFx, root: React.RefObject<Group | null>, ms = SLASH_MS) {
  useFxLife(fx, ms, (k) => {
    const g = root.current
    if (!g) return
    g.scale.setScalar(0.7 + k * 1.1)
    g.traverse((o) => {
      const m = (o as Mesh).material as MeshBasicMaterial | undefined
      if (m && 'opacity' in m) m.opacity = (1 - k) * 0.95
    })
  })
}

/** arc：白色單弧（一般系近戰） */
function SlashArc({ fx }: FxProps) {
  const root = useRef<Group>(null)
  useSlashLife(fx, root)
  return (
    <group ref={root} position={fx.pos} rotation={[0, fx.angle, 0]}>
      <ArcMesh color={fx.color} />
    </group>
  )
}

/** cross：交叉雙斬（格鬥 / 鋼） */
function SlashCross({ fx }: FxProps) {
  const root = useRef<Group>(null)
  useSlashLife(fx, root, 280)
  return (
    <group ref={root} position={fx.pos} rotation={[0, fx.angle, 0]}>
      <ArcMesh color={fx.color} tilt={0.6} thick={0.08} />
      <ArcMesh color={toWhite(fx.color, 0.5)} tilt={-0.6} thick={0.08} />
    </group>
  )
}

/** flamearc：火焰弧（雙層橙黃 + 較粗） */
function SlashFlameArc({ fx }: FxProps) {
  const root = useRef<Group>(null)
  useSlashLife(fx, root, 300)
  return (
    <group ref={root} position={fx.pos} rotation={[0, fx.angle, 0]}>
      <ArcMesh color={fx.color} thick={0.13} />
      <ArcMesh color="#ffd75e" yOff={0.12} thick={0.07} arc={Math.PI / 2} />
      <ArcMesh color="#fff3b0" yOff={-0.08} thick={0.05} arc={Math.PI / 2.4} />
    </group>
  )
}

/** claws：三道寬爪痕（龍） */
function SlashClaws({ fx }: FxProps) {
  const root = useRef<Group>(null)
  useSlashLife(fx, root, 300)
  return (
    <group ref={root} position={fx.pos} rotation={[0, fx.angle, 0]}>
      <ArcMesh color={fx.color} yOff={0.22} tilt={0.28} thick={0.06} arc={Math.PI * 0.85} />
      <ArcMesh color={toWhite(fx.color, 0.35)} yOff={0} tilt={0.28} thick={0.06} arc={Math.PI * 0.85} />
      <ArcMesh color={fx.color} yOff={-0.22} tilt={0.28} thick={0.06} arc={Math.PI * 0.85} />
    </group>
  )
}

/** rings：擴散同心環（超能力） */
function SlashRings({ fx }: FxProps) {
  const root = useRef<Group>(null)
  useFxLife(fx, 340, (k) => {
    const g = root.current
    if (!g) return
    for (let i = 0; i < 3; i++) {
      const m = g.children[i] as Mesh
      const kk = Math.max(0, Math.min(1, k * 1.6 - i * 0.22))
      m.scale.setScalar(0.3 + kk * 1.9)
      ;(m.material as MeshBasicMaterial).opacity = kk >= 1 ? 0 : (1 - kk) * 0.85
    }
  })
  return (
    <group ref={root} position={fx.pos} rotation={[0, fx.angle, 0]}>
      {Array.from({ length: 3 }, (_, i) => (
        <mesh key={i}>
          <torusGeometry args={[1, 0.055, 8, 32]} />
          <meshBasicMaterial color={i === 1 ? toWhite(fx.color, 0.45) : fx.color} transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} toneMapped={false} side={DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

const SLASH_FX: Record<SlashVariant, ComponentType<FxProps>> = {
  arc: SlashArc,
  cross: SlashCross,
  flamearc: SlashFlameArc,
  claws: SlashClaws,
  rings: SlashRings,
}

export function SlashFxRenderer({ fx }: FxProps) {
  const C = (fx.variant && SLASH_FX[fx.variant as SlashVariant]) || SlashArc
  return <C fx={fx} />
}
