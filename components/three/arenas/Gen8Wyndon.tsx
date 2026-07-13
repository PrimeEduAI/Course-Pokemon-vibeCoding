'use client'
import { Environment, Stars } from '@react-three/drei'
import Stadium from '../Stadium'
import Floodlights from '../Floodlights'
import Jumbotron from '../Jumbotron'
import AdBoards from '../AdBoards'
import LaserShow from '../LaserShow'

/**
 * Gen 8 宮門體育場（伽勒爾）：夜空 + 泛光燈 + 大螢幕 + LED 廣告板 + 雷射秀。
 * 內容 1:1 搬自原 BattleScene 的場館組合，無視覺變更。
 */
export default function Gen8Wyndon() {
  return (
    <>
      {/* 夜空 */}
      <color attach="background" args={['#05070f']} />
      <fog attach="fog" args={['#05070f', 70, 210]} />
      <Stars radius={280} depth={60} count={3500} factor={5} saturation={0} fade speed={0.5} />
      {/* 只做反射用的夜景 IBL，不當背景 */}
      <Environment files="/assets/hdri/shanghai_bund_2k.hdr" environmentIntensity={0.3} />

      {/* 主光：模擬泛光燈的冷白頂光（唯一投影光源） */}
      <directionalLight
        position={[18, 32, 12]}
        intensity={1.3}
        color="#dfe8ff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-far={70}
        shadow-bias={-0.0004}
      />
      <hemisphereLight args={['#222c52', '#0a0c12', 0.4]} />
      <ambientLight intensity={0.1} color="#5a6cc0" />

      <Stadium />
      <Floodlights />
      <Jumbotron />
      <AdBoards />
      <LaserShow />
    </>
  )
}
