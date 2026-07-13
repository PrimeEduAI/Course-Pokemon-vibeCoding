import type { MoveDef } from './moves'

/**
 * 簡化官方形狀傷害公式：
 * floor(((2*level/5+2) * power * atk / def) / 50 + 2) * stab * typeMult * random(0.85–1.0)
 * rng: 注入的 0–1 亂數（rng()=1 → 傷害上限，便於測試）
 */
export function computeDamage(
  move: MoveDef,
  attacker: { level: number; atk: number },
  defender: { def: number },
  stab: boolean,
  typeMult: number,
  rng: () => number = Math.random,
): number {
  const base = Math.floor(((2 * attacker.level / 5 + 2) * move.power * attacker.atk / defender.def) / 50 + 2)
  const roll = 0.85 + 0.15 * rng()
  return Math.max(1, Math.floor(base * (stab ? 1.5 : 1) * typeMult * roll))
}
