'use client'
import { Environment } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  PointLight,
  Points,
  PointsMaterial,
  Quaternion,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { ellipseRing, type Tier } from './geometry'
import Crowd from './Crowd'
import type { FieldType } from './types'

/**
 * Gen 2 白銀大會（白銀山麓）：
 * 藍調時刻的高山黃昏、雪頂白銀山巨大背景、松樹剪影環、石造+木樑露天碗形場館
 * （城都緋紅飾帶、欄杆積雪）、鳳王聖火（彩虹色調火焰神社火盆）。
 * 招牌機制：進場時 3.5s「機械旋轉換場」— 舊鋼板滑開、新場地模組轉盤旋入、
 * 活塞頂升鎖定 + 塵霧 + 震動。碰撞體全程恆定（40×24 頂面 y=0 + 四面擋牆）。
 */

const G2_TIERS: Tier[] = [
  { aIn: 25.0, bIn: 17.5, yBase: 2.2, depth: 7.0, rise: 3.2, rows: 10 },
  { aIn: 32.8, bIn: 25.3, yBase: 6.2, depth: 7.5, rise: 3.8, rows: 11 },
]
const RIM_A = G2_TIERS[1].aIn + G2_TIERS[1].depth
const RIM_B = G2_TIERS[1].bIn + G2_TIERS[1].depth
const RIM_Y = G2_TIERS[1].yBase + G2_TIERS[1].rise
const RAIL_TOP = RIM_Y + 1.4

const CRIMSON = '#a32330'      // 城都緋紅
const STONE_A = '#a3a4a3'
const STONE_B = '#949591'
const TIMBER = '#54402c'
const SNOW = '#e9eef6'

/* ---------- 藍調黃昏天空 + 遠山雪稜 ---------- */

function makeSkyTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 512
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 512)
  grad.addColorStop(0, '#0b1226')    // 天頂深藍
  grad.addColorStop(0.42, '#1d2b50')
  grad.addColorStop(0.62, '#35476f')
  grad.addColorStop(0.78, '#5d6d94')
  grad.addColorStop(0.9, '#8f96ae')
  grad.addColorStop(1, '#c4b3a0')    // 地平線一抹殘照
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 512)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function makeRidgeTexture(): CanvasTexture {
  const W = 1024
  const H = 256
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.clearRect(0, 0, W, H)
  // 冷藍遠稜
  const grad = g.createLinearGradient(0, 60, 0, H)
  grad.addColorStop(0, '#26304e')
  grad.addColorStop(1, '#3a4666')
  g.fillStyle = grad
  const peaks: [number, number][] = []
  g.beginPath()
  g.moveTo(0, H)
  let y = 140
  g.lineTo(0, y)
  const n = 12
  for (let i = 1; i <= n; i++) {
    const x = (i / n) * W
    const px = x - W / n / 2
    y = i === n ? 140 : 58 + ((i * 71) % 92)
    g.lineTo(px, y)
    peaks.push([px, y])
    g.lineTo(x, Math.min(205, y + 52 + ((i * 37) % 44)))
  }
  g.lineTo(W, H)
  g.closePath()
  g.fill()
  // 雪頂
  g.fillStyle = 'rgba(214, 226, 240, 0.92)'
  for (const [px, py] of peaks) {
    g.beginPath()
    g.moveTo(px, py)
    g.lineTo(px - 26, py + 34)
    g.lineTo(px - 8, py + 28)
    g.lineTo(px + 6, py + 36)
    g.lineTo(px + 24, py + 30)
    g.closePath()
    g.fill()
  }
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.repeat.x = 3
  return tex
}

function AlpineSky() {
  const sky = useMemo(() => makeSkyTexture(), [])
  const ridge = useMemo(() => makeRidgeTexture(), [])
  return (
    <>
      <color attach="background" args={['#414f74']} />
      <fog attach="fog" args={['#41507a', 95, 300]} />
      <mesh>
        <sphereGeometry args={[240, 24, 16]} />
        <meshBasicMaterial map={sky} side={BackSide} fog={false} depthWrite={false} />
      </mesh>
      {/* 遠山雪稜剪影環 */}
      <mesh position={[0, 16, 0]}>
        <cylinderGeometry args={[208, 208, 52, 48, 1, true]} />
        <meshBasicMaterial map={ridge} transparent alphaTest={0.5} side={BackSide} fog={false} />
      </mesh>
    </>
  )
}

/* ---------- 白銀山主體（-Z 巨大雪頂主峰） ---------- */

function MtSilver() {
  // 尺寸校準過：主峰頂 ~y42（戰鬥視角向下 pitch 時仍落在看台頂與畫面上緣之間的可視帶）
  return (
    <group position={[10, -10, -150]}>
      {/* 主峰 */}
      <mesh position={[0, 26, 0]}>
        <coneGeometry args={[78, 54, 9]} />
        <meshStandardMaterial color="#3c4a6a" roughness={1} flatShading />
      </mesh>
      {/* 主峰雪冠 */}
      <mesh position={[0, 41, 0]} rotation={[0, 0.35, 0]}>
        <coneGeometry args={[33, 26, 9]} />
        <meshStandardMaterial color="#dfe7f2" roughness={0.9} flatShading />
      </mesh>
      {/* 左肩峰 */}
      <mesh position={[-88, 17, 24]}>
        <coneGeometry args={[50, 38, 8]} />
        <meshStandardMaterial color="#374260" roughness={1} flatShading />
      </mesh>
      <mesh position={[-88, 28, 24]} rotation={[0, 0.6, 0]}>
        <coneGeometry args={[20, 15, 8]} />
        <meshStandardMaterial color="#d4dcea" roughness={0.9} flatShading />
      </mesh>
      {/* 右肩峰 */}
      <mesh position={[98, 20, 14]}>
        <coneGeometry args={[56, 46, 8]} />
        <meshStandardMaterial color="#3a4664" roughness={1} flatShading />
      </mesh>
      <mesh position={[98, 34, 14]} rotation={[0, 1.1, 0]}>
        <coneGeometry args={[23, 17, 8]} />
        <meshStandardMaterial color="#d9e1ee" roughness={0.9} flatShading />
      </mesh>
    </group>
  )
}

/* ---------- 松樹剪影環（instanced） ---------- */

const PINE_COUNT = 96

function PineRing() {
  const { foliage, tips } = useMemo(() => {
    const folMesh = new InstancedMesh(
      new ConeGeometry(1.5, 4.2, 6),
      new MeshStandardMaterial({ color: '#141f1a', roughness: 1 }),
      PINE_COUNT,
    )
    const tipMesh = new InstancedMesh(
      new ConeGeometry(0.62, 1.4, 6),
      new MeshStandardMaterial({ color: '#dbe4ee', roughness: 0.9 }),
      PINE_COUNT,
    )
    const m4 = new Matrix4()
    const q = new Quaternion()
    const p = new Vector3()
    const s = new Vector3()
    for (let i = 0; i < PINE_COUNT; i++) {
      const ang = (i / PINE_COUNT) * Math.PI * 2 + Math.sin(i * 7.31) * 0.05
      const rad = 1 + Math.abs(Math.sin(i * 3.7)) * 0.42
      const x = Math.cos(ang) * (RIM_A + 7) * rad
      const z = Math.sin(ang) * (RIM_B + 7) * rad
      const sc = 0.9 + Math.abs(Math.sin(i * 5.13)) * 1.2
      s.set(sc, sc, sc)
      p.set(x, -0.5 + 2.1 * sc, z)
      m4.compose(p, q, s)
      folMesh.setMatrixAt(i, m4)
      p.set(x, -0.5 + 4.35 * sc, z)
      m4.compose(p, q, s)
      tipMesh.setMatrixAt(i, m4)
    }
    folMesh.instanceMatrix.needsUpdate = true
    tipMesh.instanceMatrix.needsUpdate = true
    folMesh.frustumCulled = false
    tipMesh.frustumCulled = false
    return { foliage: folMesh, tips: tipMesh }
  }, [])
  return (
    <group>
      <primitive object={foliage} />
      <primitive object={tips} />
    </group>
  )
}

/* ---------- 石造+木樑看台（緋紅飾帶、欄杆積雪） ---------- */

function StoneStands() {
  const geos = useMemo(() => {
    const slopes: BufferGeometry[] = []
    const walls: BufferGeometry[] = []
    const trims: BufferGeometry[] = []
    const snows: BufferGeometry[] = []
    let prevAOut = G2_TIERS[0].aIn
    let prevBOut = G2_TIERS[0].bIn
    let prevYTop = -0.5
    for (const t of G2_TIERS) {
      const aOut = t.aIn + t.depth
      const bOut = t.bIn + t.depth
      const yTop = t.yBase + t.rise
      walls.push(ellipseRing(prevAOut, prevBOut, prevYTop, t.aIn, t.bIn, t.yBase))
      slopes.push(ellipseRing(t.aIn, t.bIn, t.yBase, aOut, bOut, yTop))
      // 立面上緣緋紅飾帶
      trims.push(ellipseRing(t.aIn - 0.04, t.bIn - 0.04, t.yBase - 0.55, t.aIn - 0.04, t.bIn - 0.04, t.yBase))
      // 立面頂緣積雪細簷
      snows.push(ellipseRing(t.aIn - 0.1, t.bIn - 0.1, t.yBase, t.aIn + 0.22, t.bIn + 0.22, t.yBase + 0.09))
      prevAOut = aOut
      prevBOut = bOut
      prevYTop = yTop
    }
    // 頂圈木護欄 + 緋紅冠帶 + 欄杆頂積雪
    walls.push(ellipseRing(RIM_A, RIM_B, RIM_Y, RIM_A, RIM_B, RAIL_TOP))
    trims.push(ellipseRing(RIM_A + 0.02, RIM_B + 0.02, RAIL_TOP - 0.55, RIM_A + 0.02, RIM_B + 0.02, RAIL_TOP))
    snows.push(ellipseRing(RIM_A - 0.24, RIM_B - 0.24, RAIL_TOP, RIM_A + 0.24, RIM_B + 0.24, RAIL_TOP + 0.12))
    return { slopes, walls, trims, snows }
  }, [])

  return (
    <group>
      {geos.slopes.map((g, i) => (
        <mesh key={`s${i}`} geometry={g}>
          <meshStandardMaterial color={i % 2 === 0 ? STONE_A : STONE_B} roughness={0.95} side={DoubleSide} />
        </mesh>
      ))}
      {geos.walls.map((g, i) => (
        <mesh key={`w${i}`} geometry={g}>
          <meshStandardMaterial color={TIMBER} roughness={0.92} side={DoubleSide} />
        </mesh>
      ))}
      {geos.trims.map((g, i) => (
        <mesh key={`t${i}`} geometry={g}>
          <meshStandardMaterial color={CRIMSON} roughness={0.55} side={DoubleSide} />
        </mesh>
      ))}
      {geos.snows.map((g, i) => (
        <mesh key={`n${i}`} geometry={g}>
          <meshStandardMaterial color={SNOW} roughness={0.85} side={DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

/* ---------- 鳳王聖火（神社風火盆 + 彩虹色調火焰） ---------- */

function makeFlameSheet(): CanvasTexture {
  const FRAMES = 8
  const FW = 128
  const FH = 256
  const c = document.createElement('canvas')
  c.width = FRAMES * FW
  c.height = FH
  const g = c.getContext('2d')!
  g.clearRect(0, 0, c.width, c.height)
  const layer = (ox: number, cx: number, baseY: number, w: number, h: number, color: string, alpha: number) => {
    g.globalAlpha = alpha
    g.fillStyle = color
    g.beginPath()
    g.moveTo(ox + cx, baseY - h)
    g.bezierCurveTo(ox + cx + w * 0.72, baseY - h * 0.55, ox + cx + w * 0.62, baseY - h * 0.08, ox + cx, baseY)
    g.bezierCurveTo(ox + cx - w * 0.62, baseY - h * 0.08, ox + cx - w * 0.72, baseY - h * 0.55, ox + cx, baseY - h)
    g.closePath()
    g.fill()
  }
  // 近白金基調 → 材質端做彩虹 hue-cycle
  for (let f = 0; f < FRAMES; f++) {
    const ox = f * FW
    const j = (n: number) => Math.sin(f * 2.4 + n * 1.7)
    const baseY = FH - 10
    layer(ox, 64 + j(1) * 6, baseY, 58, 200 + j(2) * 22, '#ffd27a', 0.85)
    layer(ox, 64 + j(3) * 8, baseY, 42, 150 + j(4) * 18, '#ffe9b0', 0.9)
    layer(ox, 64 + j(5) * 6, baseY, 27, 100 + j(6) * 14, '#fff6dd', 0.95)
    layer(ox, 34 + j(7) * 5, baseY - 6, 16, 62 + j(8) * 12, '#ffdf90', 0.8)
    layer(ox, 94 + j(9) * 5, baseY - 6, 16, 56 + j(10) * 12, '#ffdf90', 0.8)
  }
  g.globalAlpha = 1
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.repeat.set(1 / FRAMES, 1)
  tex.magFilter = NearestFilter
  return tex
}

function HoOhFlame() {
  const tex = useMemo(() => makeFlameSheet(), [])
  const light = useRef<PointLight>(null)
  const flame = useRef<Group>(null)
  const matA = useRef<MeshBasicMaterial>(null)
  const matB = useRef<MeshBasicMaterial>(null)
  const tint = useMemo(() => new Color(), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    tex.offset.x = (Math.floor(t * 10) % 8) / 8
    // 彩虹 hue-cycle（低飽和，聖火般的微妙虹彩）
    const hue = (t * 0.055) % 1
    tint.setHSL(hue, 0.5, 0.66)
    if (matA.current) matA.current.color.copy(tint).multiplyScalar(2.3)
    if (matB.current) {
      tint.setHSL((hue + 0.14) % 1, 0.5, 0.66)
      matB.current.color.copy(tint).multiplyScalar(2.1)
    }
    if (light.current) {
      light.current.intensity = 55 + Math.sin(t * 9.3) * 11 + Math.sin(t * 23.7) * 5
      light.current.color.setHSL(hue, 0.32, 0.62)
    }
    if (flame.current) flame.current.scale.y = 1 + Math.sin(t * 12.1) * 0.05
  })

  return (
    // 西北看台頂（避開 HUD 主橫幅遮擋，戰鬥視角左上可見）
    <group position={[-23.1, RAIL_TOP, -26.9]} rotation={[0, Math.PI * 0.22, 0]}>
      {/* 石壇 */}
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[5.4, 1.2, 5.4]} />
        <meshStandardMaterial color="#8f959f" roughness={0.95} />
      </mesh>
      {/* 神社四柱（緋紅） */}
      {([[-2.1, -2.1], [2.1, -2.1], [-2.1, 2.1], [2.1, 2.1]] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 2.9, z]}>
          <boxGeometry args={[0.32, 3.4, 0.32]} />
          <meshStandardMaterial color={CRIMSON} roughness={0.6} />
        </mesh>
      ))}
      {/* 神社屋頂（積雪的入母屋意象：深瓦 + 雪簷） */}
      <mesh position={[0, 4.95, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[4.6, 1.7, 4]} />
        <meshStandardMaterial color="#343a4c" roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0, 5.35, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[3.1, 1.15, 4]} />
        <meshStandardMaterial color={SNOW} roughness={0.9} flatShading />
      </mesh>
      {/* 金頂珠 */}
      <mesh position={[0, 6.1, 0]}>
        <sphereGeometry args={[0.3, 10, 8]} />
        <meshStandardMaterial color="#d8a838" metalness={0.7} roughness={0.35} />
      </mesh>
      {/* 聖火盆 */}
      <mesh position={[0, 1.95, 0]}>
        <cylinderGeometry args={[1.95, 1.0, 1.55, 12]} />
        <meshStandardMaterial color="#b9bec8" roughness={0.8} />
      </mesh>
      {/* 盆內熾熱餘燼 */}
      <mesh position={[0, 2.76, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.7, 18]} />
        <meshBasicMaterial color={[2.8, 1.9, 0.9]} toneMapped={false} />
      </mesh>
      {/* 彩虹聖火（交叉 billboard 動畫幀） */}
      <group ref={flame} position={[0, 2.8, 0]}>
        <mesh position={[0, 2.3, 0]}>
          <planeGeometry args={[3.1, 4.7]} />
          <meshBasicMaterial
            ref={matA} map={tex} transparent blending={AdditiveBlending}
            depthWrite={false} side={DoubleSide} toneMapped={false} fog={false}
          />
        </mesh>
        <mesh position={[0, 2.3, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[3.1, 4.7]} />
          <meshBasicMaterial
            ref={matB} map={tex} transparent blending={AdditiveBlending}
            depthWrite={false} side={DoubleSide} toneMapped={false} fog={false}
          />
        </mesh>
      </group>
      <pointLight ref={light} position={[0, 5.2, 0]} color="#ffb060" distance={75} decay={1.7} intensity={55} />
    </group>
  )
}

/* ---------- 高山寒霧（低空飄移霧片） ---------- */

function makeMistTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128)
  grad.addColorStop(0, 'rgba(226, 234, 246, 0.4)')
  grad.addColorStop(0.6, 'rgba(226, 234, 246, 0.16)')
  grad.addColorStop(1, 'rgba(226, 234, 246, 0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  return new CanvasTexture(c)
}

function ColdMist() {
  const tex = useMemo(() => makeMistTexture(), [])
  const refs = useRef<(Mesh | null)[]>([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    refs.current.forEach((m, i) => {
      if (!m) return
      m.position.x = Math.sin(t * 0.05 + i * 2.4) * 10
      m.position.z = Math.cos(t * 0.04 + i * 1.7) * 6
    })
  })
  const planes: { y: number; s: number; o: number }[] = [
    { y: 0.7, s: 60, o: 0.1 },
    { y: 1.6, s: 85, o: 0.07 },
    { y: 2.8, s: 110, o: 0.05 },
  ]
  return (
    <group>
      {planes.map((p, i) => (
        <mesh
          key={i}
          ref={(el) => { refs.current[i] = el }}
          rotation={[-Math.PI / 2, 0, i * 1.2]}
          position={[0, p.y, 0]}
        >
          <planeGeometry args={[p.s, p.s * 0.7]} />
          <meshBasicMaterial map={tex} transparent opacity={p.o} depthWrite={false} fog={false} />
        </mesh>
      ))}
    </group>
  )
}

/* ---------- 細雪（GPU points） ---------- */

const SNOW_COUNT = 520

function Snowfall() {
  const { points, mat } = useMemo(() => {
    const pos = new Float32Array(SNOW_COUNT * 3)
    const ph = new Float32Array(SNOW_COUNT)
    for (let i = 0; i < SNOW_COUNT; i++) {
      const r = Math.sqrt(Math.random()) * 52
      const a = Math.random() * Math.PI * 2
      pos[i * 3] = Math.cos(a) * r
      pos[i * 3 + 1] = Math.random() * 26
      pos[i * 3 + 2] = Math.sin(a) * r * 0.78
      ph[i] = Math.random()
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
    geo.setAttribute('aPh', new Float32BufferAttribute(ph, 1))
    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        uniform float uTime;
        attribute float aPh;
        varying float vA;
        void main() {
          float y = mod(position.y - uTime * (0.9 + aPh * 0.9), 26.0);
          vec3 p = vec3(
            position.x + sin(uTime * 0.6 + aPh * 6.2831) * 1.6,
            y,
            position.z + cos(uTime * 0.5 + aPh * 6.2831) * 1.2
          );
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (2.0 + aPh * 3.0) * (120.0 / max(1.0, -mv.z));
          vA = smoothstep(0.0, 2.0, y) * smoothstep(26.0, 23.0, y);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d);
          if (r > 0.5) discard;
          gl_FragColor = vec4(0.88, 0.92, 0.99, vA * 0.55 * (1.0 - r * 1.6));
        }
      `,
    })
    const pts = new Points(geo, material)
    pts.frustumCulled = false
    return { points: pts, mat: material }
  }, [])
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime
  })
  return <primitive object={points} />
}

/* ---------- 主組件：布景 ---------- */

export default function Gen2Silver() {
  return (
    <>
      <AlpineSky />
      <Environment files="/assets/hdri/snowy_forest_2k.hdr" environmentIntensity={0.28} />

      {/* 冷藍調主光（唯一投影光源） */}
      <directionalLight
        position={[-22, 30, 14]}
        intensity={1.0}
        color="#a9bdec"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-far={70}
        shadow-bias={-0.0004}
      />
      <hemisphereLight args={['#7e8fb8', '#2c3240', 0.5]} />
      <ambientLight intensity={0.13} color="#8898c4" />

      {/* 雪原地面（延伸至霧線） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]}>
        <circleGeometry args={[230, 40]} />
        <meshStandardMaterial color="#9ba6ba" roughness={1} />
      </mesh>

      <MtSilver />
      <PineRing />
      <StoneStands />
      <Crowd tiers={G2_TIERS} style="gba" brightness={[0.6, 0.9]} />
      <HoOhFlame />
      <ColdMist />
      <Snowfall />
    </>
  )
}

/* ================= 戰鬥地板（機械旋轉換場） ================= */

/** 決定性偽隨機 */
function rng(seed: number) {
  let s = (seed * 2654435761) % 4294967296
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

function drawBoundary(g: CanvasRenderingContext2D, W: number, H: number, withCircle = true) {
  const M = 60
  g.strokeStyle = 'rgba(250,250,250,0.9)'
  g.lineWidth = 8
  g.strokeRect(M, M, W - M * 2, H - M * 2)
  if (withCircle) {
    g.beginPath()
    g.arc(W / 2, H / 2, 165, 0, Math.PI * 2)
    g.stroke()
    g.beginPath()
    g.moveTo(W / 2 - 165, H / 2)
    g.lineTo(W / 2 + 165, H / 2)
    g.stroke()
  }
}

/** 白銀版四場地貼圖：Gen1 四種look 的高山雪化變體（雪斑 + 角落雪堆） */
function makeG2FieldCanvas(type: FieldType): HTMLCanvasElement {
  const W = 1600
  const H = 960
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const r = rng(type.length * 977 + 31)

  if (type === 'grass') {
    g.fillStyle = '#48824a' // 冷調高山草
    g.fillRect(0, 0, W, H)
    for (let i = 0; i < 80; i++) {
      g.fillStyle = 'rgba(108, 168, 104, 0.18)'
      g.beginPath()
      g.ellipse(r() * W, r() * H, 30 + r() * 80, 20 + r() * 50, r() * Math.PI, 0, Math.PI * 2)
      g.fill()
    }
    g.strokeStyle = 'rgba(24, 70, 34, 0.55)'
    g.lineWidth = 3
    for (let i = 0; i < 800; i++) {
      const x = r() * W
      const y = r() * H
      const s = 4 + r() * 5
      g.beginPath()
      g.moveTo(x - s, y + s)
      g.lineTo(x, y - s)
      g.lineTo(x + s, y + s)
      g.stroke()
    }
    drawBoundary(g, W, H)
  } else if (type === 'rock') {
    g.fillStyle = '#7d6a55'
    g.fillRect(0, 0, W, H)
    for (let i = 0; i < 70; i++) {
      g.fillStyle = i % 2 ? 'rgba(150, 128, 100, 0.35)' : 'rgba(88, 72, 56, 0.32)'
      g.beginPath()
      g.ellipse(r() * W, r() * H, 40 + r() * 110, 26 + r() * 70, r() * Math.PI, 0, Math.PI * 2)
      g.fill()
    }
    g.strokeStyle = 'rgba(56, 44, 30, 0.75)'
    for (let i = 0; i < 44; i++) {
      g.lineWidth = 2 + r() * 3
      let x = r() * W
      let y = r() * H
      g.beginPath()
      g.moveTo(x, y)
      const seg = 3 + ((r() * 4) | 0)
      for (let sgm = 0; sgm < seg; sgm++) {
        x += (r() - 0.5) * 130
        y += (r() - 0.5) * 90
        g.lineTo(x, y)
      }
      g.stroke()
    }
    for (let i = 0; i < 240; i++) {
      g.fillStyle = r() > 0.5 ? 'rgba(48,36,24,0.6)' : 'rgba(190,168,140,0.5)'
      g.fillRect(r() * W, r() * H, 3 + r() * 5, 3 + r() * 4)
    }
    drawBoundary(g, W, H)
  } else if (type === 'water') {
    const grad = g.createLinearGradient(0, 0, W, H)
    grad.addColorStop(0, '#2a5fb4')
    grad.addColorStop(1, '#1f4a92')
    g.fillStyle = grad
    g.fillRect(0, 0, W, H)
    g.strokeStyle = 'rgba(255,255,255,0.22)'
    g.lineWidth = 3
    for (let i = 0; i < 150; i++) {
      const x = r() * W
      const y = r() * H
      const w = 18 + r() * 46
      g.beginPath()
      g.arc(x, y, w, Math.PI * 0.15, Math.PI * 0.85)
      g.stroke()
    }
    // 冰緣浮台（高山湖風）
    const pads: [number, number][] = [
      [0.2, 0.3], [0.5, 0.24], [0.8, 0.32],
      [0.22, 0.72], [0.52, 0.78], [0.8, 0.7],
    ]
    for (const [px, py] of pads) {
      const x = px * W
      const y = py * H
      g.fillStyle = '#9aa8b8'
      g.beginPath()
      g.arc(x, y, 96, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#d9e2ec'
      g.beginPath()
      g.arc(x, y, 86, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = 'rgba(150, 168, 190, 0.5)'
      g.beginPath()
      g.arc(x, y, 62, 0, Math.PI * 2)
      g.fill()
    }
    drawBoundary(g, W, H, false)
  } else {
    // ice
    g.fillStyle = '#c8e2f2'
    g.fillRect(0, 0, W, H)
    g.strokeStyle = 'rgba(255,255,255,0.5)'
    for (let i = 0; i < 120; i++) {
      g.lineWidth = 1.5 + r() * 2
      const x = r() * W
      const y = r() * H
      const len = 60 + r() * 200
      const angDeg = -0.4 + r() * 0.8
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + Math.cos(angDeg) * len, y + Math.sin(angDeg) * len)
      g.stroke()
    }
    g.strokeStyle = 'rgba(110, 160, 195, 0.55)'
    for (let i = 0; i < 26; i++) {
      g.lineWidth = 1.6
      let x = r() * W
      let y = r() * H
      g.beginPath()
      g.moveTo(x, y)
      for (let sgm = 0; sgm < 4; sgm++) {
        x += (r() - 0.5) * 180
        y += (r() - 0.5) * 120
        g.lineTo(x, y)
      }
      g.stroke()
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = 'rgba(160, 210, 235, 0.3)'
      g.beginPath()
      g.ellipse(r() * W, r() * H, 30 + r() * 90, 20 + r() * 60, r() * Math.PI, 0, Math.PI * 2)
      g.fill()
    }
    drawBoundary(g, W, H)
  }

  // 全場雪化：細雪斑 + 邊角雪堆
  for (let i = 0; i < 320; i++) {
    g.fillStyle = 'rgba(238, 244, 250, 0.5)'
    g.fillRect(r() * W, r() * H, 2 + r() * 4, 2 + r() * 3)
  }
  g.fillStyle = 'rgba(235, 242, 250, 0.55)'
  const corners: [number, number][] = [[40, 40], [W - 40, 40], [40, H - 40], [W - 40, H - 40]]
  for (const [cx, cy] of corners) {
    for (let i = 0; i < 7; i++) {
      g.beginPath()
      g.ellipse(cx + (r() - 0.5) * 150, cy + (r() - 0.5) * 110, 26 + r() * 46, 14 + r() * 24, r() * Math.PI, 0, Math.PI * 2)
      g.fill()
    }
  }
  return c
}

/** 出場鋼板貼圖：鋼灰面板線 + 邊緣警示斜紋 + 緋紅中圈 */
function makePlateCanvas(): HTMLCanvasElement {
  const W = 1600
  const H = 960
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = '#454c58'
  g.fillRect(0, 0, W, H)
  // 面板格線
  g.strokeStyle = 'rgba(20, 24, 32, 0.55)'
  g.lineWidth = 5
  for (let x = 0; x <= W; x += 200) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke()
  }
  for (let y = 0; y <= H; y += 192) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke()
  }
  // 鉚釘
  g.fillStyle = 'rgba(160, 170, 185, 0.6)'
  for (let x = 100; x < W; x += 200) {
    for (let y = 96; y < H; y += 192) {
      g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill()
    }
  }
  // 中央緋紅圈 + 精靈球線
  g.strokeStyle = '#a32330'
  g.lineWidth = 16
  g.beginPath(); g.arc(W / 2, H / 2, 170, 0, Math.PI * 2); g.stroke()
  g.beginPath(); g.moveTo(W / 2 - 170, H / 2); g.lineTo(W / 2 + 170, H / 2); g.stroke()
  // 中央接縫兩側警示斜紋（整張 = 完整場地，之後左右各取一半）
  for (const ex of [W / 2 - 70, W / 2 + 10]) {
    for (let y = -90; y < H; y += 60) {
      g.fillStyle = '#d8b02a'
      g.beginPath()
      g.moveTo(ex, y + 30); g.lineTo(ex + 60, y - 40 + 30)
      g.lineTo(ex + 60, y - 10 + 30); g.lineTo(ex, y + 60 + 30)
      g.closePath(); g.fill()
      g.fillStyle = '#22252c'
      g.beginPath()
      g.moveTo(ex, y + 60 + 30); g.lineTo(ex + 60, y + 20)
      g.lineTo(ex + 60, y + 50); g.lineTo(ex, y + 90 + 30)
      g.closePath(); g.fill()
    }
  }
  // 接縫線
  g.fillStyle = '#14171d'
  g.fillRect(W / 2 - 6, 0, 12, H)
  return c
}

const G2_SURFACE: Record<FieldType, { rough: number; env: number; base: string }> = {
  grass: { rough: 0.92, env: 0.35, base: '#22401f' },
  rock: { rough: 0.97, env: 0.25, base: '#403222' },
  water: { rough: 0.32, env: 0.9, base: '#10294e' },
  ice: { rough: 0.07, env: 1.7, base: '#7fa8bc' },
}

function halfTextures(canvas: HTMLCanvasElement): [CanvasTexture, CanvasTexture] {
  const mk = (offX: number) => {
    const t = new CanvasTexture(canvas)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 8
    t.repeat.set(0.5, 1)
    t.offset.set(offX, 0)
    return t
  }
  return [mk(0), mk(0.5)]
}

const easeSm = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

const SWAP_END = 4.2

/** 白銀大會戰鬥地板：碰撞恆定（40×24 頂面 y=0 + 擋牆），視覺演出機械換場 */
export function Gen2SilverFloor({ fieldType }: { fieldType?: FieldType | null }) {
  const ft: FieldType = fieldType ?? 'grass'
  const surf = G2_SURFACE[ft]

  const { texL, texR, plateL: plateTexL, plateR: plateTexR, dustPts, dustMat } = useMemo(() => {
    const [l, rr] = halfTextures(makeG2FieldCanvas(ft))
    const [pl, pr] = halfTextures(makePlateCanvas())
    // 塵霧 points（換場鎖定時的塵爆）
    const N = 14
    const pos = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2
      pos[i * 3] = Math.cos(ang) * 19
      pos[i * 3 + 1] = 0.3
      pos[i * 3 + 2] = Math.sin(ang) * 11.4
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
    const mist = makeMistTexture()
    const dm = new PointsMaterial({
      map: mist, transparent: true, opacity: 0, size: 2, depthWrite: false,
      color: '#c9c3b8', sizeAttenuation: true,
    })
    const dp = new Points(geo, dm)
    dp.frustumCulled = false
    dp.visible = false
    return { texL: l, texR: rr, plateL: pl, plateR: pr, dustPts: dp, dustMat: dm }
  }, [ft])

  const carousel = useRef<Group>(null)
  const plateL = useRef<Group>(null)
  const plateR = useRef<Group>(null)
  const rumble = useRef<Group>(null)
  const warnMaterial = useMemo(
    () => new MeshBasicMaterial({ color: new Color(2.6, 0.5, 0.25), toneMapped: false }),
    [],
  )
  const t0 = useRef<number | null>(null)
  const done = useRef(false)

  useFrame(({ clock }) => {
    if (t0.current === null) t0.current = clock.elapsedTime
    const t = clock.elapsedTime - t0.current
    if (done.current) return
    if (t > SWAP_END + 0.5) {
      // 收尾：確保終態精確
      if (carousel.current) {
        carousel.current.rotation.y = 0
        carousel.current.position.set(0, 0, 0)
      }
      if (plateL.current) plateL.current.visible = false
      if (plateR.current) plateR.current.visible = false
      if (rumble.current) rumble.current.position.set(0, 0, 0)
      warnMaterial.color.setRGB(0.35, 0.08, 0.08)
      dustPts.visible = false
      done.current = true
      return
    }

    // 1) 舊鋼板滑出（0.5s–1.8s）
    const ps = easeSm((t - 0.5) / 1.3)
    if (plateL.current) {
      plateL.current.position.set(-10 - 18 * ps, -0.02 - 1.5 * ps, 0)
      plateL.current.rotation.z = -0.14 * ps
      plateL.current.visible = ps < 1
    }
    if (plateR.current) {
      plateR.current.position.set(10 + 18 * ps, -0.02 - 1.5 * ps, 0)
      plateR.current.rotation.z = 0.14 * ps
      plateR.current.visible = ps < 1
    }

    // 2) 新場地轉盤旋入（1.0s–2.8s）：半圈旋轉 + 緩升
    const cs = easeSm((t - 1.0) / 1.8)
    // 3) 活塞頂升鎖定（2.8s–3.5s）
    const ls = easeSm((t - 2.8) / 0.7)
    if (carousel.current) {
      carousel.current.rotation.y = -Math.PI * (1 - cs)
      carousel.current.position.y = -1.7 + 1.25 * cs + 0.45 * ls
    }

    // 震動（rumble：帶包絡的高頻抖動；含塵爆時刻的重擊）
    const env =
      t < 0.35 ? t / 0.35 :
      t < 3.4 ? 1 :
      t < 3.9 ? (3.9 - t) / 0.5 : 0
    const thump = t > 3.4 && t < 3.65 ? (3.65 - t) / 0.25 : 0
    if (rumble.current) {
      rumble.current.position.y = Math.sin(t * 43) * 0.02 * env - 0.05 * thump
      rumble.current.position.x = Math.sin(t * 31) * 0.014 * env
    }

    // 警示燈（換場中閃爍緋紅/琥珀）
    {
      const blink = t < 3.5 ? (Math.sin(t * 14) > 0 ? 1 : 0.12) : Math.max(0.12, 1 - (t - 3.5) * 2)
      warnMaterial.color.setRGB(2.6 * blink, 0.5 * blink, 0.25 * blink)
    }

    // 塵爆（3.4s 鎖定時）
    const ds = (t - 3.4) / 1.0
    if (ds > 0 && ds < 1) {
      dustPts.visible = true
      dustMat.opacity = (1 - ds) * 0.55
      dustMat.size = 2.5 + 6 * ds
      dustPts.position.y = 0.25 + 0.9 * ds
    } else {
      dustPts.visible = ds >= 1 ? false : dustPts.visible
    }
  })

  // 警示燈位置（機坑邊框上 8 顆）
  const warnPos = useMemo(() => {
    const arr: [number, number, number][] = []
    for (const x of [-15, -5, 5, 15]) {
      arr.push([x, 0.12, 12.55], [x, 0.12, -12.55])
    }
    return arr
  }, [])

  return (
    <>
      {/* 碰撞體（恆定，與宮門一致：40×24 頂面 y=0 + 四面隱形擋牆） */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[20, 0.25, 12]} position={[0, -0.25, 0]} />
        <CuboidCollider args={[0.3, 2, 12.6]} position={[20.9, 1.5, 0]} />
        <CuboidCollider args={[0.3, 2, 12.6]} position={[-20.9, 1.5, 0]} />
        <CuboidCollider args={[21.2, 2, 0.3]} position={[0, 1.5, 12.9]} />
        <CuboidCollider args={[21.2, 2, 0.3]} position={[0, 1.5, -12.9]} />
      </RigidBody>

      {/* 機坑 + 邊框（受震動群組） */}
      <group ref={rumble}>
        {/* 機坑（防穿幫深色箱） */}
        <mesh position={[0, -1.55, 0]}>
          <boxGeometry args={[40.8, 2.6, 24.8]} />
          <meshStandardMaterial color="#121419" roughness={1} />
        </mesh>
        {/* 鋼框（緋紅飾線） */}
        <mesh position={[0, -0.12, 12.55]}>
          <boxGeometry args={[42.2, 0.42, 0.9]} />
          <meshStandardMaterial color="#39404d" roughness={0.6} metalness={0.4} />
        </mesh>
        <mesh position={[0, -0.12, -12.55]}>
          <boxGeometry args={[42.2, 0.42, 0.9]} />
          <meshStandardMaterial color="#39404d" roughness={0.6} metalness={0.4} />
        </mesh>
        <mesh position={[21.05, -0.12, 0]}>
          <boxGeometry args={[0.9, 0.42, 25.4]} />
          <meshStandardMaterial color="#39404d" roughness={0.6} metalness={0.4} />
        </mesh>
        <mesh position={[-21.05, -0.12, 0]}>
          <boxGeometry args={[0.9, 0.42, 25.4]} />
          <meshStandardMaterial color="#39404d" roughness={0.6} metalness={0.4} />
        </mesh>
        {/* 警示燈（共用單一材質實例，useFrame 直接改色） */}
        {warnPos.map((p, i) => (
          <mesh key={i} position={p} material={warnMaterial}>
            <boxGeometry args={[0.5, 0.1, 0.26]} />
          </mesh>
        ))}
      </group>

      {/* 舊鋼板（兩半，開場滑出） */}
      <group ref={plateL} position={[-10, -0.02, 0]}>
        <mesh>
          <boxGeometry args={[20, 0.36, 24]} />
          <meshStandardMaterial color="#3d434f" roughness={0.55} metalness={0.5} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.185, 0]}>
          <planeGeometry args={[20, 24]} />
          <meshStandardMaterial map={plateTexL} roughness={0.5} metalness={0.45} />
        </mesh>
      </group>
      <group ref={plateR} position={[10, -0.02, 0]}>
        <mesh>
          <boxGeometry args={[20, 0.36, 24]} />
          <meshStandardMaterial color="#3d434f" roughness={0.55} metalness={0.5} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.185, 0]}>
          <planeGeometry args={[20, 24]} />
          <meshStandardMaterial map={plateTexR} roughness={0.5} metalness={0.45} />
        </mesh>
      </group>

      {/* 新場地轉盤（兩半模組 + 活塞柱） */}
      <group ref={carousel} position={[0, -1.7, 0]} rotation={[0, -Math.PI, 0]}>
        {/* 左半 */}
        <mesh position={[-10, -0.26, 0]}>
          <boxGeometry args={[20, 0.5, 24]} />
          <meshStandardMaterial color={surf.base} roughness={1} />
        </mesh>
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[-10, 0.002, 0]}>
          <planeGeometry args={[20, 24]} />
          <meshStandardMaterial map={texL} roughness={surf.rough} metalness={0} envMapIntensity={surf.env} />
        </mesh>
        {/* 右半 */}
        <mesh position={[10, -0.26, 0]}>
          <boxGeometry args={[20, 0.5, 24]} />
          <meshStandardMaterial color={surf.base} roughness={1} />
        </mesh>
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[10, 0.002, 0]}>
          <planeGeometry args={[20, 24]} />
          <meshStandardMaterial map={texR} roughness={surf.rough} metalness={0} envMapIntensity={surf.env} />
        </mesh>
        {/* 活塞柱（旋入/頂升時可見） */}
        {([[-14, -8], [0, -8], [14, -8], [-14, 8], [0, 8], [14, 8]] as const).map(([x, z], i) => (
          <mesh key={i} position={[x, -1.6, z]}>
            <cylinderGeometry args={[0.55, 0.55, 2.4, 8]} />
            <meshStandardMaterial color="#565e6c" roughness={0.5} metalness={0.6} />
          </mesh>
        ))}
      </group>

      {/* 鎖定塵爆 */}
      <primitive object={dustPts} />

      {/* 場外雪石廣場（純視覺） */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[130, 100]} />
        <meshStandardMaterial color="#8d95a6" roughness={1} />
      </mesh>
    </>
  )
}
