'use client'
import { Canvas } from '@react-three/fiber'
import { Environment, KeyboardControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { Suspense } from 'react'
import ArenaFloor from './ArenaFloor'
import Player from './Player'

const keyMap = [
  { name: 'forward', keys: ['ArrowUp'] },
  { name: 'backward', keys: ['ArrowDown'] },
  { name: 'left', keys: ['ArrowLeft'] },
  { name: 'right', keys: ['ArrowRight'] },
]

export default function BattleScene() {
  return (
    <KeyboardControls map={keyMap}>
      <Canvas shadows camera={{ position: [0, 6, 12], fov: 50 }}>
        <Suspense fallback={null}>
          <Environment files="/assets/hdri/venice_sunset_2k.hdr" background />
          <directionalLight position={[16, 24, 12]} intensity={1.2} castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-22} shadow-camera-right={22}
            shadow-camera-top={14} shadow-camera-bottom={-14}
            shadow-camera-far={40} />
          <ambientLight intensity={0.3} />
          <Physics>
            <ArenaFloor />
            <Player dexId={25} />
          </Physics>
        </Suspense>
      </Canvas>
    </KeyboardControls>
  )
}
