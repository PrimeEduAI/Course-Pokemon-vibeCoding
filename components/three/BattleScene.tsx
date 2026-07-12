'use client'
import { Canvas } from '@react-three/fiber'
import { Environment, KeyboardControls, Stars, Stats } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { Suspense } from 'react'
import ArenaFloor from './ArenaFloor'
import Player from './Player'
import PokemonModel from './PokemonModel'
import Stadium from './Stadium'
import Floodlights from './Floodlights'
import Jumbotron from './Jumbotron'
import AdBoards from './AdBoards'
import LaserShow from './LaserShow'

const keyMap = [
  { name: 'forward', keys: ['ArrowUp'] },
  { name: 'backward', keys: ['ArrowDown'] },
  { name: 'left', keys: ['ArrowLeft'] },
  { name: 'right', keys: ['ArrowRight'] },
]

export default function BattleScene() {
  const showStats = typeof window !== 'undefined' && window.location.search.includes('stats')
  return (
    <KeyboardControls map={keyMap}>
      <Canvas shadows camera={{ position: [0, 6, 12], fov: 50 }} dpr={[1, 2]}>
        {/* 夜空 */}
        {showStats && <Stats />}
        <color attach="background" args={['#05070f']} />
        <fog attach="fog" args={['#05070f', 70, 210]} />
        <Suspense fallback={null}>
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

          <Physics>
            <ArenaFloor />
            <Player dexId={25} />
          </Physics>

          {/* 對手：噴火龍，面向玩家出生點 */}
          <group position={[0, 0, -6.5]}>
            <PokemonModel dexId={6} targetHeight={1.7} />
          </group>

          <Stadium />
          <Floodlights />
          <Jumbotron />
          <AdBoards />
          <LaserShow />

          <EffectComposer>
            <Bloom mipmapBlur intensity={0.65} luminanceThreshold={0.78} luminanceSmoothing={0.2} />
            <Vignette eskil={false} offset={0.18} darkness={0.72} />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </KeyboardControls>
  )
}
