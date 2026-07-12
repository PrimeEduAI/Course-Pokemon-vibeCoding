'use client'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { CanvasTexture, MeshBasicMaterial, RepeatWrapping, SRGBColorSpace } from 'three'

function makeBoardTexture(): CanvasTexture {
  const W = 2048
  const H = 128
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = '#12060d'
  g.fillRect(0, 0, W, H)
  g.textBaseline = 'middle'
  g.font = '900 78px "Arial Black", Arial, sans-serif'
  const unit = 'POKÉMON LEAGUE  ✦  CHAMPION CUP  ✦  GALAR  ✦  '
  let x = 20
  let i = 0
  while (x < W + 400) {
    g.fillStyle = i % 3 === 0 ? '#ff2d78' : i % 3 === 1 ? '#f2f2f2' : '#29d8ff'
    const word = unit.split('✦')[i % 3].trim() + '   ✦   '
    g.fillText(word, x, H / 2 + 4)
    x += g.measureText(word).width
    i++
  }
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.anisotropy = 4
  return tex
}

/** 場邊 LED 廣告板：發光捲動字幕 + 亮度脈動 */
export default function AdBoards() {
  const longTex = useMemo(() => makeBoardTexture(), [])
  const shortTex = useMemo(() => {
    const t = longTex.clone()
    t.repeat.x = 0.6
    return t
  }, [longTex])
  const matLong = useRef<MeshBasicMaterial>(null)
  const matShort = useRef<MeshBasicMaterial>(null)

  useFrame(({ clock }, dt) => {
    longTex.offset.x = (longTex.offset.x + dt * 0.04) % 1
    shortTex.offset.x = (shortTex.offset.x + dt * 0.04) % 1
    const pulse = 0.85 + 0.25 * Math.sin(clock.elapsedTime * 2.1)
    matLong.current?.color.setScalar(pulse)
    matShort.current?.color.setScalar(pulse)
  })

  const tilt = 0.16
  return (
    <group>
      {/* 長邊兩面 */}
      <mesh position={[0, 0.45, 12.75]} rotation={[tilt, Math.PI, 0]}>
        <planeGeometry args={[41.8, 1]} />
        <meshBasicMaterial ref={matLong} map={longTex} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.45, -12.75]} rotation={[-tilt, 0, 0]}>
        <planeGeometry args={[41.8, 1]} />
        <meshBasicMaterial map={longTex} toneMapped={false} />
      </mesh>
      {/* 短邊兩面 */}
      <mesh position={[20.75, 0.45, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[25.8, 1]} />
        <meshBasicMaterial ref={matShort} map={shortTex} toneMapped={false} />
      </mesh>
      <mesh position={[-20.75, 0.45, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[25.8, 1]} />
        <meshBasicMaterial map={shortTex} toneMapped={false} />
      </mesh>
    </group>
  )
}
