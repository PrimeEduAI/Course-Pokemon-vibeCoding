'use client'
import { Environment, Stars } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  PlaneGeometry,
  PointLight,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { ellipseRing, type Tier } from './geometry'
import { getBeamAlphaMap } from '../beamTexture'
import Crowd from './Crowd'
import type { FieldType } from './types'

/**
 * Gen 5 因幡大會（合眾聯盟）：
 * 夜間山頂石造大競技場 —— 巨階梯通往山頂神殿剪影、
 * 四座主題發光塔（鬼火圖書館 / 格鬥鐵籠 / 暗金哥德廳 / 超能夢境穹頂）、
 * 劇場級金 / 紫聚光燈束、火盆、地面符文徽章。
 */

const G5_TIERS: Tier[] = [
  { aIn: 25.0, bIn: 17.5, yBase: 2.2, depth: 7.0, rise: 3.2, rows: 10 },
  { aIn: 32.8, bIn: 25.3, yBase: 6.2, depth: 7.5, rise: 3.8, rows: 11 },
]
const RIM_A = G5_TIERS[1].aIn + G5_TIERS[1].depth // 40.3
const RIM_B = G5_TIERS[1].bIn + G5_TIERS[1].depth // 32.8
const RIM_Y = G5_TIERS[1].yBase + G5_TIERS[1].rise // 10.0
const RAIL_TOP = RIM_Y + 1.4

const GOLD = '#d8a84a'
const STONE_SLOPE_A = '#57534a'
const STONE_SLOPE_B = '#4d4a42'
const STONE_WALL = '#3d3a34'

/** 決定性偽隨機 */
function gen5Rng(seed: number) {
  let s = (seed * 2654435761) % 4294967296
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/* ---------- 夜空 + 月 + 遠山 ---------- */

function gen5MakeSky(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 512
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 512)
  grad.addColorStop(0, '#03040c')
  grad.addColorStop(0.5, '#0a0c22')
  grad.addColorStop(0.76, '#1a1540')
  grad.addColorStop(0.9, '#332457')
  grad.addColorStop(1, '#463067')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 512)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function gen5MakeMountains(): CanvasTexture {
  const W = 1024
  const H = 256
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.clearRect(0, 0, W, H)
  const grad = g.createLinearGradient(0, 40, 0, H)
  grad.addColorStop(0, '#181430')
  grad.addColorStop(1, '#241c40')
  g.fillStyle = grad
  g.beginPath()
  g.moveTo(0, H)
  let y = 128
  g.lineTo(0, y)
  const peaks = 12
  for (let i = 1; i <= peaks; i++) {
    const x = (i / peaks) * W
    y = i === peaks ? 128 : 50 + ((i * 83) % 105)
    g.lineTo(x - W / peaks / 2, y)
    g.lineTo(x, Math.min(205, y + 52 + ((i * 37) % 44)))
  }
  g.lineTo(W, H)
  g.closePath()
  g.fill()
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.repeat.x = 3
  return tex
}

function gen5MakeGlow(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,0.9)')
  grad.addColorStop(0.35, 'rgba(210,215,255,0.32)')
  grad.addColorStop(1, 'rgba(180,190,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new CanvasTexture(c)
}

function Gen5NightSky() {
  const sky = useMemo(() => gen5MakeSky(), [])
  const mountains = useMemo(() => gen5MakeMountains(), [])
  const glow = useMemo(() => gen5MakeGlow(), [])
  return (
    <>
      <color attach="background" args={['#07081a']} />
      <fog attach="fog" args={['#0b0c20', 90, 280]} />
      <Stars radius={300} depth={60} count={4200} factor={5.2} saturation={0} fade speed={0.4} />
      <mesh>
        <sphereGeometry args={[250, 24, 16]} />
        <meshBasicMaterial map={sky} side={BackSide} fog={false} depthWrite={false} />
      </mesh>
      {/* 滿月 + 月暈 */}
      <group position={[64, 66, -165]} onUpdate={(g: Group) => g.lookAt(0, 20, 0)}>
        <mesh>
          <circleGeometry args={[7, 32]} />
          <meshBasicMaterial color={[1.6, 1.7, 2.1]} toneMapped={false} fog={false} />
        </mesh>
        <mesh position={[0, 0, -0.5]}>
          <planeGeometry args={[46, 46]} />
          <meshBasicMaterial
            map={glow}
            transparent
            blending={AdditiveBlending}
            depthWrite={false}
            fog={false}
            opacity={0.8}
          />
        </mesh>
      </group>
      {/* 遠山剪影環 */}
      <mesh position={[0, 12, 0]}>
        <cylinderGeometry args={[210, 210, 52, 48, 1, true]} />
        <meshBasicMaterial map={mountains} transparent alphaTest={0.5} side={BackSide} fog={false} />
      </mesh>
      {/* 山頂岩地（塔與階梯的地面） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.62, 0]}>
        <circleGeometry args={[190, 40]} />
        <meshStandardMaterial color="#15131f" roughness={1} />
      </mesh>
    </>
  )
}

/* ---------- 石造看台 ---------- */

function Gen5Stands() {
  const geos = useMemo(() => {
    const slopes: BufferGeometry[] = []
    const walls: BufferGeometry[] = []
    const trims: BufferGeometry[] = []
    let prevAOut = G5_TIERS[0].aIn
    let prevBOut = G5_TIERS[0].bIn
    let prevYTop = -0.5
    for (const t of G5_TIERS) {
      const aOut = t.aIn + t.depth
      const bOut = t.bIn + t.depth
      const yTop = t.yBase + t.rise
      walls.push(ellipseRing(prevAOut, prevBOut, prevYTop, t.aIn, t.bIn, t.yBase))
      slopes.push(ellipseRing(t.aIn, t.bIn, t.yBase, aOut, bOut, yTop))
      trims.push(ellipseRing(t.aIn - 0.04, t.bIn - 0.04, t.yBase - 0.45, t.aIn - 0.04, t.bIn - 0.04, t.yBase))
      prevAOut = aOut
      prevBOut = bOut
      prevYTop = yTop
    }
    walls.push(ellipseRing(RIM_A, RIM_B, RIM_Y, RIM_A, RIM_B, RAIL_TOP))
    trims.push(ellipseRing(RIM_A + 0.02, RIM_B + 0.02, RAIL_TOP - 0.4, RIM_A + 0.02, RIM_B + 0.02, RAIL_TOP))
    return { slopes, walls, trims }
  }, [])

  return (
    <group>
      {geos.slopes.map((g, i) => (
        <mesh key={`s${i}`} geometry={g}>
          <meshStandardMaterial color={i % 2 === 0 ? STONE_SLOPE_A : STONE_SLOPE_B} roughness={0.95} side={DoubleSide} />
        </mesh>
      ))}
      {geos.walls.map((g, i) => (
        <mesh key={`w${i}`} geometry={g}>
          <meshStandardMaterial color={STONE_WALL} roughness={0.92} side={DoubleSide} />
        </mesh>
      ))}
      {/* 金色飾帶：微自發光，讓夜裡的石場有「劇場鑲邊」 */}
      {geos.trims.map((g, i) => (
        <mesh key={`t${i}`} geometry={g}>
          <meshStandardMaterial
            color={GOLD}
            emissive={GOLD}
            emissiveIntensity={0.55}
            roughness={0.5}
            side={DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}

/* ---------- 巨階梯 + 山頂神殿剪影 ---------- */

function Gen5SummitTemple() {
  const steps = useMemo(() => {
    const N = 24
    const m = new InstancedMesh(
      new BoxGeometry(26, 1.15, 2.6),
      new MeshStandardMaterial({ color: '#332f3c', roughness: 0.96 }),
      N,
    )
    const m4 = new Matrix4()
    for (let i = 0; i < N; i++) {
      m4.makeTranslation(0, 4.4 + i * 1.05, -43.5 - i * 2.3)
      m.setMatrixAt(i, m4)
    }
    m.instanceMatrix.needsUpdate = true
    m.frustumCulled = false
    return m
  }, [])

  const pylons = useMemo(() => {
    const N = 12
    const m = new InstancedMesh(
      new BoxGeometry(1.1, 3.4, 1.1),
      new MeshStandardMaterial({ color: '#2a2734', roughness: 0.95 }),
      N,
    )
    const m4 = new Matrix4()
    for (let i = 0; i < N; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const k = Math.floor(i / 2)
      m4.makeTranslation(side * 14.2, 6.2 + k * 4.4, -46 - k * 9.4)
      m.setMatrixAt(i, m4)
    }
    m.instanceMatrix.needsUpdate = true
    m.frustumCulled = false
    return m
  }, [])

  // 塔尖火光（instanced 小燈球，走 bloom）
  const pylonLights = useMemo(() => {
    const N = 12
    const m = new InstancedMesh(
      new BoxGeometry(0.42, 0.42, 0.42),
      new MeshBasicMaterial({ color: new Color(2.6, 1.7, 0.6), toneMapped: false }),
      N,
    )
    const m4 = new Matrix4()
    for (let i = 0; i < N; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const k = Math.floor(i / 2)
      m4.makeTranslation(side * 14.2, 8.15 + k * 4.4, -46 - k * 9.4)
      m.setMatrixAt(i, m4)
    }
    m.instanceMatrix.needsUpdate = true
    m.frustumCulled = false
    return m
  }, [])

  const columns = useMemo(() => {
    const N = 8
    const m = new InstancedMesh(
      new CylinderGeometry(0.95, 1.1, 9, 10),
      new MeshStandardMaterial({ color: '#232030', roughness: 0.92 }),
      N,
    )
    const m4 = new Matrix4()
    for (let i = 0; i < N; i++) {
      m4.makeTranslation(-12.6 + i * 3.6, 34.2, -101)
      m.setMatrixAt(i, m4)
    }
    m.instanceMatrix.needsUpdate = true
    m.frustumCulled = false
    return m
  }, [])

  return (
    <group>
      <primitive object={steps} />
      <primitive object={pylons} />
      <primitive object={pylonLights} />
      {/* 神殿平台 */}
      <mesh position={[0, 29.2, -104]}>
        <boxGeometry args={[34, 2.2, 16]} />
        <meshStandardMaterial color="#282436" roughness={0.95} />
      </mesh>
      <primitive object={columns} />
      {/* 楣樑 + 屋頂剪影 */}
      <mesh position={[0, 39.4, -103]}>
        <boxGeometry args={[30, 1.5, 12]} />
        <meshStandardMaterial color="#201d2c" roughness={0.95} />
      </mesh>
      <mesh position={[0, 41.9, -103]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, 0.42]}>
        <coneGeometry args={[17, 4.6, 4]} />
        <meshStandardMaterial color="#1a1726" roughness={0.95} flatShading />
      </mesh>
      {/* 神殿門洞的金光 */}
      <mesh position={[0, 32.6, -95.9]}>
        <planeGeometry args={[4.6, 6.4]} />
        <meshBasicMaterial color={[2.8, 1.9, 0.7]} toneMapped={false} fog={false} />
      </mesh>
    </group>
  )
}

/* ---------- 四座主題塔 ---------- */

function gen5MakeWindowTex(
  draw: (g: CanvasRenderingContext2D, W: number, H: number) => void,
): CanvasTexture {
  const W = 256
  const H = 512
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.clearRect(0, 0, W, H)
  draw(g, W, H)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  return tex
}

/** 鬼系圖書館塔：圓塔 + 尖頂 + 成排拱窗（燭光閃爍） */
function gen5GhostWindows(): CanvasTexture {
  return gen5MakeWindowTex((g, W, H) => {
    g.fillStyle = '#c890ff'
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 4; col++) {
        const x = 22 + col * 58
        const y = 60 + row * 86
        g.beginPath()
        g.moveTo(x, y + 34)
        g.lineTo(x, y + 10)
        g.arc(x + 11, y + 10, 11, Math.PI, 0)
        g.lineTo(x + 22, y + 34)
        g.closePath()
        g.fill()
      }
    }
  })
}

/** 格鬥鐵籠塔：紅色柵欄窗 */
function gen5FightWindows(): CanvasTexture {
  return gen5MakeWindowTex((g, W, H) => {
    g.fillStyle = '#ff5040'
    for (let row = 0; row < 4; row++) {
      const y = 60 + row * 110
      g.fillRect(30, y, 196, 52)
    }
    // 柵欄豎條（挖黑）
    g.globalCompositeOperation = 'destination-out'
    for (let i = 0; i < 8; i++) g.fillRect(44 + i * 24, 0, 8, H)
    g.globalCompositeOperation = 'source-over'
  })
}

/** 暗金哥德廳：尖拱長窗 */
function gen5GothicWindows(): CanvasTexture {
  return gen5MakeWindowTex((g) => {
    g.fillStyle = '#ffc860'
    for (let col = 0; col < 3; col++) {
      const x = 30 + col * 74
      const y = 120
      g.beginPath()
      g.moveTo(x, y + 260)
      g.lineTo(x, y + 60)
      g.quadraticCurveTo(x + 21, y - 40, x + 42, y + 60)
      g.lineTo(x + 42, y + 260)
      g.closePath()
      g.fill()
    }
  })
}

interface Gen5TowerRefs {
  ghost: MeshBasicMaterial | null
  fight: MeshBasicMaterial | null
  gothic: MeshBasicMaterial | null
  dome: MeshStandardMaterial | null
}

function Gen5Towers() {
  const refs = useRef<Gen5TowerRefs>({ ghost: null, fight: null, gothic: null, dome: null })
  const ghostTex = useMemo(() => gen5GhostWindows(), [])
  const fightTex = useMemo(() => gen5FightWindows(), [])
  const gothicTex = useMemo(() => gen5GothicWindows(), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const r = refs.current
    // 鬼塔：燭光閃爍（多頻疊加）
    if (r.ghost) {
      const f = 0.62 + 0.22 * Math.sin(t * 7.3) * Math.sin(t * 3.1) + 0.16 * Math.sin(t * 13.7)
      r.ghost.color.setRGB(1.1 * f, 0.55 * f, 2.0 * f)
    }
    // 格鬥塔：硬 strobe
    if (r.fight) {
      const on = Math.sin(t * 5.2) > 0.55 || Math.sin(t * 17.3) > 0.9 ? 1 : 0.16
      r.fight.color.setRGB(2.4 * on, 0.34 * on, 0.22 * on)
    }
    // 哥德廳：穩定暖金微呼吸
    if (r.gothic) {
      const f = 0.9 + 0.1 * Math.sin(t * 1.7)
      r.gothic.color.setRGB(1.9 * f, 1.25 * f, 0.42 * f)
    }
    // 夢境穹頂：慢速脈動
    if (r.dome) r.dome.emissiveIntensity = 0.5 + 0.42 * (0.5 + 0.5 * Math.sin(t * 0.9))
  })

  return (
    <group>
      {/* 鬼系圖書館塔（右後，戰鬥鏡頭可見） */}
      <group position={[38, 0, -31]} scale={1.5}>
        <mesh position={[0, 8.5, 0]}>
          <cylinderGeometry args={[3.4, 3.9, 17, 12]} />
          <meshStandardMaterial color="#241f33" roughness={0.9} />
        </mesh>
        <mesh position={[0, 8.5, 0]}>
          <cylinderGeometry args={[3.48, 3.48, 15.6, 12, 1, true]} />
          <meshBasicMaterial
            ref={(m) => { refs.current.ghost = m }}
            map={ghostTex}
            transparent
            toneMapped={false}
            fog={false}
            side={DoubleSide}
          />
        </mesh>
        <mesh position={[0, 19.6, 0]}>
          <coneGeometry args={[4.2, 6.4, 12]} />
          <meshStandardMaterial color="#1c1830" roughness={0.9} />
        </mesh>
        <mesh position={[0, 23.4, 0]}>
          <sphereGeometry args={[0.5, 8, 8]} />
          <meshBasicMaterial color={[1.5, 0.7, 2.6]} toneMapped={false} />
        </mesh>
      </group>

      {/* 格鬥鐵籠塔（右後內側） */}
      <group position={[21, 0, -46]} scale={1.35}>
        <mesh position={[0, 7, 0]}>
          <boxGeometry args={[6.4, 14, 6.4]} />
          <meshStandardMaterial color="#33201c" roughness={0.9} />
        </mesh>
        <mesh position={[0, 7, 0]}>
          <cylinderGeometry args={[4.62, 4.62, 12.6, 4, 1, true]} />
          <meshBasicMaterial
            ref={(m) => { refs.current.fight = m }}
            map={fightTex}
            transparent
            toneMapped={false}
            fog={false}
            side={DoubleSide}
          />
        </mesh>
        {/* 鐵籠環 */}
        {[4.2, 8.2, 12.2].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[4.9, 0.22, 6, 20]} />
            <meshStandardMaterial color="#5a4a42" metalness={0.7} roughness={0.5} />
          </mesh>
        ))}
        <mesh position={[0, 14.8, 0]}>
          <boxGeometry args={[7.2, 1.6, 7.2]} />
          <meshStandardMaterial color="#241612" roughness={0.9} />
        </mesh>
      </group>

      {/* 暗金哥德廳（左後，戰鬥鏡頭可見） */}
      <group position={[-38, 0, -31]} scale={1.45}>
        <mesh position={[0, 6, 0]}>
          <boxGeometry args={[10, 12, 8]} />
          <meshStandardMaterial color="#26200f" roughness={0.92} />
        </mesh>
        <mesh position={[0, 6.3, 4.02]}>
          <planeGeometry args={[9.2, 11]} />
          <meshBasicMaterial
            ref={(m) => { refs.current.gothic = m }}
            map={gothicTex}
            transparent
            toneMapped={false}
            fog={false}
          />
        </mesh>
        <mesh position={[0, 14.2, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, 0.55]}>
          <coneGeometry args={[7.6, 5.2, 4]} />
          <meshStandardMaterial color="#1b1708" roughness={0.92} flatShading />
        </mesh>
        <mesh position={[0, 17.6, 0]}>
          <boxGeometry args={[0.5, 2.2, 0.5]} />
          <meshBasicMaterial color={[2.2, 1.5, 0.5]} toneMapped={false} />
        </mesh>
      </group>

      {/* 超能夢境穹頂（左後內側） */}
      <group position={[-21, 0, -46]} scale={1.55}>
        <mesh position={[0, 3.4, 0]}>
          <cylinderGeometry args={[5.2, 5.8, 6.8, 14]} />
          <meshStandardMaterial color="#2c2138" roughness={0.85} />
        </mesh>
        <mesh position={[0, 6.8, 0]}>
          <sphereGeometry args={[5.2, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            ref={(m) => { refs.current.dome = m }}
            color="#5a3a5c"
            emissive="#ff7ad2"
            emissiveIntensity={0.7}
            roughness={0.35}
          />
        </mesh>
        <mesh position={[0, 12.6, 0]}>
          <sphereGeometry args={[0.55, 8, 8]} />
          <meshBasicMaterial color={[2.2, 1.0, 2.0]} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

/* ---------- 劇場聚光燈束（金 / 紫，緩慢掃場） ---------- */

const G5_BEAM_COUNT = 6

function Gen5SpotBeams() {
  const refs = useRef<(Group | null)[]>([])

  const beams = useMemo(() => {
    const geo = new CylinderGeometry(2.0, 0.3, 30, 12, 1, true)
    geo.translate(0, 15, 0)
    return Array.from({ length: G5_BEAM_COUNT }, (_, i) => {
      const ang = (i / G5_BEAM_COUNT) * Math.PI * 2 + Math.PI / 6
      return {
        geo,
        pos: [Math.cos(ang) * (RIM_A - 2), RAIL_TOP + 1.2, Math.sin(ang) * (RIM_B - 2)] as [number, number, number],
        baseYaw: -Math.PI / 2 - ang,
        color: (i % 2 === 0 ? [2.2, 1.55, 0.5] : [1.5, 0.7, 2.3]) as [number, number, number],
        phase: i * 1.31,
        speed: 0.22 + (i % 3) * 0.06,
      }
    })
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    refs.current.forEach((g, i) => {
      if (!g) return
      const b = beams[i]
      g.rotation.order = 'YXZ'
      g.rotation.y = b.baseYaw + Math.sin(t * b.speed + b.phase) * 1.05
      g.rotation.x = 2.2 + Math.sin(t * b.speed * 0.71 + b.phase * 1.9) * 0.24
    })
  })

  return (
    <group>
      {beams.map((b, i) => (
        <group key={i} position={b.pos} ref={(el) => { refs.current[i] = el }}>
          <mesh geometry={b.geo}>
            <meshBasicMaterial
              color={b.color}
              transparent
              opacity={0.5}
              alphaMap={getBeamAlphaMap()}
              blending={AdditiveBlending}
              depthWrite={false}
              fog={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* ---------- 火盆（場邊四角，火焰動畫幀 + 閃爍光） ---------- */

function gen5MakeFlameSheet(): CanvasTexture {
  const FRAMES = 8
  const FW = 96
  const FH = 192
  const c = document.createElement('canvas')
  c.width = FRAMES * FW
  c.height = FH
  const g = c.getContext('2d')!
  g.clearRect(0, 0, c.width, c.height)
  const tongue = (ox: number, cx: number, baseY: number, w: number, h: number, color: string, alpha: number) => {
    g.globalAlpha = alpha
    g.fillStyle = color
    g.beginPath()
    g.moveTo(ox + cx, baseY - h)
    g.bezierCurveTo(ox + cx + w * 0.72, baseY - h * 0.55, ox + cx + w * 0.62, baseY - h * 0.08, ox + cx, baseY)
    g.bezierCurveTo(ox + cx - w * 0.62, baseY - h * 0.08, ox + cx - w * 0.72, baseY - h * 0.55, ox + cx, baseY - h)
    g.closePath()
    g.fill()
  }
  for (let f = 0; f < FRAMES; f++) {
    const ox = f * FW
    const j = (n: number) => Math.sin(f * 2.4 + n * 1.7)
    const baseY = FH - 8
    tongue(ox, 48 + j(1) * 5, baseY, 42, 150 + j(2) * 18, '#ff6a10', 0.85)
    tongue(ox, 48 + j(3) * 6, baseY, 30, 112 + j(4) * 14, '#ffa030', 0.9)
    tongue(ox, 48 + j(5) * 4, baseY, 19, 74 + j(6) * 11, '#ffdf70', 0.95)
  }
  g.globalAlpha = 1
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.repeat.set(1 / FRAMES, 1)
  tex.magFilter = NearestFilter
  return tex
}

const G5_BRAZIERS: [number, number][] = [
  [22.8, 14.4],
  [-22.8, 14.4],
  [22.8, -14.4],
  [-22.8, -14.4],
]

function Gen5Braziers() {
  const tex = useMemo(() => gen5MakeFlameSheet(), [])
  const lights = useRef<(PointLight | null)[]>([])

  const { pillars, bowls, flames } = useMemo(() => {
    const m4 = new Matrix4()
    const q = new Quaternion()
    const pos = new Vector3()
    const sc = new Vector3(1, 1, 1)

    const pillarMesh = new InstancedMesh(
      new CylinderGeometry(0.42, 0.62, 2.4, 8),
      new MeshStandardMaterial({ color: '#3a3630', roughness: 0.95 }),
      G5_BRAZIERS.length,
    )
    const bowlMesh = new InstancedMesh(
      new CylinderGeometry(1.05, 0.5, 0.85, 10),
      new MeshStandardMaterial({ color: '#4a443c', roughness: 0.85 }),
      G5_BRAZIERS.length,
    )
    G5_BRAZIERS.forEach(([x, z], i) => {
      m4.makeTranslation(x, 0.7, z)
      pillarMesh.setMatrixAt(i, m4)
      m4.makeTranslation(x, 2.3, z)
      bowlMesh.setMatrixAt(i, m4)
    })
    pillarMesh.instanceMatrix.needsUpdate = true
    bowlMesh.instanceMatrix.needsUpdate = true
    pillarMesh.frustumCulled = false
    bowlMesh.frustumCulled = false

    // 火焰：每座 2 片交叉 billboard 平面（instanced）
    const flameGeo = new PlaneGeometry(1.9, 3.4)
    flameGeo.translate(0, 1.7, 0)
    const flameMat = new MeshBasicMaterial({
      map: tex,
      color: new Color(2.3, 1.6, 1.0),
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
      fog: false,
    })
    const flameMesh = new InstancedMesh(flameGeo, flameMat, G5_BRAZIERS.length * 2)
    let fi = 0
    const e = new Vector3()
    for (const [x, z] of G5_BRAZIERS) {
      for (const ry of [0, Math.PI / 2]) {
        pos.set(x, 2.55, z)
        q.setFromAxisAngle(e.set(0, 1, 0), ry)
        m4.compose(pos, q, sc)
        flameMesh.setMatrixAt(fi, m4)
        fi++
      }
    }
    flameMesh.instanceMatrix.needsUpdate = true
    flameMesh.frustumCulled = false
    return { pillars: pillarMesh, bowls: bowlMesh, flames: flameMesh }
  }, [tex])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    tex.offset.x = (Math.floor(t * 10) % 8) / 8
    lights.current.forEach((l, i) => {
      if (l) l.intensity = 11 + Math.sin(t * 9.1 + i * 2.3) * 3 + Math.sin(t * 21.7 + i) * 1.6
    })
  })

  return (
    <group>
      <primitive object={pillars} />
      <primitive object={bowls} />
      <primitive object={flames} />
      {G5_BRAZIERS.map(([x, z], i) => (
        <pointLight
          key={i}
          ref={(l) => { lights.current[i] = l }}
          position={[x, 3.6, z]}
          color="#ff9a40"
          distance={17}
          decay={1.9}
          intensity={11}
        />
      ))}
    </group>
  )
}

/* ---------- 主組件：布景 ---------- */

export default function Gen5Vertress() {
  return (
    <>
      <Gen5NightSky />
      <Environment files="/assets/hdri/moonless_golf_2k.hdr" environmentIntensity={0.3} />

      {/* 月光主光（唯一投影光源） */}
      <directionalLight
        position={[26, 34, -14]}
        intensity={0.85}
        color="#aab8ee"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-far={70}
        shadow-bias={-0.0004}
      />
      <hemisphereLight args={['#38306a', '#171220', 0.5]} />
      <ambientLight intensity={0.12} color="#7a70c8" />
      {/* 場心暖色補光：讓火盆金光落在石地上 */}
      <pointLight position={[0, 9, 0]} color="#d8a860" distance={44} decay={2} intensity={16} />

      <Gen5Stands />
      <Crowd tiers={G5_TIERS} style="modern" brightness={[0.5, 0.85]} />
      <Gen5SummitTemple />
      <Gen5Towers />
      <Gen5SpotBeams />
      <Gen5Braziers />
    </>
  )
}

/* ---------- 戰鬥地板：暗石場 + 發光符文徽章 ---------- */

function gen5MakeCourtTex(): CanvasTexture {
  const W = 1600
  const H = 960
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const r = gen5Rng(551)

  g.fillStyle = '#302e3a'
  g.fillRect(0, 0, W, H)
  // 石板縫
  g.strokeStyle = 'rgba(10, 10, 16, 0.65)'
  g.lineWidth = 4
  const TILE = 100
  for (let x = 0; x <= W; x += TILE) {
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x, H)
    g.stroke()
  }
  for (let y = 0; y <= H; y += TILE) {
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(W, y)
    g.stroke()
  }
  // 石斑駁
  for (let i = 0; i < 130; i++) {
    g.fillStyle = i % 2 ? 'rgba(58, 56, 70, 0.28)' : 'rgba(16, 14, 22, 0.3)'
    g.beginPath()
    g.ellipse(r() * W, r() * H, 22 + r() * 70, 14 + r() * 44, r() * Math.PI, 0, Math.PI * 2)
    g.fill()
  }
  // 邊界線（暗金）
  const M = 60
  g.strokeStyle = 'rgba(216, 168, 74, 0.75)'
  g.lineWidth = 8
  g.strokeRect(M, M, W - M * 2, H - M * 2)
  g.beginPath()
  g.moveTo(W / 2, M)
  g.lineTo(W / 2, H - M)
  g.stroke()

  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/** 發光符文圈（加法混合疊在場心） */
function gen5MakeRuneTex(): CanvasTexture {
  const S = 1024
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const g = c.getContext('2d')!
  g.clearRect(0, 0, S, S)
  const cx = S / 2
  const cy = S / 2
  g.strokeStyle = '#ffd070'
  g.shadowColor = '#ffb040'
  g.shadowBlur = 22

  // 外圈 + 內圈
  g.lineWidth = 10
  g.beginPath()
  g.arc(cx, cy, 430, 0, Math.PI * 2)
  g.stroke()
  g.lineWidth = 5
  g.beginPath()
  g.arc(cx, cy, 388, 0, Math.PI * 2)
  g.stroke()
  g.beginPath()
  g.arc(cx, cy, 210, 0, Math.PI * 2)
  g.stroke()

  // 符文刻痕（外環 24 格）
  const r = gen5Rng(97)
  for (let i = 0; i < 24; i++) {
    const ang = (i / 24) * Math.PI * 2
    const rad = 409
    const x = cx + Math.cos(ang) * rad
    const y = cy + Math.sin(ang) * rad
    g.save()
    g.translate(x, y)
    g.rotate(ang + Math.PI / 2)
    g.lineWidth = 5
    g.beginPath()
    const seg = 2 + ((r() * 3) | 0)
    let px = -8
    let py = -10
    g.moveTo(px, py)
    for (let sgm = 0; sgm < seg; sgm++) {
      px += (r() - 0.3) * 16
      py += 8
      g.lineTo(px, py)
    }
    g.stroke()
    g.restore()
  }

  // 中央合眾菱形徽章
  g.lineWidth = 9
  g.beginPath()
  g.moveTo(cx, cy - 150)
  g.lineTo(cx + 110, cy)
  g.lineTo(cx, cy + 150)
  g.lineTo(cx - 110, cy)
  g.closePath()
  g.stroke()
  g.lineWidth = 5
  g.beginPath()
  g.moveTo(cx, cy - 86)
  g.lineTo(cx + 62, cy)
  g.lineTo(cx, cy + 86)
  g.lineTo(cx - 62, cy)
  g.closePath()
  g.stroke()

  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

export function Gen5VertressFloor(_props: { fieldType?: FieldType | null }) {
  const courtTex = useMemo(() => gen5MakeCourtTex(), [])
  const runeTex = useMemo(() => gen5MakeRuneTex(), [])
  const rune = useRef<Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (rune.current) {
      const m = rune.current.material as MeshBasicMaterial
      m.opacity = 0.48 + 0.16 * Math.sin(t * 1.3)
    }
  })

  return (
    <RigidBody type="fixed" colliders={false}>
      {/* 碰撞體不變：40×24 頂面 y=0 + 四面隱形擋牆 */}
      <CuboidCollider args={[20, 0.25, 12]} position={[0, -0.25, 0]} />
      <CuboidCollider args={[0.3, 2, 12.6]} position={[20.9, 1.5, 0]} />
      <CuboidCollider args={[0.3, 2, 12.6]} position={[-20.9, 1.5, 0]} />
      <CuboidCollider args={[21.2, 2, 0.3]} position={[0, 1.5, 12.9]} />
      <CuboidCollider args={[21.2, 2, 0.3]} position={[0, 1.5, -12.9]} />

      {/* 石場基座 */}
      <mesh position={[0, -0.26, 0]}>
        <boxGeometry args={[40, 0.5, 24]} />
        <meshStandardMaterial color="#14121a" roughness={1} />
      </mesh>
      {/* 石板頂面 */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <planeGeometry args={[40, 24]} />
        <meshStandardMaterial map={courtTex} roughness={0.85} metalness={0.05} envMapIntensity={0.5} />
      </mesh>
      {/* 發光符文徽章（脈動） */}
      <mesh ref={rune} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <planeGeometry args={[19, 19]} />
        <meshBasicMaterial
          map={runeTex}
          color={[0.95, 0.72, 0.34]}
          transparent
          opacity={0.55}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {/* 場外石廣場（純視覺） */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[130, 100]} />
        <meshStandardMaterial color="#1c1a26" roughness={1} />
      </mesh>
    </RigidBody>
  )
}
