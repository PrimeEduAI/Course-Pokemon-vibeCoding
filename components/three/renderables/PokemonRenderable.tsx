'use client'
import { Component, type ReactNode } from 'react'
import PokemonModel, { type ModelForm } from '../PokemonModel'
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
  /** 世代招牌能力的模型換裝（MEGA / 超極巨化）；載入失敗自動退回 regular */
  form?: ModelForm
  /** 體型倍率（極巨化 2.3× 等）；billboard 與 3D 模型都吃 */
  scaleMult?: number
}

/** 點陣 sprite 貼圖留白偏多，略放大才有量感 */
const PIXEL_SCALE = 1.15
const ANI_SCALE = 1.1

/** mega / gmax GLB 載入失敗（缺檔 / 解析錯誤）→ 退回 regular，不打斷戰鬥 */
class FormFallbackBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/**
 * 畫風切換的唯一入口：modern → 3D GLB、pixel → 世代點陣、animated → B/W GIF。
 * 移動 / AI / 戰鬥邏輯完全不經過這裡 —— 只換「模型層」。
 */
export default function PokemonRenderable({ dexId, mode, facing, targetHeight, arenaGen, entity, motion, form = 'regular', scaleMult = 1 }: PokemonRenderableProps) {
  const name = spriteNameForDex(dexId)
  const artworkUrl = `/assets/artwork/${dexId}.png`
  const height = targetHeight * scaleMult

  if (mode === 'modern' || !name) {
    const regular = <PokemonModel dexId={dexId} targetHeight={height} entity={entity} motion={motion} />
    if (form === 'regular') return regular
    return (
      <FormFallbackBoundary key={form} fallback={regular}>
        <PokemonModel dexId={dexId} targetHeight={height} entity={entity} motion={motion} form={form} />
      </FormFallbackBoundary>
    )
  }

  if (mode === 'pixel') {
    const set = spriteSetForGen(arenaGen)
    return (
      <SpriteBillboard
        sources={[
          { url: `/assets/sprites/${set}/${name}.png`, pixelated: true },
          { url: artworkUrl, pixelated: false },
        ]}
        targetHeight={height}
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
      targetHeight={height}
      heightScale={ANI_SCALE}
      entity={entity}
    />
  )
}
