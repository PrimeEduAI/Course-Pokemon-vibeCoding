'use client'
import { Environment } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
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
 * Gen 6 密阿雷大會（卡洛斯聯盟）：
 * 主教座堂式室內競技場（白金 + 玫瑰配色）—— 六邊形母題滿場、
 * 彩繪玻璃長窗與彩色光柱、吊燈光環、緩轉鋼環、
 * 元素機關：火柱定時噴發（+X 側）/ 水幕簾（−X 側）。
 */

const G6_TIERS: Tier[] = [
  { aIn: 25.0, bIn: 17.5, yBase: 2.2, depth: 7.0, rise: 3.2, rows: 10 },
  { aIn: 32.8, bIn: 25.3, yBase: 6.2, depth: 7.5, rise: 3.8, rows: 11 },
]
const RIM_A = G6_TIERS[1].aIn + G6_TIERS[1].depth
const RIM_B = G6_TIERS[1].bIn + G6_TIERS[1].depth
const RIM_Y = G6_TIERS[1].yBase + G6_TIERS[1].rise
const RAIL_TOP = RIM_Y + 1.4

const MARBLE_A = '#e8e2d4'
const MARBLE_B = '#ded6c6'
const MARBLE_WALL = '#cfc6b4'
const GOLD = '#c8a050'

const WALL_R = 52
const WALL_H = 38

function gen6Rng(seed: number) {
  let s = (seed * 2654435761) % 4294967296
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/* ---------- 大教堂殼體（暮色室內） ---------- */

function gen6MakeWallTex(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#171020') // 穹頂暗
  grad.addColorStop(0.45, '#2c2030')
  grad.addColorStop(0.8, '#4a3844')
  grad.addColorStop(1, '#5c4650')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 256)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function Gen6Shell() {
  const wallTex = useMemo(() => gen6MakeWallTex(), [])
  return (
    <>
      <color attach="background" args={['#171020']} />
      <fog attach="fog" args={['#241a28', 70, 190]} />
      {/* 圓形殼牆 */}
      <mesh position={[0, WALL_H / 2 - 2, 0]}>
        <cylinderGeometry args={[WALL_R, WALL_R + 3, WALL_H, 48, 1, true]} />
        <meshBasicMaterial map={wallTex} side={BackSide} fog={false} />
      </mesh>
      {/* 穹頂 */}
      <mesh position={[0, WALL_H - 2.5, 0]}>
        <sphereGeometry args={[WALL_R, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#120c1a" side={BackSide} fog={false} />
      </mesh>
      {/* 殼內地面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.62, 0]}>
        <circleGeometry args={[WALL_R + 4, 48]} />
        <meshStandardMaterial color="#2c2434" roughness={0.9} />
      </mesh>
    </>
  )
}

/* ---------- 彩繪玻璃長窗（instanced 圖集） + 彩色光柱 ---------- */

const G6_WINDOW_COUNT = 12
const G6_GLASS_HUES: [number, number, number][] = [
  [1.5, 0.55, 0.75], // 玫瑰
  [0.55, 0.8, 1.6], // 藍
  [1.5, 1.2, 0.45], // 金
  [0.6, 1.4, 0.9], // 綠
]

/** 4 款彩繪玻璃設計排成一列圖集 */
function gen6MakeGlassAtlas(): CanvasTexture {
  const CW = 128
  const CH = 256
  const c = document.createElement('canvas')
  c.width = CW * 4
  c.height = CH
  const g = c.getContext('2d')!
  g.clearRect(0, 0, c.width, c.height)

  const palettes = [
    ['#ff5f88', '#ffb0c8', '#d03060', '#ffd9e4'],
    ['#3868e8', '#78b0ff', '#20387a', '#a8d0ff'],
    ['#f0b040', '#ffe090', '#b07018', '#fff0c0'],
    ['#30b068', '#88e0a8', '#187048', '#c8f0d8'],
  ]

  for (let w = 0; w < 4; w++) {
    const ox = w * CW
    const pal = palettes[w]
    const r = gen6Rng(w * 31 + 5)
    // 尖拱窗形裁剪
    g.save()
    g.beginPath()
    g.moveTo(ox + 12, CH - 6)
    g.lineTo(ox + 12, 78)
    g.quadraticCurveTo(ox + CW / 2, -30, ox + CW - 12, 78)
    g.lineTo(ox + CW - 12, CH - 6)
    g.closePath()
    g.clip()
    // 彩色玻璃碎片（放射狀鑲嵌）
    const cx = ox + CW / 2
    const cy = 120
    for (let ring = 0; ring < 5; ring++) {
      const n = 6 + ring * 2
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2
        const a1 = ((i + 1) / n) * Math.PI * 2
        const r0 = 12 + ring * 26
        const r1 = r0 + 26
        g.fillStyle = pal[(i + ring + ((r() * 2) | 0)) % pal.length]
        g.beginPath()
        g.moveTo(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0 * 1.6)
        g.lineTo(cx + Math.cos(a0) * r1, cy + Math.sin(a0) * r1 * 1.6)
        g.lineTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1 * 1.6)
        g.lineTo(cx + Math.cos(a1) * r0, cy + Math.sin(a1) * r0 * 1.6)
        g.closePath()
        g.fill()
      }
    }
    // 鉛條
    g.strokeStyle = 'rgba(24, 18, 14, 0.9)'
    g.lineWidth = 4
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2
      g.beginPath()
      g.moveTo(cx, cy)
      g.lineTo(cx + Math.cos(ang) * 140, cy + Math.sin(ang) * 224)
      g.stroke()
    }
    g.beginPath()
    g.arc(cx, cy, 34, 0, Math.PI * 2)
    g.stroke()
    // 中央玫瑰花心
    g.fillStyle = pal[0]
    g.beginPath()
    g.arc(cx, cy, 16, 0, Math.PI * 2)
    g.fill()
    g.restore()
    // 石框
    g.strokeStyle = '#3a3028'
    g.lineWidth = 8
    g.beginPath()
    g.moveTo(ox + 12, CH - 6)
    g.lineTo(ox + 12, 78)
    g.quadraticCurveTo(ox + CW / 2, -30, ox + CW - 12, 78)
    g.lineTo(ox + CW - 12, CH - 6)
    g.stroke()
  }

  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function Gen6StainedGlass() {
  const { windows, shafts, shaftMat } = useMemo(() => {
    const atlas = gen6MakeGlassAtlas()

    // 窗：instanced plane + aVariant 圖集偏移
    const geo = new PlaneGeometry(5.4, 11)
    const variants = new Float32Array(G6_WINDOW_COUNT)
    for (let i = 0; i < G6_WINDOW_COUNT; i++) variants[i] = i % 4
    geo.setAttribute('aVariant', new InstancedBufferAttribute(variants, 1))
    const mat = new MeshBasicMaterial({ map: atlas, transparent: true, toneMapped: false, fog: false })
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = `attribute float aVariant;\n${shader.vertexShader.replace(
        '#include <uv_vertex>',
        ['#include <uv_vertex>', '#ifdef USE_MAP', 'vMapUv = vMapUv * vec2(0.25, 1.0) + vec2(aVariant * 0.25, 0.0);', '#endif'].join(
          '\n',
        ),
      )}`
    }
    const win = new InstancedMesh(geo, mat, G6_WINDOW_COUNT)

    // 光柱：instanced 錐柱（窄端 = 窗 = 亮端），instanceColor 對應玻璃色
    const shaftGeo = new CylinderGeometry(3.0, 0.6, 32, 10, 1, true)
    shaftGeo.translate(0, 16, 0) // 原點在窄端（光源 = 窗）
    const shaftMaterial = new MeshBasicMaterial({
      transparent: true,
      opacity: 0.16,
      alphaMap: getBeamAlphaMap(),
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
      fog: false,
    })
    const shaft = new InstancedMesh(shaftGeo, shaftMaterial, G6_WINDOW_COUNT)

    const m4 = new Matrix4()
    const q = new Quaternion()
    const pos = new Vector3()
    const sc = new Vector3(1, 1, 1)
    const up = new Vector3(0, 1, 0)
    const dir = new Vector3()
    const color = new Color()
    for (let i = 0; i < G6_WINDOW_COUNT; i++) {
      const ang = (i / G6_WINDOW_COUNT) * Math.PI * 2 + Math.PI / G6_WINDOW_COUNT
      const x = Math.cos(ang) * (WALL_R - 1.2)
      const z = Math.sin(ang) * (WALL_R - 1.2)
      pos.set(x, 22, z)
      // 面向場心
      const yaw = Math.atan2(-x, -z)
      q.setFromAxisAngle(up, yaw)
      m4.compose(pos, q, sc)
      win.setMatrixAt(i, m4)

      // 光柱：幾何沿 +Y 展開（源在原點），把 +Y 轉向「窗 → 場邊地面」方向
      dir.set(-x * 0.82, -22, -z * 0.82).normalize()
      q.setFromUnitVectors(up, dir)
      m4.compose(pos, q, sc)
      shaft.setMatrixAt(i, m4)
      const hue = G6_GLASS_HUES[i % 4]
      color.setRGB(hue[0], hue[1], hue[2])
      shaft.setColorAt(i, color)
    }
    win.instanceMatrix.needsUpdate = true
    shaft.instanceMatrix.needsUpdate = true
    if (shaft.instanceColor) shaft.instanceColor.needsUpdate = true
    win.frustumCulled = false
    shaft.frustumCulled = false
    return { windows: win, shafts: shaft, shaftMat: shaftMaterial }
  }, [])

  useFrame(({ clock }) => {
    shaftMat.opacity = 0.13 + 0.05 * Math.sin(clock.elapsedTime * 0.7)
  })

  return (
    <group>
      <primitive object={windows} />
      <primitive object={shafts} />
    </group>
  )
}

/* ---------- 白金看台 ---------- */

function Gen6Stands() {
  const geos = useMemo(() => {
    const slopes: BufferGeometry[] = []
    const walls: BufferGeometry[] = []
    const trims: BufferGeometry[] = []
    let prevAOut = G6_TIERS[0].aIn
    let prevBOut = G6_TIERS[0].bIn
    let prevYTop = -0.5
    for (const t of G6_TIERS) {
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
    const led = ellipseRing(RIM_A + 0.04, RIM_B + 0.04, RAIL_TOP, RIM_A + 0.04, RIM_B + 0.04, RAIL_TOP + 0.22)
    return { slopes, walls, trims, led }
  }, [])

  return (
    <group>
      {geos.slopes.map((g, i) => (
        <mesh key={`s${i}`} geometry={g}>
          <meshStandardMaterial color={i % 2 === 0 ? MARBLE_A : MARBLE_B} roughness={0.75} side={DoubleSide} />
        </mesh>
      ))}
      {geos.walls.map((g, i) => (
        <mesh key={`w${i}`} geometry={g}>
          <meshStandardMaterial color={MARBLE_WALL} roughness={0.7} side={DoubleSide} />
        </mesh>
      ))}
      {geos.trims.map((g, i) => (
        <mesh key={`t${i}`} geometry={g}>
          <meshStandardMaterial color={GOLD} metalness={0.75} roughness={0.35} side={DoubleSide} />
        </mesh>
      ))}
      {/* 玫瑰色 LED 冠帶（bloom） */}
      <mesh geometry={geos.led}>
        <meshBasicMaterial color={[1.7, 0.7, 1.0]} toneMapped={false} side={DoubleSide} fog={false} />
      </mesh>
    </group>
  )
}

/* ---------- 六邊形桁架 + 吊燈環 + 緩轉鋼環 ---------- */

function Gen6Overhead() {
  const steel = useRef<Group>(null)
  const hexA = useRef<Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (steel.current) steel.current.rotation.y = t * 0.12
    if (hexA.current) hexA.current.rotation.y = -t * 0.04
  })

  return (
    <group>
      {/* 六邊形桁架帶（兩圈，六角柱殼） */}
      <mesh ref={hexA} position={[0, 27, 0]}>
        <cylinderGeometry args={[30, 30, 1.4, 6, 1, true]} />
        <meshStandardMaterial color={GOLD} metalness={0.85} roughness={0.3} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 31.5, 0]} rotation={[0, Math.PI / 6, 0]}>
        <cylinderGeometry args={[21, 21, 1.2, 6, 1, true]} />
        <meshStandardMaterial color={GOLD} metalness={0.85} roughness={0.3} side={DoubleSide} />
      </mesh>
      {/* 緩轉鋼環（元素機關） */}
      <group ref={steel} position={[0, 22.5, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[14, 0.42, 8, 48]} />
          <meshStandardMaterial color="#9aa2b0" metalness={0.95} roughness={0.25} />
        </mesh>
        {/* 環上四枚金飾釘 */}
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(a) * 14, 0, Math.sin(a) * 14]}>
              <boxGeometry args={[1.1, 1.1, 1.1]} />
              <meshStandardMaterial color={GOLD} metalness={0.9} roughness={0.25} />
            </mesh>
          )
        })}
      </group>
      {/* 吊燈光環（自發光，走 bloom） */}
      <mesh position={[0, 19, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[8, 0.24, 8, 40]} />
        <meshBasicMaterial color={[2.2, 1.7, 0.9]} toneMapped={false} fog={false} />
      </mesh>
      <mesh position={[0, 24.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[4.6, 0.2, 8, 32]} />
        <meshBasicMaterial color={[2.2, 1.7, 0.9]} toneMapped={false} fog={false} />
      </mesh>
      <pointLight position={[0, 20, 0]} color="#ffd9a0" distance={60} decay={1.8} intensity={38} />
    </group>
  )
}

/* ---------- 六邊形大螢幕 ---------- */

function gen6MakeScreenTex(): CanvasTexture {
  const S = 512
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const g = c.getContext('2d')!
  g.fillStyle = '#120e24'
  g.fillRect(0, 0, S, S)

  // 六邊形細格背景
  g.strokeStyle = 'rgba(120, 90, 160, 0.22)'
  g.lineWidth = 2
  const hr = 26
  for (let row = 0; row < 14; row++) {
    for (let col = 0; col < 14; col++) {
      const x = col * hr * 1.74 + (row % 2 ? hr * 0.87 : 0)
      const y = row * hr * 1.5
      g.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6
        const px = x + Math.cos(a) * hr
        const py = y + Math.sin(a) * hr
        if (i === 0) g.moveTo(px, py)
        else g.lineTo(px, py)
      }
      g.closePath()
      g.stroke()
    }
  }

  g.textAlign = 'center'
  g.fillStyle = '#f0d090'
  g.font = 'bold 46px Georgia, serif'
  g.fillText('LUMIOSE', S / 2, 150)
  g.fillText('CONFERENCE', S / 2, 202)
  g.fillStyle = '#e87a9e'
  g.font = 'bold 22px monospace'
  g.fillText('KALOS POKÉMON LEAGUE', S / 2, 246)

  g.fillStyle = '#f2f2f2'
  g.font = 'bold 26px monospace'
  g.textAlign = 'left'
  g.fillText('PIKACHU', 70, 322)
  g.textAlign = 'right'
  g.fillText('CHARIZARD', S - 70, 322)
  g.textAlign = 'center'
  g.fillStyle = '#ff4060'
  g.font = 'bold 30px monospace'
  g.fillText('VS', S / 2, 324)

  // HP 條
  g.fillStyle = '#26304a'
  g.fillRect(70, 342, 150, 16)
  g.fillRect(S - 220, 342, 150, 16)
  g.fillStyle = '#40d868'
  g.fillRect(70, 342, 150, 16)
  g.fillRect(S - 220, 342, 132, 16)

  g.fillStyle = '#8a7ab0'
  g.font = 'bold 20px monospace'
  g.fillText('* PRISM TOWER PRESENTS *', S / 2, 424)

  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function Gen6Jumbotron() {
  const tex = useMemo(() => gen6MakeScreenTex(), [])
  return (
    <group position={[0, 17.5, -45]}>
      {/* 螢幕（六邊形，平頂朝上） */}
      <mesh rotation={[0, 0, Math.PI / 6]}>
        <circleGeometry args={[7, 6]} />
        <meshBasicMaterial map={tex} toneMapped={false} fog={false} />
      </mesh>
      {/* 金框 + 玫瑰霓虹邊 */}
      <mesh position={[0, 0, -0.1]} rotation={[0, 0, Math.PI / 6]}>
        <ringGeometry args={[7, 8.1, 6]} />
        <meshStandardMaterial color={GOLD} metalness={0.85} roughness={0.3} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0, -0.05]} rotation={[0, 0, Math.PI / 6]}>
        <ringGeometry args={[8.1, 8.45, 6]} />
        <meshBasicMaterial color={[1.8, 0.75, 1.05]} toneMapped={false} side={DoubleSide} fog={false} />
      </mesh>
    </group>
  )
}

/* ---------- 元素機關：火柱噴發 ---------- */

/** 噴發包絡：週期 period 秒，rise 0.35s → hold ~1.3s（帶抖動）→ fall 0.6s */
function gen6Burst(t: number, period: number, phase: number): number {
  const local = (((t + phase) % period) + period) % period
  if (local < 0.35) return local / 0.35
  if (local < 1.65) return 1 - 0.12 * Math.abs(Math.sin(local * 34))
  if (local < 2.25) return Math.max(0, 1 - (local - 1.65) / 0.6)
  return 0
}

// 火柱管位於右後弧（戰鬥鏡頭朝 −Z 可見）
const G6_PIPES: { x: number; z: number; phase: number }[] = [
  { x: 41, z: -21, phase: 0 },
  { x: 29, z: -38, phase: 3.1 },
]

function Gen6FirePipes() {
  const cones = useRef<(Group | null)[]>([])
  const lights = useRef<(PointLight | null)[]>([])

  const coneGeo = useMemo(() => {
    const geo = new ConeGeometry(2.1, 10, 12, 1, true)
    geo.translate(0, 5, 0)
    return geo
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    G6_PIPES.forEach((p, i) => {
      const e = gen6Burst(t, 6.4, p.phase)
      const g = cones.current[i]
      if (g) {
        const s = Math.max(0.04, e)
        g.scale.set(0.45 + 0.55 * s, Math.max(0.02, s * (1 + 0.06 * Math.sin(t * 47 + i))), 0.45 + 0.55 * s)
      }
      const l = lights.current[i]
      if (l) l.intensity = e * 130
    })
  })

  return (
    <group>
      {G6_PIPES.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          {/* 黃銅管 */}
          <mesh position={[0, 5, 0]}>
            <cylinderGeometry args={[1.5, 1.9, 10, 12]} />
            <meshStandardMaterial color="#8a6a34" metalness={0.85} roughness={0.35} />
          </mesh>
          <mesh position={[0, 10.4, 0]}>
            <cylinderGeometry args={[2.1, 1.5, 1.6, 12]} />
            <meshStandardMaterial color="#6a4f24" metalness={0.85} roughness={0.3} />
          </mesh>
          {/* 火柱（雙錐嵌套，加法混合；scale.y 由噴發包絡驅動） */}
          <group ref={(el) => { cones.current[i] = el }} position={[0, 11.2, 0]} scale={[0.45, 0.02, 0.45]}>
            <mesh geometry={coneGeo}>
              <meshBasicMaterial
                color={[2.6, 0.85, 0.12]}
                transparent
                opacity={0.85}
                alphaMap={getBeamAlphaMap()}
                blending={AdditiveBlending}
                depthWrite={false}
                side={DoubleSide}
                toneMapped={false}
                fog={false}
              />
            </mesh>
            <mesh geometry={coneGeo} scale={[0.55, 0.8, 0.55]}>
              <meshBasicMaterial
                color={[3.2, 2.2, 0.6]}
                transparent
                opacity={0.95}
                alphaMap={getBeamAlphaMap()}
                blending={AdditiveBlending}
                depthWrite={false}
                side={DoubleSide}
                toneMapped={false}
                fog={false}
              />
            </mesh>
          </group>
          <pointLight
            ref={(l) => { lights.current[i] = l }}
            position={[0, 13, 0]}
            color="#ff8830"
            distance={55}
            decay={1.8}
            intensity={0}
          />
        </group>
      ))}
    </group>
  )
}

/* ---------- 元素機關：水幕簾 ---------- */

function gen6MakeWaterTex(): CanvasTexture {
  const W = 256
  const H = 512
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.clearRect(0, 0, W, H)
  const r = gen6Rng(661)
  for (let i = 0; i < 150; i++) {
    const x = r() * W
    const y = r() * H
    const len = 30 + r() * 140
    const w = 1.5 + r() * 3.5
    const a = 0.14 + r() * 0.4
    const grad = g.createLinearGradient(0, y, 0, y + len)
    grad.addColorStop(0, 'rgba(210, 235, 255, 0)')
    grad.addColorStop(0.5, `rgba(200, 230, 255, ${a})`)
    grad.addColorStop(1, 'rgba(230, 245, 255, 0)')
    g.fillStyle = grad
    g.fillRect(x, y, w, len)
  }
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  return tex
}

function gen6MakeMistTex(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 64)
  grad.addColorStop(0, 'rgba(210, 235, 255, 0.55)')
  grad.addColorStop(1, 'rgba(210, 235, 255, 0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new CanvasTexture(c)
}

// 水幕位於左後弧（與火柱對稱）
const G6_FALLS: { x: number; z: number }[] = [
  { x: -42, z: -21 },
  { x: -30, z: -38 },
]

function Gen6WaterCurtains() {
  const tex = useMemo(() => gen6MakeWaterTex(), [])
  const mistTex = useMemo(() => gen6MakeMistTex(), [])
  const mists = useRef<(Mesh | null)[]>([])

  useFrame(({ clock }, delta) => {
    tex.offset.y -= delta * 0.55
    const t = clock.elapsedTime
    mists.current.forEach((m, i) => {
      if (!m) return
      const s = 1 + 0.12 * Math.sin(t * 1.9 + i * 2)
      m.scale.set(s, 1, s)
      ;(m.material as MeshBasicMaterial).opacity = 0.4 + 0.12 * Math.sin(t * 2.3 + i)
    })
  })

  return (
    <group>
      {G6_FALLS.map((f, i) => (
        <group key={i} position={[f.x, 0, f.z]} rotation={[0, Math.atan2(-f.x, -f.z), 0]}>
          {/* 出水簷口 */}
          <mesh position={[0, 15.2, -0.6]}>
            <boxGeometry args={[11, 1.2, 1.6]} />
            <meshStandardMaterial color="#8a95a8" metalness={0.7} roughness={0.4} />
          </mesh>
          {/* 落水簾（滾動貼圖） */}
          <mesh position={[0, 8, 0]}>
            <planeGeometry args={[10, 14.5]} />
            <meshBasicMaterial
              map={tex}
              transparent
              opacity={0.8}
              depthWrite={false}
              side={DoubleSide}
              color="#bcd8f0"
              fog={false}
            />
          </mesh>
          {/* 底部水霧 */}
          <mesh ref={(el) => { mists.current[i] = el }} position={[0, 1.6, 0.6]}>
            <planeGeometry args={[12, 4.2]} />
            <meshBasicMaterial
              map={mistTex}
              transparent
              opacity={0.45}
              blending={AdditiveBlending}
              depthWrite={false}
              side={DoubleSide}
              fog={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* ---------- 主組件：布景 ---------- */

export default function Gen6Lumiose() {
  return (
    <>
      <Gen6Shell />
      <Environment files="/assets/hdri/venice_sunset_2k.hdr" environmentIntensity={0.5} />

      {/* 主光：暖白頂光（唯一投影光源，吊燈感） */}
      <directionalLight
        position={[8, 30, 14]}
        intensity={1.35}
        color="#ffe6c4"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-far={70}
        shadow-bias={-0.0004}
      />
      <hemisphereLight args={['#9a7aa8', '#3a3040', 0.55]} />
      <ambientLight intensity={0.16} color="#c8a8d0" />

      <Gen6Stands />
      <Crowd tiers={G6_TIERS} style="modern" brightness={[0.8, 1.05]} />
      <Gen6StainedGlass />
      <Gen6Overhead />
      <Gen6Jumbotron />
      <Gen6FirePipes />
      <Gen6WaterCurtains />
    </>
  )
}

/* ---------- 戰鬥地板：拋光大理石 + 六邊形母題 ---------- */

function gen6DrawHex(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6
    const px = x + Math.cos(a) * r
    const py = y + Math.sin(a) * r
    if (i === 0) g.moveTo(px, py)
    else g.lineTo(px, py)
  }
  g.closePath()
}

function gen6MakeCourtTex(): CanvasTexture {
  const W = 1600
  const H = 960
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const r = gen6Rng(66)

  // 大理石底
  g.fillStyle = '#ece6da'
  g.fillRect(0, 0, W, H)
  for (let i = 0; i < 60; i++) {
    g.fillStyle = i % 2 ? 'rgba(220, 210, 192, 0.4)' : 'rgba(246, 242, 234, 0.5)'
    g.beginPath()
    g.ellipse(r() * W, r() * H, 60 + r() * 160, 30 + r() * 90, r() * Math.PI, 0, Math.PI * 2)
    g.fill()
  }
  // 大理石紋
  g.strokeStyle = 'rgba(150, 138, 120, 0.35)'
  for (let i = 0; i < 34; i++) {
    g.lineWidth = 1 + r() * 2
    let x = r() * W
    let y = r() * H
    g.beginPath()
    g.moveTo(x, y)
    for (let sgm = 0; sgm < 5; sgm++) {
      const nx = x + (r() - 0.5) * 260
      const ny = y + (r() - 0.5) * 150
      g.quadraticCurveTo(x + (r() - 0.5) * 90, y + (r() - 0.5) * 60, nx, ny)
      x = nx
      y = ny
    }
    g.stroke()
  }

  // 六邊形邊帶（上下緣，金）
  g.strokeStyle = 'rgba(178, 138, 70, 0.5)'
  g.lineWidth = 3
  const hr = 40
  for (let col = 0; col < 25; col++) {
    for (const row of [0, 1]) {
      const x = 40 + col * hr * 1.74 + (row % 2 ? hr * 0.87 : 0)
      gen6DrawHex(g, x, 68 + row * hr * 1.1, hr * 0.56)
      g.stroke()
      gen6DrawHex(g, x, H - 68 - row * hr * 1.1, hr * 0.56)
      g.stroke()
    }
  }

  // 邊界線
  const M = 60
  g.strokeStyle = 'rgba(178, 138, 70, 0.9)'
  g.lineWidth = 9
  g.strokeRect(M, M, W - M * 2, H - M * 2)
  g.beginPath()
  g.moveTo(W / 2, M)
  g.lineTo(W / 2, H - M)
  g.stroke()

  // 中央六邊形徽章
  const cx = W / 2
  const cy = H / 2
  g.lineWidth = 11
  g.strokeStyle = 'rgba(178, 138, 70, 0.95)'
  gen6DrawHex(g, cx, cy, 200)
  g.stroke()
  g.lineWidth = 6
  g.strokeStyle = 'rgba(226, 120, 158, 0.9)'
  gen6DrawHex(g, cx, cy, 168)
  g.stroke()
  g.lineWidth = 5
  g.strokeStyle = 'rgba(178, 138, 70, 0.8)'
  gen6DrawHex(g, cx, cy, 70)
  g.stroke()
  // 六向放射
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6
    g.beginPath()
    g.moveTo(cx + Math.cos(a) * 70, cy + Math.sin(a) * 70)
    g.lineTo(cx + Math.cos(a) * 168, cy + Math.sin(a) * 168)
    g.stroke()
  }

  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

export function Gen6LumioseFloor(_props: { fieldType?: FieldType | null }) {
  const tex = useMemo(() => gen6MakeCourtTex(), [])
  return (
    <RigidBody type="fixed" colliders={false}>
      {/* 碰撞體不變：40×24 頂面 y=0 + 四面隱形擋牆 */}
      <CuboidCollider args={[20, 0.25, 12]} position={[0, -0.25, 0]} />
      <CuboidCollider args={[0.3, 2, 12.6]} position={[20.9, 1.5, 0]} />
      <CuboidCollider args={[0.3, 2, 12.6]} position={[-20.9, 1.5, 0]} />
      <CuboidCollider args={[21.2, 2, 0.3]} position={[0, 1.5, 12.9]} />
      <CuboidCollider args={[21.2, 2, 0.3]} position={[0, 1.5, -12.9]} />

      {/* 基座 */}
      <mesh position={[0, -0.26, 0]}>
        <boxGeometry args={[40, 0.5, 24]} />
        <meshStandardMaterial color="#b8ae9c" roughness={0.8} />
      </mesh>
      {/* 拋光大理石頂面（高光滑度 + 環境反射 = 鏡面感） */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <planeGeometry args={[40, 24]} />
        <meshStandardMaterial map={tex} roughness={0.12} metalness={0.08} envMapIntensity={1.25} />
      </mesh>
      {/* 場外迴廊地面（純視覺；圓形貼合殼牆） */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <circleGeometry args={[51, 48]} />
        <meshStandardMaterial color="#4a4050" roughness={0.85} />
      </mesh>
    </RigidBody>
  )
}
