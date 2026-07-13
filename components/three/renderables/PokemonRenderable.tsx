'use client'
import PokemonModel from '../PokemonModel'
import SpriteBillboard from './SpriteBillboard'
import AnimatedSpriteBillboard from './AnimatedSpriteBillboard'
import { spriteNameForDex, spriteSetForGen } from '@/lib/dex-names'
import type { StyleMode } from '@/stores/useStyleMode'
import type { MotionChannel } from '@/stores/battleWorld'

export interface PokemonRenderableProps {
  dexId: number
  mode: StyleMode
  /** 'back' = 我方（B/W 背面視角）、'front' = 敵方 */
  facing: 'front' | 'back'
  targetHeight: number
  /** 戰場世代：點陣模式跟著年代選 sprite 套組（gen1–4 → 當代圖，其餘 gen5） */
  arenaGen?: number
  entity?: 'player' | 'enemy'
  /** 骨骼動畫指令頻道：只有 3D（modern）模式的 PokemonModel 會用，billboard 忽略 */
  motion?: MotionChannel
}

/** 點陣 sprite 貼圖留白偏多，略放大才有量感 */
const PIXEL_SCALE = 1.15
const ANI_SCALE = 1.1

/**
 * 畫風切換的唯一入口：modern → 3D GLB、pixel → 世代點陣、animated → B/W GIF。
 * 移動 / AI / 戰鬥邏輯完全不經過這裡 —— 只換「模型層」。
 */
export default function PokemonRenderable({ dexId, mode, facing, targetHeight, arenaGen, entity, motion }: PokemonRenderableProps) {
  const name = spriteNameForDex(dexId)
  const artworkUrl = `/assets/artwork/${dexId}.png`

  if (mode === 'modern' || !name) {
    return <PokemonModel dexId={dexId} targetHeight={targetHeight} entity={entity} motion={motion} />
  }

  if (mode === 'pixel') {
    const set = spriteSetForGen(arenaGen)
    return (
      <SpriteBillboard
        sources={[
          { url: `/assets/sprites/${set}/${name}.png`, pixelated: true },
          { url: artworkUrl, pixelated: false },
        ]}
        targetHeight={targetHeight}
        heightScale={PIXEL_SCALE}
        entity={entity}
      />
    )
  }

  // animated：我方背面 / 敵方正面（正宗 B/W 對戰取景）；gen5ani 缺圖退新世代 ani
  const dirs = facing === 'back' ? ['gen5ani-back', 'ani-back'] : ['gen5ani', 'ani']
  return (
    <AnimatedSpriteBillboard
      urls={dirs.map((d) => `/assets/sprites/${d}/${name}.gif`)}
      artworkUrl={artworkUrl}
      targetHeight={targetHeight}
      heightScale={ANI_SCALE}
      entity={entity}
    />
  )
}
