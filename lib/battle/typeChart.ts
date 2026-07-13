import type { PokeType } from './moves'

/** 最小屬性相剋表：只涵蓋本場對戰會出現的攻防組合，缺項 = 1x */
const CHART: Partial<Record<PokeType, Partial<Record<PokeType, number>>>> = {
  electric: { flying: 2, electric: 0.5, grass: 0.5 },
  fire: { fire: 0.5, grass: 2, water: 0.5 },
  normal: {},
}

/** 攻擊屬性對（複合）防禦屬性的總倍率：各項連乘 */
export function getTypeMult(moveType: PokeType, defenderTypes: readonly PokeType[]): number {
  let mult = 1
  for (const t of defenderTypes) mult *= CHART[moveType]?.[t] ?? 1
  return mult
}
