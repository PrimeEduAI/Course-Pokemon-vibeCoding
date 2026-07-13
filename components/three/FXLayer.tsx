'use client'
import { useBattle } from '@/stores/useBattle'
import { ImpactFxRenderer, SlashFxRenderer } from './moveVisuals'

/**
 * 打擊特效層：命中爆閃 / 近戰斬擊，全部依 fx.variant 分派到 moveVisuals 註冊表
 * （burst.variant = MoveVisualId、slash.variant = SlashVariant；未指定走通用外觀）。
 */
export default function FXLayer() {
  const fx = useBattle((s) => s.fx)
  return (
    <>
      {fx.map((f) => (f.kind === 'slash' ? <SlashFxRenderer key={f.id} fx={f} /> : <ImpactFxRenderer key={f.id} fx={f} />))}
    </>
  )
}
