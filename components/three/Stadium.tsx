'use client'
import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from 'three'

const SEG = 96

/** 橢圓環面（內圈→外圈，可含高低差），用於看台斜面 / 立面牆 */
function ellipseRing(
  aIn: number, bIn: number, yIn: number,
  aOut: number, bOut: number, yOut: number,
  seg = SEG,
): BufferGeometry {
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= seg; i++) {
    const t = (i / seg) * Math.PI * 2
    const cos = Math.cos(t)
    const sin = Math.sin(t)
    pos.push(cos * aIn, yIn, sin * bIn)
    pos.push(cos * aOut, yOut, sin * bOut)
  }
  for (let i = 0; i < seg; i++) {
    const k = i * 2
    idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2)
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

type Tier = { aIn: number; bIn: number; yBase: number; depth: number; rise: number; rows: number }

const TIERS: Tier[] = [
  { aIn: 25.0, bIn: 17.5, yBase: 2.4, depth: 6.5, rise: 3.4, rows: 9 },
  { aIn: 32.2, bIn: 24.7, yBase: 6.8, depth: 6.5, rise: 3.6, rows: 9 },
  { aIn: 39.4, bIn: 31.9, yBase: 11.5, depth: 7.5, rise: 4.6, rows: 11 },
]

const MAGENTA = '#ff2d78'

function StandShell() {
  const geos = useMemo(() => {
    const slopes: BufferGeometry[] = []
    const walls: BufferGeometry[] = []
    const trims: BufferGeometry[] = []
    let prevAOut = TIERS[0].aIn
    let prevBOut = TIERS[0].bIn
    let prevYTop = -0.5
    for (const t of TIERS) {
      const aOut = t.aIn + t.depth
      const bOut = t.bIn + t.depth
      const yTop = t.yBase + t.rise
      // 前立面牆（從前一層頂 / 地面 → 本層底）
      walls.push(ellipseRing(prevAOut, prevBOut, prevYTop, t.aIn, t.bIn, t.yBase))
      // 本層斜面
      slopes.push(ellipseRing(t.aIn, t.bIn, t.yBase, aOut, bOut, yTop))
      // 立面頂端洋紅飾條（發光）
      trims.push(ellipseRing(t.aIn - 0.04, t.bIn - 0.04, t.yBase - 0.13, t.aIn - 0.04, t.bIn - 0.04, t.yBase))
      prevAOut = aOut
      prevBOut = bOut
      prevYTop = yTop
    }
    // 頂層護欄 + 冠冕發光環
    walls.push(ellipseRing(prevAOut, prevBOut, prevYTop, prevAOut, prevBOut, prevYTop + 1.8))
    trims.push(ellipseRing(prevAOut + 0.02, prevBOut + 0.02, prevYTop + 1.62, prevAOut + 0.02, prevBOut + 0.02, prevYTop + 1.92))
    return { slopes, walls, trims }
  }, [])

  return (
    <group>
      {geos.slopes.map((g, i) => (
        <mesh key={`s${i}`} geometry={g}>
          <meshStandardMaterial color={i % 2 === 0 ? '#262a34' : '#22262f'} roughness={0.95} side={DoubleSide} />
        </mesh>
      ))}
      {geos.walls.map((g, i) => (
        <mesh key={`w${i}`} geometry={g}>
          <meshStandardMaterial color="#141821" roughness={0.9} side={DoubleSide} />
        </mesh>
      ))}
      {geos.trims.map((g, i) => (
        <mesh key={`t${i}`} geometry={g}>
          <meshBasicMaterial color={MAGENTA} toneMapped={false} side={DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

/** 觀眾：單一 InstancedMesh，GPU 端做便宜的跳動動畫 */
function Crowd() {
  const uTime = useMemo(() => ({ value: 0 }), [])

  const mesh = useMemo(() => {
    type P = { x: number; y: number; z: number; s: number }
    const list: P[] = []
    for (const t of TIERS) {
      for (let r = 0; r < t.rows; r++) {
        const f = (r + 0.5) / t.rows
        const a = t.aIn + f * t.depth
        const b = t.bIn + f * t.depth
        const y = t.yBase + f * t.rise + 0.34
        const perim = 2 * Math.PI * Math.sqrt((a * a + b * b) / 2)
        const n = Math.floor(perim / 0.62)
        for (let i = 0; i < n; i++) {
          if (Math.random() < 0.1) continue // 零星空位
          const ang = (i / n) * Math.PI * 2 + Math.random() * 0.008
          list.push({
            x: Math.cos(ang) * a + (Math.random() - 0.5) * 0.16,
            y: y + (Math.random() - 0.5) * 0.06,
            z: Math.sin(ang) * b + (Math.random() - 0.5) * 0.16,
            s: 0.82 + Math.random() * 0.36,
          })
        }
      }
    }

    const geo = new BoxGeometry(0.34, 0.66, 0.26)
    geo.translate(0, 0.33, 0)
    const mat = new MeshBasicMaterial({ color: 0xffffff })
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime
      shader.vertexShader = `uniform float uTime;\n${shader.vertexShader.replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          'float ph = float(gl_InstanceID);',
          'float hop = step(0.62, fract(ph * 0.6180339));',
          'transformed.y += hop * (0.5 + 0.5 * sin(uTime * (2.2 + mod(ph, 2.6)) + ph * 1.7)) * 0.22;',
        ].join('\n'),
      )}`
    }

    const m = new InstancedMesh(geo, mat, list.length)
    const mat4 = new Matrix4()
    const q = new Quaternion()
    const v = new Vector3()
    const sc = new Vector3()
    const color = new Color()
    const palette = ['#ff2d78', '#e94560', '#f2f2f2', '#ffd166', '#29d8ff', '#7a5cff', '#3ddc84', '#ff8c42']
    list.forEach((p, i) => {
      v.set(p.x, p.y, p.z)
      sc.set(p.s, p.s, p.s)
      mat4.compose(v, q, sc)
      m.setMatrixAt(i, mat4)
      if (Math.random() < 0.32) {
        color.set(palette[(Math.random() * palette.length) | 0])
        color.multiplyScalar(0.14 + Math.random() * 0.2) // 線性空間，等效 sRGB 調暗約一半
      } else {
        color.setHSL(Math.random(), 0.25 + Math.random() * 0.35, 0.1 + Math.random() * 0.26, SRGBColorSpace)
      }
      m.setColorAt(i, color)
    })
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

export default function Stadium() {
  return (
    <group>
      <StandShell />
      <Crowd />
    </group>
  )
}
