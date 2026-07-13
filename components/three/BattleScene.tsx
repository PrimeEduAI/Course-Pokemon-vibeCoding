'use client'
import { Canvas } from '@react-three/fiber'
import { KeyboardControls, Stats } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { Suspense } from 'react'
import ArenaFloor from './ArenaFloor'
import Player from './Player'
import EnemyFighter from './EnemyFighter'
import Projectiles from './Projectiles'
import FXLayer from './FXLayer'
import GimmickFX from './GimmickFX'
import DamagePopups from './DamagePopups'
import SfxDriver from './SfxDriver'
import Gen8Wyndon from './arenas/Gen8Wyndon'
import Gen1Indigo from './arenas/Gen1Indigo'
import Gen1Field from './arenas/Gen1Field'
import Gen2Silver, { Gen2SilverFloor } from './arenas/Gen2Silver'
import Gen3EverGrande, { Gen3EverGrandeFloor } from './arenas/Gen3EverGrande'
import Gen4LilyValley, { Gen4LilyValleyFloor } from './arenas/Gen4LilyValley'
import Gen5Vertress, { Gen5VertressFloor } from './arenas/Gen5Vertress'
import Gen6Lumiose, { Gen6LumioseFloor } from './arenas/Gen6Lumiose'
import Gen7Manalo, { Gen7ManaloFloor } from './arenas/Gen7Manalo'
import type { ArenaId, FieldType } from './arenas/types'
import type { ComponentType } from 'react'

/** 世代 → 布景/地板 對照（合約：Scenery 無 props；Floor 收 fieldType，碰撞 40×24 頂面 y=0） */
const SCENERY: Record<ArenaId, ComponentType> = {
  gen1: Gen1Indigo, gen2: Gen2Silver, gen3: Gen3EverGrande, gen4: Gen4LilyValley,
  gen5: Gen5Vertress, gen6: Gen6Lumiose, gen7: Gen7Manalo, gen8: Gen8Wyndon,
}
const FLOORS: Record<ArenaId, ComponentType<{ fieldType?: FieldType | null }>> = {
  gen1: ({ fieldType }) => <Gen1Field fieldType={fieldType ?? 'grass'} />,
  gen2: Gen2SilverFloor, gen3: Gen3EverGrandeFloor, gen4: Gen4LilyValleyFloor,
  gen5: Gen5VertressFloor, gen6: Gen6LumioseFloor, gen7: Gen7ManaloFloor,
  gen8: () => <ArenaFloor />,
}

// 同時綁 code 與 key：部分環境的合成鍵盤事件只有 key 沒有 code
const keyMap = [
  // 移動：WASD 為主，方向鍵保留為次要別名
  { name: 'forward', keys: ['KeyW', 'w', 'W', 'ArrowUp'] },
  { name: 'backward', keys: ['KeyS', 's', 'S', 'ArrowDown'] },
  { name: 'left', keys: ['KeyA', 'a', 'A', 'ArrowLeft'] },
  { name: 'right', keys: ['KeyD', 'd', 'D', 'ArrowRight'] },
  // 技能（右手區，左手專心 WASD）：J 近戰 / K 投射 / L 或空白鍵 疾走
  { name: 'attack1', keys: ['KeyJ', 'j', 'J'] },
  { name: 'attack2', keys: ['KeyK', 'k', 'K'] },
  { name: 'dash', keys: ['KeyL', 'l', 'L', 'Space', ' '] },
  // 世代招牌能力（計量滿了才有效）：R 發動 MEGA / 極巨化 / Z 招式 / 羈絆爆發
  { name: 'gimmick', keys: ['KeyR', 'r', 'R'] },
]

interface BattleSceneProps {
  arena: ArenaId
  /** gen1 專用：草/岩/水/冰 */
  fieldType?: FieldType | null
}

export default function BattleScene({ arena, fieldType }: BattleSceneProps) {
  const showStats = typeof window !== 'undefined' && window.location.search.includes('stats')
  const Scenery = SCENERY[arena]
  const Floor = FLOORS[arena]
  return (
    <KeyboardControls map={keyMap}>
      {/* 合成音效駕駛（KO/號角/解鎖 AudioContext），不進 Canvas */}
      <SfxDriver />
      <Canvas shadows camera={{ position: [0, 6, 12], fov: 50 }} dpr={[1, 2]}>
        {showStats && <Stats />}
        <Suspense fallback={null}>
          {/* 世代戰場（天空/光照/看台/布景） */}
          <Scenery />

          <Physics>
            <Floor fieldType={fieldType} />
            <Player />
            {/* 對手：世代 BOSS AI */}
            <EnemyFighter />
          </Physics>

          {/* 戰鬥表現層：彈體 / 打擊特效 / 傷害數字 / 世代招牌能力 */}
          <Projectiles />
          <FXLayer />
          <GimmickFX />
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
