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
          <directionalLight position={[8, 12, 6]} intensity={1.2} castShadow />
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
