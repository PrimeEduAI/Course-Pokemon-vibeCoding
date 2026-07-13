'use client'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import type { FieldType } from './types'

/**
 * Gen 1 石英大會的四種經典場地：草 / 岩 / 水 / 冰。
 * 碰撞體 footprint 與宮門體育場完全相同（40×24、頂面 y=0、四面隱形擋牆）；
 * 岩場地的裝飾巨石全部放在擋牆外側，不影響戰鬥。
 */

/** 決定性偽隨機（每次生成一致的貼圖） */
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

function makeFieldTexture(type: FieldType): CanvasTexture {
  const W = 1600
  const H = 960
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const r = rng(type.length * 1013 + 77)

  if (type === 'grass') {
    g.fillStyle = '#4f9e3e'
    g.fillRect(0, 0, W, H)
    // 淺色草斑
    for (let i = 0; i < 90; i++) {
      g.fillStyle = 'rgba(120, 190, 90, 0.16)'
      g.beginPath()
      g.ellipse(r() * W, r() * H, 30 + r() * 80, 20 + r() * 50, r() * Math.PI, 0, Math.PI * 2)
      g.fill()
    }
    // 草叢筆觸（小 V 字）
    g.strokeStyle = 'rgba(28, 92, 30, 0.55)'
    g.lineWidth = 3
    for (let i = 0; i < 900; i++) {
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
    g.fillStyle = '#9a6a42'
    g.fillRect(0, 0, W, H)
    // 深淺土斑
    for (let i = 0; i < 70; i++) {
      g.fillStyle = i % 2 ? 'rgba(176, 127, 82, 0.35)' : 'rgba(110, 74, 44, 0.3)'
      g.beginPath()
      g.ellipse(r() * W, r() * H, 40 + r() * 110, 26 + r() * 70, r() * Math.PI, 0, Math.PI * 2)
      g.fill()
    }
    // 裂縫
    g.strokeStyle = 'rgba(74, 48, 26, 0.75)'
    for (let i = 0; i < 46; i++) {
      g.lineWidth = 2 + r() * 3
      let x = r() * W
      let y = r() * H
      g.beginPath()
      g.moveTo(x, y)
      const seg = 3 + (r() * 4) | 0
      for (let sgm = 0; sgm < seg; sgm++) {
        x += (r() - 0.5) * 130
        y += (r() - 0.5) * 90
        g.lineTo(x, y)
      }
      g.stroke()
    }
    // 碎石
    for (let i = 0; i < 260; i++) {
      g.fillStyle = r() > 0.5 ? 'rgba(60,40,22,0.6)' : 'rgba(200,160,120,0.5)'
      g.fillRect(r() * W, r() * H, 3 + r() * 5, 3 + r() * 4)
    }
    drawBoundary(g, W, H)
  } else if (type === 'water') {
    const grad = g.createLinearGradient(0, 0, W, H)
    grad.addColorStop(0, '#2f6fd0')
    grad.addColorStop(1, '#2456ac')
    g.fillStyle = grad
    g.fillRect(0, 0, W, H)
    // 波光
    g.strokeStyle = 'rgba(255,255,255,0.22)'
    g.lineWidth = 3
    for (let i = 0; i < 160; i++) {
      const x = r() * W
      const y = r() * H
      const w = 18 + r() * 46
      g.beginPath()
      g.arc(x, y, w, Math.PI * 0.15, Math.PI * 0.85)
      g.stroke()
    }
    // 浮台圓盤（經典水場地站台）
    const pads: [number, number][] = [
      [0.2, 0.3], [0.5, 0.24], [0.8, 0.32],
      [0.22, 0.72], [0.52, 0.78], [0.8, 0.7],
    ]
    for (const [px, py] of pads) {
      const x = px * W
      const y = py * H
      g.fillStyle = '#a89060'
      g.beginPath()
      g.arc(x, y, 96, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#d8c9a0'
      g.beginPath()
      g.arc(x, y, 86, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = 'rgba(140, 116, 74, 0.5)'
      g.beginPath()
      g.arc(x, y, 62, 0, Math.PI * 2)
      g.fill()
    }
    drawBoundary(g, W, H, false)
  } else {
    // ice
    g.fillStyle = '#cfe8f4'
    g.fillRect(0, 0, W, H)
    // 冰面刷痕
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
    // 裂紋
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
    // 淡藍冰塊斑
    for (let i = 0; i < 40; i++) {
      g.fillStyle = 'rgba(160, 210, 235, 0.3)'
      g.beginPath()
      g.ellipse(r() * W, r() * H, 30 + r() * 90, 20 + r() * 60, r() * Math.PI, 0, Math.PI * 2)
      g.fill()
    }
    drawBoundary(g, W, H)
  }

  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

const SURFACE: Record<FieldType, { rough: number; env: number; base: string }> = {
  grass: { rough: 0.92, env: 0.35, base: '#274d1e' },
  rock: { rough: 0.97, env: 0.25, base: '#4c3420' },
  water: { rough: 0.32, env: 0.9, base: '#12325e' },
  ice: { rough: 0.07, env: 1.7, base: '#7fa8bc' },
}

/** 擋牆外側的裝飾巨石（岩場地限定；全部在戰鬥區域外） */
const BOULDERS: { p: [number, number, number]; s: number; ry: number }[] = [
  { p: [22.8, 0.7, 9.2], s: 1.5, ry: 0.4 },
  { p: [-23.2, 0.9, -7.4], s: 1.9, ry: 1.7 },
  { p: [22.6, 0.6, -10.3], s: 1.2, ry: 2.6 },
  { p: [-22.9, 0.8, 8.2], s: 1.6, ry: 0.9 },
  { p: [12.5, 0.8, 14.8], s: 1.7, ry: 3.4 },
  { p: [-9.8, 0.6, -15.0], s: 1.3, ry: 4.2 },
  { p: [-1.5, 1.0, 15.4], s: 2.0, ry: 5.1 },
  { p: [5.2, 0.6, -15.2], s: 1.1, ry: 0.2 },
]

export default function Gen1Field({ fieldType }: { fieldType: FieldType }) {
  const tex = useMemo(() => makeFieldTexture(fieldType), [fieldType])
  const surf = SURFACE[fieldType]
  return (
    <RigidBody type="fixed" colliders={false}>
      {/* 碰撞體與宮門體育場完全一致：40×24 頂面 y=0 + 四面隱形擋牆 */}
      <CuboidCollider args={[20, 0.25, 12]} position={[0, -0.25, 0]} />
      <CuboidCollider args={[0.3, 2, 12.6]} position={[20.9, 1.5, 0]} />
      <CuboidCollider args={[0.3, 2, 12.6]} position={[-20.9, 1.5, 0]} />
      <CuboidCollider args={[21.2, 2, 0.3]} position={[0, 1.5, 12.9]} />
      <CuboidCollider args={[21.2, 2, 0.3]} position={[0, 1.5, -12.9]} />

      {/* 場地基座 */}
      <mesh position={[0, -0.26, 0]}>
        <boxGeometry args={[40, 0.5, 24]} />
        <meshStandardMaterial color={surf.base} roughness={1} />
      </mesh>
      {/* 場地頂面（程序化貼圖，材質感依場地型別） */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <planeGeometry args={[40, 24]} />
        <meshStandardMaterial map={tex} roughness={surf.rough} metalness={0} envMapIntensity={surf.env} />
      </mesh>
      {/* 場外石板廣場（純視覺） */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[130, 100]} />
        <meshStandardMaterial color="#96897a" roughness={1} />
      </mesh>

      {/* 岩場地：擋牆外側裝飾巨石 */}
      {fieldType === 'rock' && BOULDERS.map((b, i) => (
        <mesh key={i} position={b.p} rotation={[0, b.ry, 0]} scale={b.s} castShadow>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#8a6a48" roughness={1} />
        </mesh>
      ))}
    </RigidBody>
  )
}
