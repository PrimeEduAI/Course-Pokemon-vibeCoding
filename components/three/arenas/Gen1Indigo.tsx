'use client'
import { Environment } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  PointLight,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { ellipseRing, type Tier } from './geometry'
import Crowd from './Crowd'

/**
 * Gen 1 石英高原・石英大會：
 * 黃昏露天石造體育場（石灰岩 + 靛藍 #2b3a6b）、三角旗、復古像素記分板、
 * 火焰鳥聖火（動畫火焰 + 閃爍點光源）、遠山剪影環。
 */

const G1_TIERS: Tier[] = [
  { aIn: 25.0, bIn: 17.5, yBase: 2.2, depth: 7.0, rise: 3.2, rows: 10 },
  { aIn: 32.8, bIn: 25.3, yBase: 6.2, depth: 7.5, rise: 3.8, rows: 11 },
]
// 頂圈（護欄基準）
const RIM_A = G1_TIERS[1].aIn + G1_TIERS[1].depth // 40.3
const RIM_B = G1_TIERS[1].bIn + G1_TIERS[1].depth // 32.8
const RIM_Y = G1_TIERS[1].yBase + G1_TIERS[1].rise // 10.0
const RAIL_TOP = RIM_Y + 1.4

const INDIGO = '#2b3a6b'
const STONE_A = '#cfc8ba'
const STONE_B = '#c1b9a9'
const STONE_WALL = '#a8a094'

/* ---------- 黃昏天空 + 遠山 ---------- */

function makeSkyTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 512
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 512)
  grad.addColorStop(0, '#232a55')   // 天頂靛藍
  grad.addColorStop(0.42, '#54497e')
  grad.addColorStop(0.62, '#a05f74')
  grad.addColorStop(0.78, '#e08a5e')
  grad.addColorStop(0.9, '#ffb478') // 地平線橘粉
  grad.addColorStop(1, '#ffc890')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 512)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function makeMountainTexture(): CanvasTexture {
  const W = 1024
  const H = 256
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.clearRect(0, 0, W, H)
  const grad = g.createLinearGradient(0, 60, 0, H)
  grad.addColorStop(0, '#4a4670')
  grad.addColorStop(1, '#6a5a80')
  g.fillStyle = grad
  // 鋸齒稜線（首尾同高以便無縫）
  g.beginPath()
  g.moveTo(0, H)
  let y = 130
  g.lineTo(0, y)
  const peaks = 14
  for (let i = 1; i <= peaks; i++) {
    const x = (i / peaks) * W
    y = i === peaks ? 130 : 62 + ((i * 73) % 97)
    g.lineTo(x - W / peaks / 2, y)
    g.lineTo(x, Math.min(200, y + 46 + ((i * 31) % 40)))
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

function DuskSky() {
  const sky = useMemo(() => makeSkyTexture(), [])
  const mountain = useMemo(() => makeMountainTexture(), [])
  return (
    <>
      <color attach="background" args={['#e09a72']} />
      <fog attach="fog" args={['#e09a72', 90, 260]} />
      <mesh>
        <sphereGeometry args={[240, 24, 16]} />
        <meshBasicMaterial map={sky} side={BackSide} fog={false} depthWrite={false} />
      </mesh>
      {/* 遠山剪影環 */}
      <mesh position={[0, 14, 0]}>
        <cylinderGeometry args={[205, 205, 46, 48, 1, true]} />
        <meshBasicMaterial map={mountain} transparent alphaTest={0.5} side={BackSide} fog={false} />
      </mesh>
    </>
  )
}

/* ---------- 石造看台 ---------- */

function StoneStands() {
  const geos = useMemo(() => {
    const slopes: BufferGeometry[] = []
    const walls: BufferGeometry[] = []
    const trims: BufferGeometry[] = []
    let prevAOut = G1_TIERS[0].aIn
    let prevBOut = G1_TIERS[0].bIn
    let prevYTop = -0.5
    for (const t of G1_TIERS) {
      const aOut = t.aIn + t.depth
      const bOut = t.bIn + t.depth
      const yTop = t.yBase + t.rise
      walls.push(ellipseRing(prevAOut, prevBOut, prevYTop, t.aIn, t.bIn, t.yBase))
      slopes.push(ellipseRing(t.aIn, t.bIn, t.yBase, aOut, bOut, yTop))
      // 立面上緣靛藍飾帶
      trims.push(ellipseRing(t.aIn - 0.04, t.bIn - 0.04, t.yBase - 0.5, t.aIn - 0.04, t.bIn - 0.04, t.yBase))
      prevAOut = aOut
      prevBOut = bOut
      prevYTop = yTop
    }
    // 頂圈護欄 + 靛藍冠帶
    walls.push(ellipseRing(RIM_A, RIM_B, RIM_Y, RIM_A, RIM_B, RAIL_TOP))
    trims.push(ellipseRing(RIM_A + 0.02, RIM_B + 0.02, RAIL_TOP - 0.5, RIM_A + 0.02, RIM_B + 0.02, RAIL_TOP))
    return { slopes, walls, trims }
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
          <meshStandardMaterial color={STONE_WALL} roughness={0.92} side={DoubleSide} />
        </mesh>
      ))}
      {geos.trims.map((g, i) => (
        <mesh key={`t${i}`} geometry={g}>
          <meshStandardMaterial color={INDIGO} roughness={0.6} side={DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

/* ---------- 三角旗串 ---------- */

const POLE_COUNT = 12
const FLAGS_PER_SPAN = 12
const FLAG_COLORS = ['#e84040', '#f0c030', '#3868e0', '#38b060', '#f0f0e8', '#f08030']

function Pennants() {
  const uTime = useMemo(() => ({ value: 0 }), [])

  const { flags, strings, poles } = useMemo(() => {
    // 旗桿頂點
    const tops: Vector3[] = []
    for (let i = 0; i < POLE_COUNT; i++) {
      const ang = (i / POLE_COUNT) * Math.PI * 2
      tops.push(new Vector3(Math.cos(ang) * (RIM_A - 0.6), RAIL_TOP + 2.3, Math.sin(ang) * (RIM_B - 0.6)))
    }

    // 三角旗幾何：上緣掛在原點、旗尖朝下
    const tri = new BufferGeometry()
    tri.setAttribute('position', new Float32BufferAttribute([-0.17, 0, 0, 0.17, 0, 0, 0, -0.52, 0], 3))
    tri.computeVertexNormals()

    const mat = new MeshBasicMaterial({ side: DoubleSide })
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime
      shader.vertexShader = `uniform float uTime;\n${shader.vertexShader.replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          'float fph = float(gl_InstanceID);',
          // 旗尖隨風擺動（越靠旗尖振幅越大）
          'transformed.z += sin(uTime * 3.2 + fph * 1.31 + transformed.y * 4.0) * (-transformed.y) * 0.5;',
        ].join('\n'),
      )}`
    }

    const flagMesh = new InstancedMesh(tri, mat, POLE_COUNT * FLAGS_PER_SPAN)
    const m4 = new Matrix4()
    const q = new Quaternion()
    const e = new Euler()
    const pos = new Vector3()
    const sc = new Vector3(1, 1, 1)
    const color = new Color()
    const stringPts: number[] = []
    let fi = 0
    for (let i = 0; i < POLE_COUNT; i++) {
      const a = tops[i]
      const b = tops[(i + 1) % POLE_COUNT]
      const dir = new Vector3().subVectors(b, a)
      const yaw = Math.atan2(-dir.z, dir.x)
      // 旗串（弧線取樣做垂繩）
      let prev: Vector3 | null = null
      for (let s = 0; s <= 10; s++) {
        const t = s / 10
        const p = new Vector3().lerpVectors(a, b, t)
        p.y -= Math.sin(Math.PI * t) * 0.9
        if (prev) stringPts.push(prev.x, prev.y, prev.z, p.x, p.y, p.z)
        prev = p
      }
      for (let j = 0; j < FLAGS_PER_SPAN; j++) {
        const t = (j + 0.5) / FLAGS_PER_SPAN
        pos.lerpVectors(a, b, t)
        pos.y -= Math.sin(Math.PI * t) * 0.9
        e.set(0, yaw, 0)
        q.setFromEuler(e)
        m4.compose(pos, q, sc)
        flagMesh.setMatrixAt(fi, m4)
        color.set(FLAG_COLORS[(i + j) % FLAG_COLORS.length])
        flagMesh.setColorAt(fi, color)
        fi++
      }
    }
    flagMesh.instanceMatrix.needsUpdate = true
    if (flagMesh.instanceColor) flagMesh.instanceColor.needsUpdate = true
    flagMesh.frustumCulled = false

    const stringGeo = new BufferGeometry()
    stringGeo.setAttribute('position', new Float32BufferAttribute(stringPts, 3))

    // 旗桿（instanced 細柱）
    const poleMesh = (() => {
      const geoH = 2.5
      const m = new InstancedMesh(
        new BoxGeometry(0.12, geoH, 0.12),
        new MeshStandardMaterial({ color: '#8d8578', roughness: 0.9 }),
        POLE_COUNT,
      )
      const mm = new Matrix4()
      tops.forEach((p, i) => {
        mm.makeTranslation(p.x, p.y - geoH / 2 + 0.1, p.z)
        m.setMatrixAt(i, mm)
      })
      m.instanceMatrix.needsUpdate = true
      m.frustumCulled = false
      return m
    })()

    return { flags: flagMesh, strings: stringGeo, poles: poleMesh }
  }, [uTime])

  useFrame(({ clock }) => {
    uTime.value = clock.elapsedTime
  })

  return (
    <group>
      <primitive object={flags} />
      <primitive object={poles} />
      <lineSegments geometry={strings}>
        <lineBasicMaterial color="#ded6c4" />
      </lineSegments>
    </group>
  )
}

/* ---------- 火焰鳥聖火 ---------- */

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
    // 淚滴形火舌：底寬上尖
    g.moveTo(ox + cx, baseY - h)
    g.bezierCurveTo(ox + cx + w * 0.72, baseY - h * 0.55, ox + cx + w * 0.62, baseY - h * 0.08, ox + cx, baseY)
    g.bezierCurveTo(ox + cx - w * 0.62, baseY - h * 0.08, ox + cx - w * 0.72, baseY - h * 0.55, ox + cx, baseY - h)
    g.closePath()
    g.fill()
  }

  for (let f = 0; f < FRAMES; f++) {
    const ox = f * FW
    const j = (n: number) => Math.sin(f * 2.4 + n * 1.7) // 每幀決定性抖動
    const baseY = FH - 10
    layer(ox, 64 + j(1) * 6, baseY, 58, 200 + j(2) * 22, '#ff6a10', 0.85)
    layer(ox, 64 + j(3) * 8, baseY, 42, 150 + j(4) * 18, '#ffa030', 0.9)
    layer(ox, 64 + j(5) * 6, baseY, 27, 100 + j(6) * 14, '#ffdf70', 0.95)
    // 側火舌
    layer(ox, 34 + j(7) * 5, baseY - 6, 16, 62 + j(8) * 12, '#ff8828', 0.8)
    layer(ox, 94 + j(9) * 5, baseY - 6, 16, 56 + j(10) * 12, '#ff8828', 0.8)
  }
  g.globalAlpha = 1

  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.repeat.set(1 / FRAMES, 1)
  tex.magFilter = NearestFilter // 略帶復古顆粒
  return tex
}

function SacredFlame() {
  const tex = useMemo(() => makeFlameSheet(), [])
  const light = useRef<PointLight>(null)
  const flame = useRef<Group>(null)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    tex.offset.x = (Math.floor(t * 10) % 8) / 8
    if (light.current) light.current.intensity = 60 + Math.sin(t * 9.3) * 12 + Math.sin(t * 23.7) * 6
    if (flame.current) flame.current.scale.y = 1 + Math.sin(t * 12.1) * 0.05
  })

  // 位於遠端（-Z）看台頂
  return (
    <group position={[0, RAIL_TOP, -(RIM_B - 2.2)]}>
      {/* 石基座 */}
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[4.4, 1.4, 4.4]} />
        <meshStandardMaterial color={STONE_WALL} roughness={0.95} />
      </mesh>
      {/* 聖火盆 */}
      <mesh position={[0, 2.3, 0]}>
        <cylinderGeometry args={[2.3, 1.15, 1.9, 14]} />
        <meshStandardMaterial color={STONE_A} roughness={0.85} />
      </mesh>
      {/* 盆內熾熱餘燼 */}
      <mesh position={[0, 3.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.0, 20]} />
        <meshBasicMaterial color={[3.2, 1.5, 0.4]} toneMapped={false} />
      </mesh>
      {/* 火焰（兩片交叉 billboard 動畫幀） */}
      <group ref={flame} position={[0, 3.3, 0]}>
        {[0, Math.PI / 2].map((ry) => (
          <mesh key={ry} position={[0, 2.6, 0]} rotation={[0, ry, 0]}>
            <planeGeometry args={[3.4, 5.2]} />
            <meshBasicMaterial
              map={tex}
              color={[2.4, 1.7, 1.1]}
              transparent
              blending={AdditiveBlending}
              depthWrite={false}
              side={DoubleSide}
              toneMapped={false}
              fog={false}
            />
          </mesh>
        ))}
      </group>
      <pointLight ref={light} position={[0, 5.4, 0]} color="#ff9a40" distance={70} decay={1.7} intensity={60} />
    </group>
  )
}

/* ---------- 復古像素記分板 ---------- */

function makeScoreboardTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#0c1428'
  g.fillRect(0, 0, 256, 128)
  g.strokeStyle = '#e8e4d8'
  g.lineWidth = 4
  g.strokeRect(4, 4, 248, 120)

  g.textAlign = 'center'
  g.fillStyle = '#f0c030'
  g.font = 'bold 17px monospace'
  g.fillText('INDIGO LEAGUE', 128, 28)

  g.fillStyle = '#f2f2f2'
  g.font = 'bold 15px monospace'
  g.textAlign = 'left'
  g.fillText('PIKACHU', 16, 58)
  g.textAlign = 'right'
  g.fillText('CHARIZARD', 240, 58)
  g.textAlign = 'center'
  g.fillStyle = '#e84040'
  g.font = 'bold 16px monospace'
  g.fillText('VS', 128, 58)

  // HP 方塊列
  const blocks = (x: number, n: number, on: number, col: string) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = i < on ? col : '#26304a'
      g.fillRect(x + i * 11, 70, 9, 10)
    }
  }
  g.fillStyle = '#8ea2ff'
  g.font = 'bold 11px monospace'
  g.textAlign = 'left'
  g.fillText('HP', 16, 80)
  blocks(34, 8, 8, '#40d868')
  g.textAlign = 'right'
  g.fillText('HP', 240, 80)
  blocks(240 - 34 - 8 * 11 + 11, 8, 7, '#40d868')

  g.textAlign = 'center'
  g.fillStyle = '#8ea2ff'
  g.font = 'bold 12px monospace'
  g.fillText('* POKEMON LEAGUE *', 128, 108)

  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.magFilter = NearestFilter // 放大後保留像素格
  return tex
}

function Scoreboard() {
  const tex = useMemo(() => makeScoreboardTexture(), [])
  const ang = Math.PI * 1.28
  const x = Math.cos(ang) * (RIM_A - 1.2)
  const z = Math.sin(ang) * (RIM_B - 1.2)
  return (
    <group position={[x, RAIL_TOP + 3.4, z]} onUpdate={(g: Group) => g.lookAt(0, 2, 0)}>
      <mesh position={[0, 0, -0.35]}>
        <boxGeometry args={[10.8, 5.6, 0.6]} />
        <meshStandardMaterial color="#3a3f52" roughness={0.9} />
      </mesh>
      <mesh>
        <planeGeometry args={[10.2, 5.1]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* 支柱 */}
      <mesh position={[-3.6, -4.2, -0.5]}>
        <boxGeometry args={[0.4, 3.6, 0.4]} />
        <meshStandardMaterial color="#8d8578" roughness={0.9} />
      </mesh>
      <mesh position={[3.6, -4.2, -0.5]}>
        <boxGeometry args={[0.4, 3.6, 0.4]} />
        <meshStandardMaterial color="#8d8578" roughness={0.9} />
      </mesh>
    </group>
  )
}

/* ---------- 主組件 ---------- */

export default function Gen1Indigo() {
  return (
    <>
      <DuskSky />
      {/* 反射用 IBL（冰場地會用到） */}
      <Environment files="/assets/hdri/shanghai_bund_2k.hdr" environmentIntensity={0.22} />

      {/* 暖色黃昏主光（唯一投影光源） */}
      <directionalLight
        position={[-20, 30, 16]}
        intensity={1.55}
        color="#ffd9b0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-far={70}
        shadow-bias={-0.0004}
      />
      <hemisphereLight args={['#9a86c0', '#5a4638', 0.55]} />
      <ambientLight intensity={0.14} color="#ffb080" />

      <StoneStands />
      {/* GBA 像素風觀眾（黃昏亮度） */}
      <Crowd tiers={G1_TIERS} style="gba" brightness={[0.72, 1.0]} />
      <Pennants />
      <SacredFlame />
      <Scoreboard />
    </>
  )
}
