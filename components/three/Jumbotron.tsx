'use client'
import { useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { useBattle } from '@/stores/useBattle'

function makeScreenTexture(playerName: string, enemyName: string): CanvasTexture {
  const W = 1024
  const H = 512
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!

  // 底
  const bg = g.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#101426')
  bg.addColorStop(1, '#0a0d1a')
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)
  // 洋紅外框
  g.strokeStyle = '#ff2d78'
  g.lineWidth = 14
  g.strokeRect(7, 7, W - 14, H - 14)

  g.textAlign = 'center'
  // 標題
  g.fillStyle = '#ffffff'
  g.font = '900 86px "Arial Black", Arial, sans-serif'
  g.fillText('WYNDON STADIUM', W / 2, 128)
  // 副標
  g.fillStyle = '#ffd166'
  g.font = '700 52px Arial, sans-serif'
  g.fillText('⚡ CHAMPION CUP FINAL ⚡', W / 2, 212)

  // 比分帶
  g.fillStyle = '#05070f'
  g.fillRect(40, 252, W - 80, 150)
  g.strokeStyle = '#2b3350'
  g.lineWidth = 3
  g.strokeRect(40, 252, W - 80, 150)
  g.fillStyle = '#f2f2f2'
  g.font = '800 54px Arial, sans-serif'
  g.textAlign = 'left'
  g.fillText(playerName, 76, 330)
  g.textAlign = 'right'
  g.fillText(enemyName, W - 76, 330)
  g.textAlign = 'center'
  g.fillStyle = '#ff2d78'
  g.font = '900 60px Arial, sans-serif'
  g.fillText('VS', W / 2, 334)
  // HP 條
  g.fillStyle = '#233'
  g.fillRect(76, 352, 300, 22)
  g.fillRect(W - 376, 352, 300, 22)
  g.fillStyle = '#3ddc84'
  g.fillRect(76, 352, 300, 22)
  g.fillStyle = '#ff8c42'
  g.fillRect(W - 376, 352, 300 * 0.86, 22)

  // 底帶
  g.fillStyle = '#ff2d78'
  g.fillRect(0, H - 74, W, 74)
  g.fillStyle = '#ffffff'
  g.font = '700 40px Arial, sans-serif'
  g.fillText('GALAR POKÉMON LEAGUE · 宮門體育場', W / 2, H - 24)

  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function Screen({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  // 對戰卡跟著實際出戰者走（PvP 顯示對手玩家的寶可夢，不再寫死）
  const playerName = useBattle((s) => s.playerFighter.nameEn)
  const enemyName = useBattle((s) => s.enemyFighter.nameEn)
  const tex = useMemo(() => makeScreenTexture(playerName, enemyName), [playerName, enemyName])
  return (
    <group position={position} rotation={[0.14, rotationY, 0, 'YXZ']}>
      {/* 外框 */}
      <mesh position={[0, 0, -0.45]}>
        <boxGeometry args={[16.4, 8.6, 0.8]} />
        <meshStandardMaterial color="#0d1017" roughness={0.85} />
      </mesh>
      {/* 螢幕發光面 */}
      <mesh>
        <planeGeometry args={[15.6, 7.8]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* 支柱（向下沒入看台） */}
      <mesh position={[-5.2, -5.6, -0.7]}>
        <boxGeometry args={[0.5, 5, 0.5]} />
        <meshStandardMaterial color="#161a24" roughness={0.9} />
      </mesh>
      <mesh position={[5.2, -5.6, -0.7]}>
        <boxGeometry args={[0.5, 5, 0.5]} />
        <meshStandardMaterial color="#161a24" roughness={0.9} />
      </mesh>
    </group>
  )
}

export default function Jumbotron() {
  return (
    <group>
      {/* 懸掛式大螢幕：吊在南北看台上方，預設跟隨鏡頭（面向 -Z）直接看見北端螢幕 */}
      <Screen position={[0, 9.2, -24.5]} rotationY={0} />
      <Screen position={[0, 9.2, 24.5]} rotationY={Math.PI} />
    </group>
  )
}
