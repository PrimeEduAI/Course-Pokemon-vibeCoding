'use client'
import { Environment, Stars } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  Points,
  PointsMaterial,
  Quaternion,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { ellipseRing, type Tier } from './geometry'
import Crowd from './Crowd'
import type { FieldType } from './types'

/**
 * Gen 4 鈴蘭大會（神奧・鈴蘭鎮湖上）：
 * 夜之慶典 — 星空湖面、哥德教堂剪影島（雙塔尖 + 發光玫瑰窗）、
 * 島緣瀑布微光、鈴蘭白+堇紫石造場館、環場燈籠柱、
 * 週期性夜空煙火（GPU 粒子彈幕、6–10s 一發、Bloom 加持）。
 * 地板：白石+泥土典雅球場 + 堇紫發光鑲線（靜態，不吃 fieldType）。
 */

const G4_TIERS: Tier[] = [
  { aIn: 25.0, bIn: 17.5, yBase: 2.2, depth: 7.0, rise: 3.0, rows: 9 },
  { aIn: 33.0, bIn: 25.5, yBase: 6.0, depth: 7.0, rise: 3.4, rows: 10 },
]
const RIM_A = G4_TIERS[1].aIn + G4_TIERS[1].depth
const RIM_B = G4_TIERS[1].bIn + G4_TIERS[1].depth
const RIM_Y = G4_TIERS[1].yBase + G4_TIERS[1].rise
const RAIL_TOP = RIM_Y + 1.3

const LILY_A = '#dcd9e4'
const LILY_B = '#cdc9d8'
const WALL_C = '#b4aec4'
const VIOLET = '#5d3f9e'

/* ---------- 夜空 + 湖面 ---------- */

function makeNightSky(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 512
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 512)
  grad.addColorStop(0, '#050514')
  grad.addColorStop(0.5, '#0c0a24')
  grad.addColorStop(0.78, '#1c163e')
  grad.addColorStop(0.92, '#33285c')
  grad.addColorStop(1, '#463a6e')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 512)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function makeLakeTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#0a0e22'
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 256
    const y = Math.random() * 256
    const w = 6 + Math.random() * 22
    g.fillStyle = `rgba(150, 160, 230, ${0.04 + Math.random() * 0.1})`
    g.fillRect(x, y, w, 1.5 + Math.random() * 1.5)
  }
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.repeat.set(7, 7)
  return tex
}

function NightLake() {
  const sky = useMemo(() => makeNightSky(), [])
  const lake = useMemo(() => makeLakeTexture(), [])
  useFrame(({ clock }) => {
    lake.offset.x = clock.elapsedTime * 0.0035
  })
  return (
    <>
      <color attach="background" args={['#07061a']} />
      <fog attach="fog" args={['#0c0a24', 90, 280]} />
      <Stars radius={270} depth={50} count={3000} factor={4.5} saturation={0} fade speed={0.4} />
      <mesh>
        <sphereGeometry args={[250, 24, 16]} />
        <meshBasicMaterial map={sky} side={BackSide} fog={false} depthWrite={false} />
      </mesh>
      {/* 湖面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -6, 0]}>
        <circleGeometry args={[245, 48]} />
        <meshBasicMaterial map={lake} fog />
      </mesh>
      {/* 月亮 + 光暈 */}
      <mesh position={[-70, 88, -150]}>
        <circleGeometry args={[9, 24]} />
        <meshBasicMaterial color={[1.7, 1.75, 2.1]} toneMapped={false} fog={false} />
      </mesh>
      {/* 月光湖面倒影帶 */}
      <mesh rotation={[-Math.PI / 2, 0, 0.42]} position={[-58, -5.9, -95]}>
        <planeGeometry args={[9, 120]} />
        <meshBasicMaterial color="#3d4470" transparent opacity={0.55} depthWrite={false} />
      </mesh>
      {/* 場館所在島面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]}>
        <circleGeometry args={[70, 40]} />
        <meshStandardMaterial color="#1b2318" roughness={1} />
      </mesh>
      <mesh position={[0, -3.3, 0]}>
        <cylinderGeometry args={[70, 76, 5.6, 40]} />
        <meshStandardMaterial color="#242030" roughness={1} />
      </mesh>
    </>
  )
}

/* ---------- 哥德教堂剪影島（玫瑰窗發光） ---------- */

function makeRoseWindow(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#0d0a1c'
  g.fillRect(0, 0, 256, 256)
  const cx = 128
  const cy = 128
  // 花瓣輻條
  const cols = ['#8256d8', '#c04f9e', '#5470d8', '#a24fd0']
  for (let i = 0; i < 12; i++) {
    const a0 = (i / 12) * Math.PI * 2
    const a1 = ((i + 0.82) / 12) * Math.PI * 2
    g.fillStyle = cols[i % cols.length]
    g.beginPath()
    g.moveTo(cx, cy)
    g.arc(cx, cy, 106, a0, a1)
    g.closePath()
    g.fill()
  }
  // 同心環
  g.strokeStyle = '#e8ddc0'
  g.lineWidth = 7
  for (const r of [106, 70, 34]) {
    g.beginPath()
    g.arc(cx, cy, r, 0, Math.PI * 2)
    g.stroke()
  }
  // 輻條石框
  g.lineWidth = 5
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    g.beginPath()
    g.moveTo(cx + Math.cos(a) * 32, cy + Math.sin(a) * 32)
    g.lineTo(cx + Math.cos(a) * 106, cy + Math.sin(a) * 106)
    g.stroke()
  }
  // 中心金蕊
  g.fillStyle = '#ffe9a8'
  g.beginPath()
  g.arc(cx, cy, 26, 0, Math.PI * 2)
  g.fill()
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function makeFallShimmer(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 512
  const g = c.getContext('2d')!
  g.clearRect(0, 0, 128, 512)
  for (let i = 0; i < 34; i++) {
    const x = Math.random() * 128
    const w = 1.5 + Math.random() * 4
    const a = 0.16 + Math.random() * 0.3
    g.fillStyle = `rgba(190, 205, 250, ${a})`
    g.fillRect(x, 0, w, 512)
  }
  const tex = new CanvasTexture(c)
  tex.wrapT = RepeatWrapping
  return tex
}

function CathedralIsland() {
  const rose = useMemo(() => makeRoseWindow(), [])
  const shimmer = useMemo(() => makeFallShimmer(), [])
  useFrame(({ clock }) => {
    shimmer.offset.y = clock.elapsedTime * 0.3
  })
  const winPos = useMemo(() => {
    const arr: [number, number][] = []
    for (const x of [-10, -5.4, 5.4, 10]) for (const y of [10, 17]) arr.push([x, y])
    for (const x of [-19.5, 19.5]) for (const y of [12, 20, 28]) arr.push([x, y])
    return arr
  }, [])
  return (
    <group position={[8, -6, -158]}>
      {/* 教堂島岩體 */}
      <mesh position={[0, 9, 0]}>
        <cylinderGeometry args={[46, 56, 20, 22]} />
        <meshStandardMaterial color="#1a1526" roughness={1} flatShading />
      </mesh>
      {/* 島緣瀑布微光（三道） */}
      {([[-30, 6], [8, 8], [34, 4]] as const).map(([x, w], i) => (
        <mesh key={i} position={[x, 3.5, 50 - Math.abs(x) * 0.32]}>
          <planeGeometry args={[w, 17]} />
          <meshBasicMaterial
            map={shimmer} transparent depthWrite={false} opacity={0.5}
            blending={AdditiveBlending} side={DoubleSide} fog={false}
          />
        </mesh>
      ))}
      {/* 教堂主殿 */}
      <group position={[0, 19, 0]}>
        <mesh position={[0, 13, -6]}>
          <boxGeometry args={[30, 26, 20]} />
          <meshStandardMaterial color="#221c36" roughness={1} />
        </mesh>
        {/* 主殿尖頂 */}
        <mesh position={[0, 30, -6]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[12, 12, 4]} />
          <meshStandardMaterial color="#191430" roughness={1} flatShading />
        </mesh>
        {/* 雙塔 */}
        {[-19.5, 19.5].map((x) => (
          <group key={x} position={[x, 0, 2]}>
            <mesh position={[0, 17, 0]}>
              <boxGeometry args={[9, 34, 9]} />
              <meshStandardMaterial color="#251f3c" roughness={1} />
            </mesh>
            <mesh position={[0, 41, 0]}>
              <coneGeometry args={[6.4, 15, 6]} />
              <meshStandardMaterial color="#191430" roughness={1} flatShading />
            </mesh>
            {/* 塔尖光點 */}
            <mesh position={[0, 49.2, 0]}>
              <sphereGeometry args={[0.5, 8, 6]} />
              <meshBasicMaterial color={[1.8, 1.5, 2.6]} toneMapped={false} fog={false} />
            </mesh>
          </group>
        ))}
        {/* 發光玫瑰窗（面向球場） */}
        <mesh position={[0, 15, 4.15]}>
          <circleGeometry args={[6.4, 24]} />
          <meshBasicMaterial map={rose} color={[1.7, 1.5, 2.2]} toneMapped={false} fog={false} />
        </mesh>
        {/* 玫瑰窗石框 */}
        <mesh position={[0, 15, 4.05]}>
          <ringGeometry args={[6.4, 7.3, 24]} />
          <meshStandardMaterial color="#3a3252" roughness={0.9} side={DoubleSide} />
        </mesh>
        {/* 小拱窗光點 */}
        {winPos.map(([x, y], i) => (
          <mesh key={i} position={[x, y, Math.abs(x) > 15 ? 6.6 : 4.2]}>
            <planeGeometry args={[1.1, 2.4]} />
            <meshBasicMaterial color={[1.4, 1.15, 1.9]} toneMapped={false} fog={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/* ---------- 鈴蘭白石看台（堇紫飾帶 + 微光冠圈） ---------- */

function LilyStands() {
  const geos = useMemo(() => {
    const slopes: BufferGeometry[] = []
    const walls: BufferGeometry[] = []
    const trims: BufferGeometry[] = []
    let prevAOut = G4_TIERS[0].aIn
    let prevBOut = G4_TIERS[0].bIn
    let prevYTop = -0.5
    for (const t of G4_TIERS) {
      const aOut = t.aIn + t.depth
      const bOut = t.bIn + t.depth
      const yTop = t.yBase + t.rise
      walls.push(ellipseRing(prevAOut, prevBOut, prevYTop, t.aIn, t.bIn, t.yBase))
      slopes.push(ellipseRing(t.aIn, t.bIn, t.yBase, aOut, bOut, yTop))
      trims.push(ellipseRing(t.aIn - 0.04, t.bIn - 0.04, t.yBase - 0.5, t.aIn - 0.04, t.bIn - 0.04, t.yBase))
      prevAOut = aOut
      prevBOut = bOut
      prevYTop = yTop
    }
    walls.push(ellipseRing(RIM_A, RIM_B, RIM_Y, RIM_A, RIM_B, RAIL_TOP))
    trims.push(ellipseRing(RIM_A + 0.02, RIM_B + 0.02, RAIL_TOP - 0.5, RIM_A + 0.02, RIM_B + 0.02, RAIL_TOP))
    // 冠圈微光帶（Bloom 微暈）
    const glow = ellipseRing(RIM_A + 0.05, RIM_B + 0.05, RAIL_TOP, RIM_A + 0.05, RIM_B + 0.05, RAIL_TOP + 0.16)
    return { slopes, walls, trims, glow }
  }, [])

  return (
    <group>
      {geos.slopes.map((g, i) => (
        <mesh key={`s${i}`} geometry={g}>
          <meshStandardMaterial color={i % 2 === 0 ? LILY_A : LILY_B} roughness={0.92} side={DoubleSide} />
        </mesh>
      ))}
      {geos.walls.map((g, i) => (
        <mesh key={`w${i}`} geometry={g}>
          <meshStandardMaterial color={WALL_C} roughness={0.9} side={DoubleSide} />
        </mesh>
      ))}
      {geos.trims.map((g, i) => (
        <mesh key={`t${i}`} geometry={g}>
          <meshStandardMaterial color={VIOLET} roughness={0.55} side={DoubleSide} />
        </mesh>
      ))}
      <mesh geometry={geos.glow}>
        <meshBasicMaterial color={[1.05, 0.85, 1.9]} toneMapped={false} side={DoubleSide} fog={false} />
      </mesh>
    </group>
  )
}

/* ---------- 環場燈籠柱（instanced 柱 + 發光燈頭） ---------- */

const LANTERN_COUNT = 14

function LanternRing() {
  const { posts, heads } = useMemo(() => {
    const postMesh = new InstancedMesh(
      new CylinderGeometry(0.11, 0.15, 3.4, 6),
      new MeshStandardMaterial({ color: '#2b2440', roughness: 0.8 }),
      LANTERN_COUNT,
    )
    const headMesh = new InstancedMesh(
      new SphereGeometry(0.34, 10, 8),
      new MeshBasicMaterial({ color: new Color(2.1, 1.7, 1.1), toneMapped: false }),
      LANTERN_COUNT,
    )
    const m4 = new Matrix4()
    const q = new Quaternion()
    const p = new Vector3()
    const s = new Vector3(1, 1, 1)
    for (let i = 0; i < LANTERN_COUNT; i++) {
      const ang = (i / LANTERN_COUNT) * Math.PI * 2
      const x = Math.cos(ang) * (RIM_A - 0.7)
      const z = Math.sin(ang) * (RIM_B - 0.7)
      p.set(x, RAIL_TOP + 1.7, z)
      m4.compose(p, q, s)
      postMesh.setMatrixAt(i, m4)
      p.set(x, RAIL_TOP + 3.6, z)
      m4.compose(p, q, s)
      headMesh.setMatrixAt(i, m4)
    }
    postMesh.instanceMatrix.needsUpdate = true
    headMesh.instanceMatrix.needsUpdate = true
    postMesh.frustumCulled = false
    headMesh.frustumCulled = false
    return { posts: postMesh, heads: headMesh }
  }, [])
  return (
    <group>
      <primitive object={posts} />
      <primitive object={heads} />
    </group>
  )
}

/* ---------- 夜空煙火（GPU 粒子彈幕，3 發輪替） ---------- */

const SHELL_PARTICLES = 130
const FW_LIFE = 2.6
const FW_COLORS = ['#b48ef0', '#ffd27a', '#7ae0ff', '#ff9ad0', '#f4f2ff', '#8affc0']

function makeGlowSprite(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.7)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return new CanvasTexture(c)
}

interface Shell {
  points: Points
  mat: PointsMaterial
  pos: Float32BufferAttribute
  dir: Float32Array
  spd: Float32Array
  t0: number
  nextAt: number
  center: Vector3
}

function makeShell(sprite: CanvasTexture): Shell {
  const dir = new Float32Array(SHELL_PARTICLES * 3)
  const spd = new Float32Array(SHELL_PARTICLES)
  for (let i = 0; i < SHELL_PARTICLES; i++) {
    // 均勻球面方向
    const u = Math.random() * 2 - 1
    const a = Math.random() * Math.PI * 2
    const rr = Math.sqrt(1 - u * u)
    dir[i * 3] = Math.cos(a) * rr
    dir[i * 3 + 1] = u
    dir[i * 3 + 2] = Math.sin(a) * rr
    spd[i] = 6.5 + Math.random() * 7
  }
  const geo = new BufferGeometry()
  const pos = new Float32BufferAttribute(new Float32Array(SHELL_PARTICLES * 3), 3)
  geo.setAttribute('position', pos)
  const mat = new PointsMaterial({
    size: 0.85,
    map: sprite,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: AdditiveBlending,
    color: new Color('#b48ef0'),
    sizeAttenuation: true,
  })
  const pts = new Points(geo, mat)
  pts.frustumCulled = false
  pts.visible = false
  return { points: pts, mat, pos, dir, spd, t0: -100, nextAt: 0, center: new Vector3() }
}

function Fireworks() {
  const sprite = useMemo(() => makeGlowSprite(), [])
  const shells = useMemo(() => {
    const arr: Shell[] = []
    for (let i = 0; i < 3; i++) {
      const s = makeShell(sprite)
      s.nextAt = 1.5 + i * 3.2
      arr.push(s)
    }
    return arr
  }, [sprite])
  const flash = useRef<PointLight>(null)
  const lastBurst = useRef(-100)
  const lastColor = useMemo(() => new Color('#b48ef0'), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    for (const s of shells) {
      if (t >= s.nextAt) {
        s.t0 = t
        const col = new Color(FW_COLORS[(Math.random() * FW_COLORS.length) | 0])
        s.mat.color.copy(col).multiplyScalar(2.2)
        // 壓低爆點：剛好懸在對面看台頂上方（戰鬥視角可視帶），偶爾一發高空
        const high = Math.random() < 0.3
        s.center.set(
          (Math.random() - 0.5) * 60,
          high ? 26 + Math.random() * 12 : 13 + Math.random() * 6,
          high ? -50 - Math.random() * 30 : -36 - Math.random() * 14,
        )
        s.nextAt = t + 6 + Math.random() * 4
        lastBurst.current = t
        lastColor.copy(col)
      }
      const tt = t - s.t0
      if (tt >= 0 && tt <= FW_LIFE) {
        s.points.visible = true
        const k = tt / FW_LIFE
        const ex = 1 - Math.exp(-3.5 * k)
        const droop = 6.5 * k * k
        const arrPos = s.pos.array as Float32Array
        for (let i = 0; i < SHELL_PARTICLES; i++) {
          const r = s.spd[i] * ex
          arrPos[i * 3] = s.center.x + s.dir[i * 3] * r
          arrPos[i * 3 + 1] = s.center.y + s.dir[i * 3 + 1] * r - droop
          arrPos[i * 3 + 2] = s.center.z + s.dir[i * 3 + 2] * r
        }
        s.pos.needsUpdate = true
        s.mat.opacity = (1 - k) * (1 - k) * (0.7 + 0.3 * Math.sin(t * 15))
        s.mat.size = 0.85 * (1 - 0.4 * k) + 0.25
      } else {
        s.points.visible = false
      }
    }
    // 爆閃補光
    if (flash.current) {
      const dt = t - lastBurst.current
      flash.current.intensity = dt >= 0 && dt < 1.4 ? 110 * Math.exp(-2.8 * dt) : 0
      flash.current.color.copy(lastColor)
    }
  })

  return (
    <group>
      {shells.map((s, i) => (
        <primitive key={i} object={s.points} />
      ))}
      <pointLight ref={flash} position={[0, 26, -46]} distance={240} decay={1.3} intensity={0} />
    </group>
  )
}

/* ---------- 主組件：布景 ---------- */

export default function Gen4LilyValley() {
  return (
    <>
      <NightLake />
      <Environment files="/assets/hdri/moonless_golf_2k.hdr" environmentIntensity={0.35} />

      {/* 月光主光（唯一投影光源） */}
      <directionalLight
        position={[-24, 34, 16]}
        intensity={0.85}
        color="#9fb0e8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-far={70}
        shadow-bias={-0.0004}
      />
      <hemisphereLight args={['#3a3660', '#0c0a16', 0.58]} />
      <ambientLight intensity={0.14} color="#5a4f8a" />
      {/* 場心堇紫氛圍光 */}
      <pointLight position={[0, 12, 0]} color="#b9a2ff" intensity={20} distance={50} decay={1.8} />

      <CathedralIsland />
      <LilyStands />
      <Crowd tiers={G4_TIERS} style="modern" brightness={[0.3, 0.55]} />
      <LanternRing />
      <Fireworks />
    </>
  )
}

/* ================= 戰鬥地板（靜態典雅球場 + 發光鑲線） ================= */

function makeCourtCanvases(): { base: HTMLCanvasElement; glow: HTMLCanvasElement } {
  const W = 1600
  const H = 960
  const base = document.createElement('canvas')
  base.width = W
  base.height = H
  const g = base.getContext('2d')!

  // 外圈白石框
  g.fillStyle = '#b9b3c2'
  g.fillRect(0, 0, W, H)
  // 石板縫
  g.strokeStyle = 'rgba(70, 64, 88, 0.35)'
  g.lineWidth = 3
  for (let x = 0; x <= W; x += 160) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke()
  }
  for (let y = 0; y <= H; y += 160) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke()
  }
  // 內場泥土
  const M = 120
  g.fillStyle = '#77685a'
  g.fillRect(M, M, W - M * 2, H - M * 2)
  // 泥土質感
  for (let i = 0; i < 2600; i++) {
    const x = M + Math.random() * (W - M * 2)
    const y = M + Math.random() * (H - M * 2)
    g.fillStyle = Math.random() > 0.5 ? 'rgba(46, 38, 30, 0.14)' : 'rgba(178, 160, 138, 0.12)'
    g.fillRect(x, y, 2 + Math.random() * 4, 2 + Math.random() * 3)
  }
  // 耙紋弧線
  g.strokeStyle = 'rgba(58, 48, 38, 0.18)'
  g.lineWidth = 4
  for (let i = 0; i < 22; i++) {
    g.beginPath()
    g.arc(W / 2, H / 2, 130 + i * 26, Math.PI * 0.06 * i, Math.PI * (0.6 + 0.05 * i))
    g.stroke()
  }
  // 白鈴蘭花瓣散落
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * W
    const y = Math.random() * H
    g.fillStyle = 'rgba(240, 238, 248, 0.5)'
    g.beginPath()
    g.ellipse(x, y, 3 + Math.random() * 3, 1.6 + Math.random() * 2, Math.random() * Math.PI, 0, Math.PI * 2)
    g.fill()
  }

  // 發光鑲線層（emissiveMap 專用：黑底 + 亮線）
  const glow = document.createElement('canvas')
  glow.width = W
  glow.height = H
  const q = glow.getContext('2d')!
  q.fillStyle = '#000000'
  q.fillRect(0, 0, W, H)
  q.strokeStyle = '#d8c8ff'
  q.lineWidth = 10
  // 場界圓角矩形
  const R = 46
  q.beginPath()
  q.moveTo(M + R, M)
  q.lineTo(W - M - R, M)
  q.arcTo(W - M, M, W - M, M + R, R)
  q.lineTo(W - M, H - M - R)
  q.arcTo(W - M, H - M, W - M - R, H - M, R)
  q.lineTo(M + R, H - M)
  q.arcTo(M, H - M, M, H - M - R, R)
  q.lineTo(M, M + R)
  q.arcTo(M, M, M + R, M, R)
  q.stroke()
  // 中圈精靈球紋
  q.beginPath()
  q.arc(W / 2, H / 2, 165, 0, Math.PI * 2)
  q.stroke()
  q.beginPath()
  q.moveTo(W / 2 - 165, H / 2)
  q.lineTo(W / 2 + 165, H / 2)
  q.stroke()
  q.beginPath()
  q.arc(W / 2, H / 2, 48, 0, Math.PI * 2)
  q.stroke()
  // 四隅鈴蘭花形飾線（六瓣小花）
  const flower = (cx: number, cy: number, s: number) => {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      q.beginPath()
      q.ellipse(cx + Math.cos(a) * s, cy + Math.sin(a) * s, s * 0.55, s * 0.3, a, 0, Math.PI * 2)
      q.stroke()
    }
  }
  q.lineWidth = 6
  flower(M + 150, M + 130, 34)
  flower(W - M - 150, M + 130, 34)
  flower(M + 150, H - M - 130, 34)
  flower(W - M - 150, H - M - 130, 34)

  return { base, glow }
}

/** 鈴蘭大會戰鬥地板：靜態（忽略 fieldType）；碰撞 40×24 頂面 y=0 + 擋牆 */
export function Gen4LilyValleyFloor(_props: { fieldType?: FieldType | null }) {
  const { baseTex, glowTex } = useMemo(() => {
    const { base, glow } = makeCourtCanvases()
    const bt = new CanvasTexture(base)
    bt.colorSpace = SRGBColorSpace
    bt.anisotropy = 8
    const gt = new CanvasTexture(glow)
    gt.anisotropy = 4
    return { baseTex: bt, glowTex: gt }
  }, [])

  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[20, 0.25, 12]} position={[0, -0.25, 0]} />
      <CuboidCollider args={[0.3, 2, 12.6]} position={[20.9, 1.5, 0]} />
      <CuboidCollider args={[0.3, 2, 12.6]} position={[-20.9, 1.5, 0]} />
      <CuboidCollider args={[21.2, 2, 0.3]} position={[0, 1.5, 12.9]} />
      <CuboidCollider args={[21.2, 2, 0.3]} position={[0, 1.5, -12.9]} />

      {/* 基座 */}
      <mesh position={[0, -0.26, 0]}>
        <boxGeometry args={[40, 0.5, 24]} />
        <meshStandardMaterial color="#3a3444" roughness={1} />
      </mesh>
      {/* 球場頂面：白石+泥土 + 堇紫發光鑲線 */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <planeGeometry args={[40, 24]} />
        <meshStandardMaterial
          map={baseTex}
          roughness={0.9}
          metalness={0}
          emissive="#a98cff"
          emissiveIntensity={1.35}
          emissiveMap={glowTex}
        />
      </mesh>
      {/* 場外暗紫石廣場（純視覺） */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[130, 100]} />
        <meshStandardMaterial color="#262133" roughness={1} />
      </mesh>
      {/* 四隅堇紫光柱尖碑（擋牆外，裝飾） */}
      {([[-21.8, -13.7], [21.8, -13.7], [-21.8, 13.7], [21.8, 13.7]] as const).map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.22, 0.36, 2.2, 6]} />
            <meshStandardMaterial color="#2b2440" roughness={0.8} />
          </mesh>
          <mesh position={[0, 2.5, 0]}>
            <coneGeometry args={[0.3, 0.9, 6]} />
            <meshBasicMaterial color={[1.3, 1.0, 2.2]} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </RigidBody>
  )
}
