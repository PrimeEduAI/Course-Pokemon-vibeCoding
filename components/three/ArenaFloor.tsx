'use client'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'

/** 程序化英式足球場草皮：割草條紋、白線、寶貝球中圈 */
function makePitchTexture(): CanvasTexture {
  const W = 1600
  const H = 960 // 40m × 24m → 40px/m
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!

  // 割草條紋（沿長邊交錯兩種綠）
  const stripes = 12
  const sw = W / stripes
  for (let i = 0; i < stripes; i++) {
    g.fillStyle = i % 2 === 0 ? '#186a34' : '#115a29'
    g.fillRect(i * sw, 0, sw + 1, H)
  }
  // 草皮噪點
  for (let i = 0; i < 4200; i++) {
    const x = Math.random() * W
    const y = Math.random() * H
    g.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.035)'
    g.fillRect(x, y, 2 + Math.random() * 3, 2 + Math.random() * 3)
  }

  const M = 60 // 邊線留 1.5m
  const line = 'rgba(250,250,250,0.95)'
  g.strokeStyle = line
  g.lineWidth = 8
  g.strokeRect(M, M, W - M * 2, H - M * 2)
  // 中線
  g.beginPath()
  g.moveTo(W / 2, M)
  g.lineTo(W / 2, H - M)
  g.stroke()
  // 兩端禁區
  for (const side of [0, 1]) {
    const x0 = side === 0 ? M : W - M
    const dir = side === 0 ? 1 : -1
    g.strokeRect(Math.min(x0, x0 + dir * 250), H / 2 - 290, 250, 580)
    g.strokeRect(Math.min(x0, x0 + dir * 110), H / 2 - 150, 110, 300)
  }

  // 寶貝球中圈徽章
  const cx = W / 2
  const cy = H / 2
  const R = 195
  // 上半染紅（加拉爾聯盟配色的暗紅暈）
  g.save()
  g.beginPath()
  g.arc(cx, cy, R - 5, Math.PI, Math.PI * 2)
  g.closePath()
  g.fillStyle = 'rgba(215, 45, 85, 0.20)'
  g.fill()
  g.restore()
  g.lineWidth = 10
  g.beginPath()
  g.arc(cx, cy, R, 0, Math.PI * 2)
  g.stroke()
  // 中央橫帶
  g.lineWidth = 10
  g.beginPath()
  g.moveTo(cx - R, cy)
  g.lineTo(cx + R, cy)
  g.stroke()
  // 中央按鈕
  g.lineWidth = 8
  g.beginPath()
  g.arc(cx, cy, 48, 0, Math.PI * 2)
  g.stroke()
  g.fillStyle = line
  g.beginPath()
  g.arc(cx, cy, 20, 0, Math.PI * 2)
  g.fill()

  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

export default function ArenaFloor() {
  const pitchTex = useMemo(() => makePitchTexture(), [])
  return (
    <RigidBody type="fixed" colliders={false}>
      {/* 原有地板碰撞體（40×24，頂面 y=0）不變 */}
      <CuboidCollider args={[20, 0.25, 12]} position={[0, -0.25, 0]} />
      {/* 場邊隱形擋牆：擋在廣告板位置，避免掉出場外 */}
      <CuboidCollider args={[0.3, 2, 12.6]} position={[20.9, 1.5, 0]} />
      <CuboidCollider args={[0.3, 2, 12.6]} position={[-20.9, 1.5, 0]} />
      <CuboidCollider args={[21.2, 2, 0.3]} position={[0, 1.5, 12.9]} />
      <CuboidCollider args={[21.2, 2, 0.3]} position={[0, 1.5, -12.9]} />

      {/* 草皮基座 */}
      <mesh position={[0, -0.26, 0]}>
        <boxGeometry args={[40, 0.5, 24]} />
        <meshStandardMaterial color="#0c2d17" roughness={1} />
      </mesh>
      {/* 草皮頂面（程序化貼圖） */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <planeGeometry args={[40, 24]} />
        <meshStandardMaterial map={pitchTex} roughness={0.92} metalness={0} />
      </mesh>
      {/* 場外柏油環場地面（純視覺） */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[130, 100]} />
        <meshStandardMaterial color="#131720" roughness={1} />
      </mesh>
    </RigidBody>
  )
}
