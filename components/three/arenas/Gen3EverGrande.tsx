'use client'
import { Environment } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useMemo, useRef, useState } from 'react'
import {
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { ellipseRing, type Tier } from './geometry'
import Crowd from './Crowd'
import { FIELD_TYPES, type FieldType } from './types'
import { useBattle } from '@/stores/useBattle'

/**
 * Gen 3 彩幽大會（豐緣・水靜市外海）：
 * 熱帶正午海島天堂 — 湛藍天空、環繞海平線、瀑布懸崖（動畫水簾+水霧）、
 * 花田護坡（instanced 花朵）、橘色聯盟高塔地標、飄舞花瓣彩紙。
 * 招牌機制：戰鬥中換場 — 任一方 HP 首次跌破 50% 時，地板 3.5s 分裂開闔、
 * 側道滑入新場地模組並頂升鎖定（戰鬥不中斷、碰撞體恆定）。
 */

const G3_TIERS: Tier[] = [
  { aIn: 25.0, bIn: 17.5, yBase: 2.0, depth: 6.5, rise: 2.6, rows: 9 },
  { aIn: 32.0, bIn: 24.5, yBase: 5.3, depth: 6.2, rise: 2.7, rows: 8 },
]
const RIM_A = G3_TIERS[1].aIn + G3_TIERS[1].depth
const RIM_B = G3_TIERS[1].bIn + G3_TIERS[1].depth
const RIM_Y = G3_TIERS[1].yBase + G3_TIERS[1].rise
const RAIL_TOP = RIM_Y + 1.2

const WHITE_A = '#eceade'
const WHITE_B = '#dedbcc'
const WALL_C = '#cfccbc'
const ORANGE = '#e8712c'

/* ---------- 熱帶正午天空 + 海 ---------- */

function makeSkyTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 512
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 512)
  grad.addColorStop(0, '#1565c8')
  grad.addColorStop(0.4, '#3f8fdd')
  grad.addColorStop(0.68, '#7fc0ec')
  grad.addColorStop(0.86, '#b8e0f6')
  grad.addColorStop(1, '#e8f7fc')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 512)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function makeSeaTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#1173c4'
  g.fillRect(0, 0, 256, 256)
  // 波光
  for (let i = 0; i < 130; i++) {
    const x = Math.random() * 256
    const y = Math.random() * 256
    g.strokeStyle = `rgba(255,255,255,${0.10 + Math.random() * 0.22})`
    g.lineWidth = 1 + Math.random() * 1.6
    g.beginPath()
    g.arc(x, y, 4 + Math.random() * 12, Math.PI * 0.1, Math.PI * 0.9)
    g.stroke()
  }
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.repeat.set(9, 9)
  return tex
}

function makeCloudTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const g = c.getContext('2d')!
  g.clearRect(0, 0, 256, 128)
  const puff = (x: number, y: number, r: number, a: number) => {
    const grad = g.createRadialGradient(x, y, r * 0.2, x, y, r)
    grad.addColorStop(0, `rgba(255,255,255,${a})`)
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
  }
  puff(80, 84, 44, 0.85)
  puff(128, 72, 52, 0.9)
  puff(178, 86, 40, 0.8)
  puff(110, 96, 46, 0.75)
  puff(150, 98, 42, 0.7)
  return new CanvasTexture(c)
}

function TropicalSky() {
  const sky = useMemo(() => makeSkyTexture(), [])
  const sea = useMemo(() => makeSeaTexture(), [])
  const cloud = useMemo(() => makeCloudTexture(), [])
  useFrame(({ clock }) => {
    sea.offset.x = clock.elapsedTime * 0.004
    sea.offset.y = clock.elapsedTime * 0.0026
  })
  const clouds: [number, number, number, number][] = [
    [-120, 62, -170, 70],
    [90, 74, -180, 88],
    [170, 56, -60, 60],
    [-170, 68, 60, 76],
    [40, 80, 170, 92],
  ]
  return (
    <>
      <color attach="background" args={['#9fd0ee']} />
      <fog attach="fog" args={['#cfe9f6', 130, 320]} />
      <mesh>
        <sphereGeometry args={[260, 24, 16]} />
        <meshBasicMaterial map={sky} side={BackSide} fog={false} depthWrite={false} />
      </mesh>
      {/* 環繞海平面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -6, 0]}>
        <circleGeometry args={[250, 48]} />
        <meshBasicMaterial map={sea} fog />
      </mesh>
      {/* 積雲 billboard */}
      {clouds.map(([x, y, z, s], i) => (
        <mesh key={i} position={[x, y, z]} onUpdate={(m) => m.lookAt(0, 30, 0)}>
          <planeGeometry args={[s, s * 0.5]} />
          <meshBasicMaterial map={cloud} transparent depthWrite={false} fog={false} opacity={0.9} />
        </mesh>
      ))}
      {/* 烈日眩光 */}
      <mesh position={[70, 95, -150]}>
        <sphereGeometry args={[7, 12, 10]} />
        <meshBasicMaterial color={[3.2, 3.0, 2.4]} toneMapped={false} fog={false} />
      </mesh>
    </>
  )
}

/* ---------- 海島地面 + 遠處小島 ---------- */

function Island() {
  return (
    <group>
      {/* 草坪島面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]}>
        <circleGeometry args={[62, 40]} />
        <meshStandardMaterial color="#69a557" roughness={1} />
      </mesh>
      {/* 沙灘緣 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]}>
        <circleGeometry args={[86, 40]} />
        <meshStandardMaterial color="#d9c795" roughness={1} />
      </mesh>
      {/* 島基（下探到海面） */}
      <mesh position={[0, -3.6, 0]}>
        <cylinderGeometry args={[86, 92, 6, 40]} />
        <meshStandardMaterial color="#8a734f" roughness={1} />
      </mesh>
      {/* 遠處小島剪影 */}
      {([[-150, -90, 26, 10], [130, -140, 34, 14], [-60, -190, 22, 9]] as const).map(([x, z, r, h], i) => (
        <mesh key={i} position={[x, -6 + h / 2 - 1, z]}>
          <coneGeometry args={[r, h, 7]} />
          <meshStandardMaterial color="#4a7a58" roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  )
}

/* ---------- 白色看台（橘飾帶）+ 花田護坡 ---------- */

function Stands() {
  const geos = useMemo(() => {
    const slopes: BufferGeometry[] = []
    const walls: BufferGeometry[] = []
    const trims: BufferGeometry[] = []
    let prevAOut = G3_TIERS[0].aIn
    let prevBOut = G3_TIERS[0].bIn
    let prevYTop = 1.4 // 花坡頂
    for (const t of G3_TIERS) {
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
    trims.push(ellipseRing(RIM_A + 0.02, RIM_B + 0.02, RAIL_TOP - 0.45, RIM_A + 0.02, RIM_B + 0.02, RAIL_TOP))
    return { slopes, walls, trims }
  }, [])

  return (
    <group>
      {geos.slopes.map((g, i) => (
        <mesh key={`s${i}`} geometry={g}>
          <meshStandardMaterial color={i % 2 === 0 ? WHITE_A : WHITE_B} roughness={0.9} side={DoubleSide} />
        </mesh>
      ))}
      {geos.walls.map((g, i) => (
        <mesh key={`w${i}`} geometry={g}>
          <meshStandardMaterial color={WALL_C} roughness={0.9} side={DoubleSide} />
        </mesh>
      ))}
      {geos.trims.map((g, i) => (
        <mesh key={`t${i}`} geometry={g}>
          <meshStandardMaterial color={ORANGE} roughness={0.55} side={DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

/** 場邊花田護坡：綠坡 + instanced 花朵（面向場內的第一眼花海） */
const FLOWER_COUNT = 1500

function FlowerBerm() {
  const slope = useMemo(
    () => ellipseRing(22.6, 15.3, -0.45, G3_TIERS[0].aIn, G3_TIERS[0].bIn, 1.4),
    [],
  )
  const flowers = useMemo(() => {
    const geo = new PlaneGeometry(0.26, 0.26)
    geo.translate(0, 0.13, 0)
    const mat = new MeshBasicMaterial({ side: DoubleSide })
    const m = new InstancedMesh(geo, mat, FLOWER_COUNT)
    const m4 = new Matrix4()
    const q = new Quaternion()
    const e = new Vector3()
    const s = new Vector3()
    const col = new Color()
    const palette = ['#ff5a7e', '#ffb443', '#ff8c5c', '#f8f6f0', '#ff6a3c', '#e84fa0', '#ffd84f']
    for (let i = 0; i < FLOWER_COUNT; i++) {
      const ang = Math.random() * Math.PI * 2
      const f = Math.random()
      const a = 22.6 + f * (G3_TIERS[0].aIn - 22.6)
      const b = 15.3 + f * (G3_TIERS[0].bIn - 15.3)
      const y = -0.45 + f * 1.85 + 0.06
      e.set(Math.cos(ang) * a, y, Math.sin(ang) * b)
      q.setFromAxisAngle(new Vector3(0, 1, 0), Math.random() * Math.PI)
      const sc = 0.7 + Math.random() * 0.8
      s.set(sc, sc, sc)
      m4.compose(e, q, s)
      m.setMatrixAt(i, m4)
      col.set(palette[(Math.random() * palette.length) | 0])
      m.setColorAt(i, col)
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.frustumCulled = false
    return m
  }, [])
  return (
    <group>
      <mesh geometry={slope}>
        <meshStandardMaterial color="#3f8f48" roughness={1} side={DoubleSide} />
      </mesh>
      <primitive object={flowers} />
    </group>
  )
}

/* ---------- 瀑布懸崖（動畫水簾 + 水霧） ---------- */

function makeFallTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 512
  const g = c.getContext('2d')!
  g.clearRect(0, 0, 128, 512)
  for (let i = 0; i < 46; i++) {
    const x = Math.random() * 128
    const w = 2 + Math.random() * 7
    const a = 0.25 + Math.random() * 0.5
    const grad = g.createLinearGradient(x, 0, x + w, 0)
    grad.addColorStop(0, 'rgba(255,255,255,0)')
    grad.addColorStop(0.5, `rgba(235,247,255,${a})`)
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(x, 0, w, 512)
  }
  const tex = new CanvasTexture(c)
  tex.wrapT = RepeatWrapping
  return tex
}

function makeMistTex(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(128, 128, 8, 128, 128, 128)
  grad.addColorStop(0, 'rgba(240, 250, 255, 0.5)')
  grad.addColorStop(0.6, 'rgba(240, 250, 255, 0.2)')
  grad.addColorStop(1, 'rgba(240, 250, 255, 0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  return new CanvasTexture(c)
}

/* ---------- 環場節慶旗串（熱帶配色，GPU 風擺） ---------- */

const G3_POLES = 10
const G3_FLAGS_PER_SPAN = 11
const G3_FLAG_COLORS = ['#ff4f6e', '#ffd23c', '#2cc8b0', '#ffffff', '#ff8a3c', '#f45fb0']

function FestivalBunting() {
  const uTime = useMemo(() => ({ value: 0 }), [])
  const { flags, strings, poles } = useMemo(() => {
    // 掛在第一層看台前緣（戰鬥視角花坡正上方，一眼可見）
    const tops: Vector3[] = []
    for (let i = 0; i < G3_POLES; i++) {
      const ang = (i / G3_POLES) * Math.PI * 2
      tops.push(new Vector3(
        Math.cos(ang) * (G3_TIERS[0].aIn + 0.3),
        G3_TIERS[0].yBase + 1.15,
        Math.sin(ang) * (G3_TIERS[0].bIn + 0.3),
      ))
    }
    const tri = new BufferGeometry()
    tri.setAttribute('position', new Float32BufferAttribute([-0.17, 0, 0, 0.17, 0, 0, 0, -0.5, 0], 3))
    tri.computeVertexNormals()
    const mat = new MeshBasicMaterial({ side: DoubleSide })
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime
      shader.vertexShader = `uniform float uTime;\n${shader.vertexShader.replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          'float fph = float(gl_InstanceID);',
          'transformed.z += sin(uTime * 3.6 + fph * 1.31 + transformed.y * 4.0) * (-transformed.y) * 0.55;',
        ].join('\n'),
      )}`
    }
    const flagMesh = new InstancedMesh(tri, mat, G3_POLES * G3_FLAGS_PER_SPAN)
    const m4 = new Matrix4()
    const q = new Quaternion()
    const pos = new Vector3()
    const sc = new Vector3(1, 1, 1)
    const up = new Vector3(0, 1, 0)
    const color = new Color()
    const stringPts: number[] = []
    let fi = 0
    for (let i = 0; i < G3_POLES; i++) {
      const a = tops[i]
      const b = tops[(i + 1) % G3_POLES]
      const dir = new Vector3().subVectors(b, a)
      const yaw = Math.atan2(-dir.z, dir.x)
      let prev: Vector3 | null = null
      for (let s = 0; s <= 10; s++) {
        const t = s / 10
        const p = new Vector3().lerpVectors(a, b, t)
        p.y -= Math.sin(Math.PI * t) * 0.85
        if (prev) stringPts.push(prev.x, prev.y, prev.z, p.x, p.y, p.z)
        prev = p
      }
      for (let j = 0; j < G3_FLAGS_PER_SPAN; j++) {
        const t = (j + 0.5) / G3_FLAGS_PER_SPAN
        pos.lerpVectors(a, b, t)
        pos.y -= Math.sin(Math.PI * t) * 0.85
        q.setFromAxisAngle(up, yaw)
        m4.compose(pos, q, sc)
        flagMesh.setMatrixAt(fi, m4)
        color.set(G3_FLAG_COLORS[(i + j) % G3_FLAG_COLORS.length])
        flagMesh.setColorAt(fi, color)
        fi++
      }
    }
    flagMesh.instanceMatrix.needsUpdate = true
    if (flagMesh.instanceColor) flagMesh.instanceColor.needsUpdate = true
    flagMesh.frustumCulled = false
    const stringGeo = new BufferGeometry()
    stringGeo.setAttribute('position', new Float32BufferAttribute(stringPts, 3))
    const poleMesh = (() => {
      const m = new InstancedMesh(
        new BoxGeometry(0.12, 2.2, 0.12),
        new MeshStandardMaterial({ color: '#f4ede0', roughness: 0.85 }),
        G3_POLES,
      )
      const mm = new Matrix4()
      tops.forEach((p, i) => {
        mm.makeTranslation(p.x, p.y - 1.0, p.z)
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
        <lineBasicMaterial color="#fdf8ee" />
      </lineSegments>
    </group>
  )
}

/* ---------- 棕櫚樹環（樹冠探出看台頂，賣熱帶感） ---------- */

function makePalmCrownTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 160
  const g = c.getContext('2d')!
  g.clearRect(0, 0, 256, 160)
  const cx = 128
  const cy = 118
  for (let i = 0; i < 9; i++) {
    const ang = Math.PI * (0.08 + (i / 8) * 0.84)
    const len = 96 + (i % 3) * 14
    const ex = cx - Math.cos(ang) * len
    const ey = cy - Math.sin(ang) * (len * 0.62)
    g.strokeStyle = i % 2 ? '#2c7a3a' : '#3c9048'
    g.lineWidth = 13
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(cx, cy)
    g.quadraticCurveTo((cx + ex) / 2, Math.min(cy, ey) - 26, ex, ey + 14)
    g.stroke()
  }
  // 椰子
  g.fillStyle = '#6b4a26'
  for (const [ox, oy] of [[-9, 2], [8, 4], [0, 10]] as const) {
    g.beginPath()
    g.arc(cx + ox, cy + oy, 8, 0, Math.PI * 2)
    g.fill()
  }
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

const PALM_COUNT = 14

function PalmRing() {
  const crownTex = useMemo(() => makePalmCrownTexture(), [])
  const { trunks, crowns } = useMemo(() => {
    const trunkMesh = new InstancedMesh(
      new CylinderGeometry(0.22, 0.34, 7.5, 6),
      new MeshStandardMaterial({ color: '#8a6a44', roughness: 0.95 }),
      PALM_COUNT,
    )
    const crownGeo = new PlaneGeometry(6.4, 4.0)
    crownGeo.translate(0, 1.3, 0)
    const crownMesh = new InstancedMesh(
      crownGeo,
      new MeshBasicMaterial({ map: crownTex, alphaTest: 0.4, side: DoubleSide }),
      PALM_COUNT * 2,
    )
    const m4 = new Matrix4()
    const q = new Quaternion()
    const up = new Vector3(0, 1, 0)
    const p = new Vector3()
    const s = new Vector3()
    for (let i = 0; i < PALM_COUNT; i++) {
      const ang = (i / PALM_COUNT) * Math.PI * 2 + 0.22
      const x = Math.cos(ang) * (RIM_A + 2.6)
      const z = Math.sin(ang) * (RIM_B + 2.6)
      const sc = 0.9 + Math.abs(Math.sin(i * 4.7)) * 0.5
      const baseY = RIM_Y - 4.5 // 樹根埋在看台外側，樹冠冒出欄杆
      s.set(sc, sc, sc)
      p.set(x, baseY + 3.75 * sc, z)
      q.setFromAxisAngle(up, ang)
      m4.compose(p, q, s)
      trunkMesh.setMatrixAt(i, m4)
      for (let k = 0; k < 2; k++) {
        p.set(x, baseY + 7.5 * sc, z)
        q.setFromAxisAngle(up, ang + (k * Math.PI) / 2)
        m4.compose(p, q, s)
        crownMesh.setMatrixAt(i * 2 + k, m4)
      }
    }
    trunkMesh.instanceMatrix.needsUpdate = true
    crownMesh.instanceMatrix.needsUpdate = true
    trunkMesh.frustumCulled = false
    crownMesh.frustumCulled = false
    return { trunks: trunkMesh, crowns: crownMesh }
  }, [crownTex])
  return (
    <group>
      <primitive object={trunks} />
      <primitive object={crowns} />
    </group>
  )
}

function WaterfallCliff() {
  const fall = useMemo(() => makeFallTexture(), [])
  const fall2 = useMemo(() => {
    const t = fall.clone()
    t.needsUpdate = true
    return t
  }, [fall])
  const mist = useMemo(() => makeMistTex(), [])
  const mistRefs = useRef<(Group | null)[]>([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    fall.offset.y = t * 0.55
    fall2.offset.y = t * 0.38
    mistRefs.current.forEach((m, i) => {
      if (!m) return
      const s = 1 + Math.sin(t * 0.8 + i * 2.1) * 0.16
      m.scale.set(s, s, s)
    })
  })
  return (
    // 靠近看台外側、崖頂壓在戰鬥視角可視帶內（rim 上方 ~10–24m）
    <group position={[58, -6, -52]} rotation={[0, -0.85, 0]}>
      {/* 崖壁 */}
      <mesh position={[0, 14, 0]}>
        <boxGeometry args={[30, 34, 13]} />
        <meshStandardMaterial color="#5f574a" roughness={1} flatShading />
      </mesh>
      <mesh position={[-16, 9, 3]} rotation={[0.1, 0.5, 0.12]}>
        <boxGeometry args={[14, 24, 11]} />
        <meshStandardMaterial color="#6b6152" roughness={1} flatShading />
      </mesh>
      <mesh position={[15, 8, 4]} rotation={[-0.06, -0.4, -0.1]}>
        <boxGeometry args={[13, 22, 10]} />
        <meshStandardMaterial color="#564e42" roughness={1} flatShading />
      </mesh>
      {/* 崖頂綠植 */}
      <mesh position={[0, 31.5, 0]}>
        <boxGeometry args={[31, 2.6, 14]} />
        <meshStandardMaterial color="#3f7a3e" roughness={1} />
      </mesh>
      {/* 水簾（兩層速度差） */}
      <mesh position={[-3, 15.5, 6.8]}>
        <planeGeometry args={[8, 32]} />
        <meshBasicMaterial map={fall} transparent depthWrite={false} opacity={0.9} side={DoubleSide} />
      </mesh>
      <mesh position={[5.5, 14, 6.9]}>
        <planeGeometry args={[5, 29]} />
        <meshBasicMaterial map={fall2} transparent depthWrite={false} opacity={0.75} side={DoubleSide} />
      </mesh>
      {/* 落水口白沫 */}
      <mesh position={[-3, 30.6, 6.6]} rotation={[-Math.PI / 2.4, 0, 0]}>
        <planeGeometry args={[9, 2.6]} />
        <meshBasicMaterial color="#e8f6ff" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      {/* 底部水霧 */}
      {[0, 1, 2].map((i) => (
        <group key={i} ref={(el) => { mistRefs.current[i] = el }} position={[-3 + i * 5, 2.2 + i * 1.0, 7.5]}>
          <mesh onUpdate={(m) => m.lookAt(m.position.x - 60, m.position.y + 6, m.position.z + 70)}>
            <planeGeometry args={[12, 8]} />
            <meshBasicMaterial map={mist} transparent depthWrite={false} opacity={0.8} fog={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* ---------- 橘色聯盟高塔地標 ---------- */

function LeagueTower() {
  return (
    <group position={[-48, -6, -118]} scale={[0.55, 0.42, 0.55]}>
      {/* 塔身層疊 */}
      <mesh position={[0, 15, 0]}>
        <cylinderGeometry args={[15, 18, 30, 12]} />
        <meshStandardMaterial color="#d95f24" roughness={0.85} />
      </mesh>
      <mesh position={[0, 30.8, 0]}>
        <cylinderGeometry args={[16.4, 16.4, 1.6, 12]} />
        <meshStandardMaterial color="#f4ede0" roughness={0.8} />
      </mesh>
      <mesh position={[0, 43, 0]}>
        <cylinderGeometry args={[11, 13.5, 24, 12]} />
        <meshStandardMaterial color="#e8712c" roughness={0.85} />
      </mesh>
      <mesh position={[0, 55.8, 0]}>
        <cylinderGeometry args={[12.2, 12.2, 1.5, 12]} />
        <meshStandardMaterial color="#f4ede0" roughness={0.8} />
      </mesh>
      <mesh position={[0, 66, 0]}>
        <cylinderGeometry args={[7.5, 9.5, 20, 12]} />
        <meshStandardMaterial color="#ef7f38" roughness={0.85} />
      </mesh>
      <mesh position={[0, 77, 0]}>
        <cylinderGeometry args={[8.4, 8.4, 1.4, 12]} />
        <meshStandardMaterial color="#f4ede0" roughness={0.8} />
      </mesh>
      {/* 頂冠 */}
      <mesh position={[0, 83.5, 0]}>
        <coneGeometry args={[7, 13, 12]} />
        <meshStandardMaterial color="#c24a18" roughness={0.8} />
      </mesh>
      <mesh position={[0, 91.5, 0]}>
        <sphereGeometry args={[1.6, 10, 8]} />
        <meshStandardMaterial color="#ffd84f" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* 塔窗（正面幾個深色拱窗意象） */}
      {[12, 24, 40, 50, 63].map((y, i) => (
        <mesh key={i} position={[0, y, 17.5 - y * 0.11]} rotation={[0, 0, 0]}>
          <planeGeometry args={[3.2, 5]} />
          <meshBasicMaterial color="#5c2a10" />
        </mesh>
      ))}
    </group>
  )
}

/* ---------- 飄舞花瓣/彩紙（GPU instanced） ---------- */

const PETAL_COUNT = 240

function Petals() {
  const uTime = useMemo(() => ({ value: 0 }), [])
  const mesh = useMemo(() => {
    const geo = new PlaneGeometry(0.13, 0.13)
    const mat = new MeshBasicMaterial({ side: DoubleSide, transparent: true, opacity: 0.95 })
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime
      shader.vertexShader = `uniform float uTime;\n${shader.vertexShader.replace(
        '#include <project_vertex>',
        [
          'float ph = float(gl_InstanceID);',
          'float fall = mod(uTime * (0.55 + fract(ph * 0.37) * 0.75) + ph * 3.1, 22.0);',
          'vec3 off = vec3(sin(uTime * 0.5 + ph) * 3.2, -fall, cos(uTime * 0.42 + ph * 1.31) * 3.2);',
          'vec4 mvPosition = modelViewMatrix * (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0) + vec4(off, 0.0));',
          'float sp = uTime * (2.2 + fract(ph * 0.61) * 2.4) + ph;',
          'vec2 rp = mat2(cos(sp), -sin(sp), sin(sp), cos(sp)) * transformed.xy;',
          'mvPosition.xy += rp;',
          'gl_Position = projectionMatrix * mvPosition;',
        ].join('\n'),
      )}`
    }
    const m = new InstancedMesh(geo, mat, PETAL_COUNT)
    const m4 = new Matrix4()
    const q = new Quaternion()
    const p = new Vector3()
    const s = new Vector3(1, 1, 1)
    const col = new Color()
    const palette = ['#ff89b3', '#ffb0cf', '#ffe08a', '#fff6f0', '#ffa063', '#f47fd4']
    for (let i = 0; i < PETAL_COUNT; i++) {
      p.set((Math.random() - 0.5) * 76, 6 + Math.random() * 22, (Math.random() - 0.5) * 56)
      m4.compose(p, q, s)
      m.setMatrixAt(i, m4)
      col.set(palette[(Math.random() * palette.length) | 0])
      m.setColorAt(i, col)
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.frustumCulled = false
    return m
  }, [uTime])
  useFrame(({ clock }) => {
    uTime.value = clock.elapsedTime
  })
  return <primitive object={mesh} />
}

/* ---------- 主組件：布景 ---------- */

export default function Gen3EverGrande() {
  return (
    <>
      <TropicalSky />
      <Environment files="/assets/hdri/potsdamer_platz_2k.hdr" environmentIntensity={0.4} />

      {/* 熱帶烈日主光（唯一投影光源） */}
      <directionalLight
        position={[30, 46, 18]}
        intensity={1.9}
        color="#fff4dd"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-far={90}
        shadow-bias={-0.0004}
      />
      <hemisphereLight args={['#bcdcf4', '#4f7a48', 0.65]} />
      <ambientLight intensity={0.18} color="#cfe6f4" />

      <Island />
      <Stands />
      <FlowerBerm />
      <Crowd tiers={G3_TIERS} style="gba" brightness={[0.85, 1.15]} />
      <FestivalBunting />
      <PalmRing />
      <WaterfallCliff />
      <LeagueTower />
      <Petals />
    </>
  )
}

/* ================= 戰鬥地板（戰鬥中換場） ================= */

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

/** 彩幽版四場地貼圖：熱帶明媚配色（草含小花、岩偏火山紅棕、水偏碧綠礁湖） */
function makeG3FieldCanvas(type: FieldType): HTMLCanvasElement {
  const W = 1600
  const H = 960
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const r = rng(type.length * 1409 + 5)

  if (type === 'grass') {
    g.fillStyle = '#57a844'
    g.fillRect(0, 0, W, H)
    for (let i = 0; i < 90; i++) {
      g.fillStyle = 'rgba(140, 205, 100, 0.18)'
      g.beginPath()
      g.ellipse(r() * W, r() * H, 30 + r() * 80, 20 + r() * 50, r() * Math.PI, 0, Math.PI * 2)
      g.fill()
    }
    g.strokeStyle = 'rgba(30, 100, 36, 0.55)'
    g.lineWidth = 3
    for (let i = 0; i < 850; i++) {
      const x = r() * W
      const y = r() * H
      const s = 4 + r() * 5
      g.beginPath()
      g.moveTo(x - s, y + s)
      g.lineTo(x, y - s)
      g.lineTo(x + s, y + s)
      g.stroke()
    }
    // 熱帶小花
    const fl = ['#ff6a8e', '#ffd23c', '#ffffff', '#ff8a4a']
    for (let i = 0; i < 90; i++) {
      g.fillStyle = fl[(r() * fl.length) | 0]
      const x = r() * W
      const y = r() * H
      g.beginPath()
      g.arc(x, y, 4 + r() * 3, 0, Math.PI * 2)
      g.fill()
    }
    drawBoundary(g, W, H)
  } else if (type === 'rock') {
    g.fillStyle = '#a05a38'
    g.fillRect(0, 0, W, H)
    for (let i = 0; i < 70; i++) {
      g.fillStyle = i % 2 ? 'rgba(190, 120, 70, 0.35)' : 'rgba(120, 62, 36, 0.32)'
      g.beginPath()
      g.ellipse(r() * W, r() * H, 40 + r() * 110, 26 + r() * 70, r() * Math.PI, 0, Math.PI * 2)
      g.fill()
    }
    g.strokeStyle = 'rgba(80, 38, 20, 0.75)'
    for (let i = 0; i < 46; i++) {
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
    for (let i = 0; i < 260; i++) {
      g.fillStyle = r() > 0.5 ? 'rgba(64,30,16,0.6)' : 'rgba(220,170,130,0.5)'
      g.fillRect(r() * W, r() * H, 3 + r() * 5, 3 + r() * 4)
    }
    drawBoundary(g, W, H)
  } else if (type === 'water') {
    const grad = g.createLinearGradient(0, 0, W, H)
    grad.addColorStop(0, '#1d90c8')
    grad.addColorStop(1, '#12699e')
    g.fillStyle = grad
    g.fillRect(0, 0, W, H)
    g.strokeStyle = 'rgba(255,255,255,0.26)'
    g.lineWidth = 3
    for (let i = 0; i < 170; i++) {
      const x = r() * W
      const y = r() * H
      const w = 18 + r() * 46
      g.beginPath()
      g.arc(x, y, w, Math.PI * 0.15, Math.PI * 0.85)
      g.stroke()
    }
    // 礁湖淺灘暈
    for (let i = 0; i < 26; i++) {
      g.fillStyle = 'rgba(120, 220, 210, 0.18)'
      g.beginPath()
      g.ellipse(r() * W, r() * H, 60 + r() * 140, 40 + r() * 80, r() * Math.PI, 0, Math.PI * 2)
      g.fill()
    }
    const pads: [number, number][] = [
      [0.2, 0.3], [0.5, 0.24], [0.8, 0.32],
      [0.22, 0.72], [0.52, 0.78], [0.8, 0.7],
    ]
    for (const [px, py] of pads) {
      const x = px * W
      const y = py * H
      g.fillStyle = '#b09055'
      g.beginPath()
      g.arc(x, y, 96, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#e2ce9c'
      g.beginPath()
      g.arc(x, y, 86, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = 'rgba(150, 122, 76, 0.5)'
      g.beginPath()
      g.arc(x, y, 62, 0, Math.PI * 2)
      g.fill()
    }
    drawBoundary(g, W, H, false)
  } else {
    // ice
    g.fillStyle = '#cfe8f4'
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
    g.strokeStyle = 'rgba(120, 170, 200, 0.55)'
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
  return c
}

const G3_SURFACE: Record<FieldType, { rough: number; env: number; base: string }> = {
  grass: { rough: 0.92, env: 0.35, base: '#28541e' },
  rock: { rough: 0.97, env: 0.25, base: '#54301c' },
  water: { rough: 0.3, env: 0.95, base: '#0e3a5c' },
  ice: { rough: 0.07, env: 1.7, base: '#7fa8bc' },
}

/** 沿 z 軸切半（前後兩片活板門用） */
function halfTexturesZ(canvas: HTMLCanvasElement): [CanvasTexture, CanvasTexture] {
  const mk = (offY: number) => {
    const t = new CanvasTexture(canvas)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 8
    t.repeat.set(1, 0.5)
    t.offset.set(0, offY)
    return t
  }
  // plane 轉 -PI/2 後：v=1 邊在世界 -z → 前半（z∈[0,12]）吃 v∈[0,0.5]
  return [mk(0), mk(0.5)]
}

/** 沿 x 軸切半（新模組左右滑入用） */
function halfTexturesX(canvas: HTMLCanvasElement): [CanvasTexture, CanvasTexture] {
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

/**
 * 彩幽大會戰鬥地板：碰撞恆定；任一方 HP 首次 < 50% 時觸發 3.5s 戰中換場 —
 * 活板門開闔 → 側道滑入新模組 → 頂升鎖定 + 水霧塵爆。
 */
export function Gen3EverGrandeFloor({ fieldType }: { fieldType?: FieldType | null }) {
  const ft: FieldType = fieldType ?? 'grass'
  const surf = G3_SURFACE[ft]
  const [swap, setSwap] = useState<{ to: FieldType; at: number } | null>(null)
  const triggered = useRef(false)
  const done = useRef(false)

  // 舊場地（前後兩片活板門）
  const [oldFront, oldBack] = useMemo(() => halfTexturesZ(makeG3FieldCanvas(ft)), [ft])
  // 新場地（左右滑入模組）
  const [newL, newR] = useMemo(
    () => (swap ? halfTexturesX(makeG3FieldCanvas(swap.to)) : [null, null]),
    [swap],
  )
  const newSurf = swap ? G3_SURFACE[swap.to] : surf

  const frontDoor = useRef<Group>(null)
  const backDoor = useRef<Group>(null)
  const trayL = useRef<Group>(null)
  const trayR = useRef<Group>(null)
  const rumble = useRef<Group>(null)

  const { dustPts, dustMat } = useMemo(() => {
    const N = 16
    const pos = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2
      pos[i * 3] = Math.cos(ang) * 18.5
      pos[i * 3 + 1] = 0.3
      pos[i * 3 + 2] = Math.sin(ang) * 11.2
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
    const dm = new PointsMaterial({
      map: makeMistTex(), transparent: true, opacity: 0, size: 2,
      depthWrite: false, color: '#e6f2f8', sizeAttenuation: true,
    })
    const dp = new Points(geo, dm)
    dp.frustumCulled = false
    dp.visible = false
    return { dustPts: dp, dustMat: dm }
  }, [])

  useFrame(({ clock }) => {
    // 觸發偵測：任一方 HP 首次跌破 50%（僅戰鬥進行中）
    if (!triggered.current) {
      const b = useBattle.getState()
      if (
        b.phase === 'fighting' &&
        (b.playerHp / b.playerMaxHp < 0.5 || b.enemyHp / b.enemyMaxHp < 0.5)
      ) {
        triggered.current = true
        const others = FIELD_TYPES.filter((f) => f !== ft)
        setSwap({ to: others[(Math.random() * others.length) | 0], at: clock.elapsedTime })
      }
      return
    }
    if (!swap || done.current) return
    const t = clock.elapsedTime - swap.at

    if (t > 4.0) {
      if (frontDoor.current) frontDoor.current.visible = false
      if (backDoor.current) backDoor.current.visible = false
      if (trayL.current) trayL.current.position.set(0, 0, 0)
      if (trayR.current) trayR.current.position.set(0, 0, 0)
      if (rumble.current) rumble.current.position.set(0, 0, 0)
      dustPts.visible = false
      done.current = true
      return
    }

    // 1) 活板門外翻下沉（0.25s–1.5s）
    const open = easeSm((t - 0.25) / 1.25)
    if (frontDoor.current) frontDoor.current.rotation.x = -1.35 * open
    if (backDoor.current) backDoor.current.rotation.x = 1.35 * open

    // 2) 新模組自左右側道滑入（0.9s–2.5s）
    const slide = easeSm((t - 0.9) / 1.6)
    // 3) 頂升鎖定（2.5s–3.2s）
    const lift = easeSm((t - 2.5) / 0.7)
    if (trayL.current) trayL.current.position.set(-30 + 30 * slide, -1.35 + 1.35 * lift, 0)
    if (trayR.current) trayR.current.position.set(30 - 30 * slide, -1.35 + 1.35 * lift, 0)

    // 震動
    const env = t < 0.3 ? t / 0.3 : t < 3.2 ? 1 : t < 3.7 ? (3.7 - t) / 0.5 : 0
    const thump = t > 3.15 && t < 3.4 ? (3.4 - t) / 0.25 : 0
    if (rumble.current) {
      rumble.current.position.y = Math.sin(t * 41) * 0.018 * env - 0.045 * thump
      rumble.current.position.x = Math.sin(t * 29) * 0.012 * env
    }

    // 水霧塵爆（3.15s 鎖定時）
    const ds = (t - 3.15) / 1.0
    if (ds > 0 && ds < 1) {
      dustPts.visible = true
      dustMat.opacity = (1 - ds) * 0.6
      dustMat.size = 2.5 + 6.5 * ds
      dustPts.position.y = 0.25 + 1.0 * ds
    } else if (ds >= 1) {
      dustPts.visible = false
    }
  })

  return (
    <>
      {/* 碰撞體（恆定） */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[20, 0.25, 12]} position={[0, -0.25, 0]} />
        <CuboidCollider args={[0.3, 2, 12.6]} position={[20.9, 1.5, 0]} />
        <CuboidCollider args={[0.3, 2, 12.6]} position={[-20.9, 1.5, 0]} />
        <CuboidCollider args={[21.2, 2, 0.3]} position={[0, 1.5, 12.9]} />
        <CuboidCollider args={[21.2, 2, 0.3]} position={[0, 1.5, -12.9]} />
      </RigidBody>

      <group ref={rumble}>
        {/* 機坑（深色防穿幫） */}
        <mesh position={[0, -1.6, 0]}>
          <boxGeometry args={[40.8, 2.7, 24.8]} />
          <meshStandardMaterial color="#171a1e" roughness={1} />
        </mesh>
        {/* 白石鑲橘邊框 */}
        <mesh position={[0, -0.14, 12.55]}>
          <boxGeometry args={[42.2, 0.4, 0.9]} />
          <meshStandardMaterial color="#dcd8c8" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.14, -12.55]}>
          <boxGeometry args={[42.2, 0.4, 0.9]} />
          <meshStandardMaterial color="#dcd8c8" roughness={0.8} />
        </mesh>
        <mesh position={[21.05, -0.14, 0]}>
          <boxGeometry args={[0.9, 0.4, 25.4]} />
          <meshStandardMaterial color={ORANGE} roughness={0.6} />
        </mesh>
        <mesh position={[-21.05, -0.14, 0]}>
          <boxGeometry args={[0.9, 0.4, 25.4]} />
          <meshStandardMaterial color={ORANGE} roughness={0.6} />
        </mesh>
      </group>

      {/* 舊場地：前後兩片活板門（樞紐在 z=±12） */}
      <group ref={frontDoor} position={[0, 0, 12]}>
        <mesh position={[0, -0.26, -6]}>
          <boxGeometry args={[40, 0.5, 12]} />
          <meshStandardMaterial color={surf.base} roughness={1} />
        </mesh>
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, -6]}>
          <planeGeometry args={[40, 12]} />
          <meshStandardMaterial map={oldFront} roughness={surf.rough} metalness={0} envMapIntensity={surf.env} />
        </mesh>
      </group>
      <group ref={backDoor} position={[0, 0, -12]}>
        <mesh position={[0, -0.26, 6]}>
          <boxGeometry args={[40, 0.5, 12]} />
          <meshStandardMaterial color={surf.base} roughness={1} />
        </mesh>
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 6]}>
          <planeGeometry args={[40, 12]} />
          <meshStandardMaterial map={oldBack} roughness={surf.rough} metalness={0} envMapIntensity={surf.env} />
        </mesh>
      </group>

      {/* 新場地：左右滑入模組（觸發後才掛載） */}
      {swap && newL && newR && (
        <>
          <group ref={trayL} position={[-30, -1.35, 0]}>
            <mesh position={[-10, -0.26, 0]}>
              <boxGeometry args={[20, 0.5, 24]} />
              <meshStandardMaterial color={newSurf.base} roughness={1} />
            </mesh>
            <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[-10, 0.002, 0]}>
              <planeGeometry args={[20, 24]} />
              <meshStandardMaterial map={newL} roughness={newSurf.rough} metalness={0} envMapIntensity={newSurf.env} />
            </mesh>
            {/* 模組滑軌 */}
            <mesh position={[-10, -0.75, 0]}>
              <boxGeometry args={[19.6, 0.5, 22.8]} />
              <meshStandardMaterial color="#3a4048" roughness={0.6} metalness={0.4} />
            </mesh>
          </group>
          <group ref={trayR} position={[30, -1.35, 0]}>
            <mesh position={[10, -0.26, 0]}>
              <boxGeometry args={[20, 0.5, 24]} />
              <meshStandardMaterial color={newSurf.base} roughness={1} />
            </mesh>
            <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[10, 0.002, 0]}>
              <planeGeometry args={[20, 24]} />
              <meshStandardMaterial map={newR} roughness={newSurf.rough} metalness={0} envMapIntensity={newSurf.env} />
            </mesh>
            <mesh position={[10, -0.75, 0]}>
              <boxGeometry args={[19.6, 0.5, 22.8]} />
              <meshStandardMaterial color="#3a4048" roughness={0.6} metalness={0.4} />
            </mesh>
          </group>
        </>
      )}

      {/* 鎖定水霧塵爆 */}
      <primitive object={dustPts} />

      {/* 場外白石廣場（純視覺） */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[130, 100]} />
        <meshStandardMaterial color="#cfc9b4" roughness={1} />
      </mesh>
    </>
  )
}
