'use client'
import { Canvas } from '@react-three/fiber'
import { KeyboardControls, Stats } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { Suspense } from 'react'
import ArenaFloor from './ArenaFloor'
import Player from './Player'
import EnemyCharizard from './EnemyCharizard'
import Projectiles from './Projectiles'
import FXLayer from './FXLayer'
import DamagePopups from './DamagePopups'
import Gen8Wyndon from './arenas/Gen8Wyndon'
import Gen1Indigo from './arenas/Gen1Indigo'
import Gen1Field from './arenas/Gen1Field'
import type { ArenaId, FieldType } from './arenas/types'

const keyMap = [
  { name: 'forward', keys: ['ArrowUp'] },
  { name: 'backward', keys: ['ArrowDown'] },
  { name: 'left', keys: ['ArrowLeft'] },
  { name: 'right', keys: ['ArrowRight'] },
  // 同時綁 code 與 key：部分環境的合成鍵盤事件只有 key 沒有 code
  { name: 'attack1', keys: ['KeyZ', 'z', 'Z'] },
  { name: 'attack2', keys: ['KeyX', 'x', 'X'] },
  { name: 'dash', keys: ['KeyC', 'c', 'C'] },
]

interface BattleSceneProps {
  arena: ArenaId
  /** gen1 專用：草/岩/水/冰 */
  fieldType?: FieldType | null
}

export default function BattleScene({ arena, fieldType }: BattleSceneProps) {
  const showStats = typeof window !== 'undefined' && window.location.search.includes('stats')
  return (
    <KeyboardControls map={keyMap}>
      <Canvas shadows camera={{ position: [0, 6, 12], fov: 50 }} dpr={[1, 2]}>
        {showStats && <Stats />}
        <Suspense fallback={null}>
          {/* 世代戰場（天空/光照/看台/布景） */}
          {arena === 'gen1' ? <Gen1Indigo /> : <Gen8Wyndon />}

          <Physics>
            {arena === 'gen1' ? <Gen1Field fieldType={fieldType ?? 'grass'} /> : <ArenaFloor />}
            <Player dexId={25} />
            {/* 對手：噴火龍 AI */}
            <EnemyCharizard />
          </Physics>

          {/* 戰鬥表現層：彈體 / 打擊特效 / 傷害數字 */}
          <Projectiles />
          <FXLayer />
          <DamagePopups />

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
