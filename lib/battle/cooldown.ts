/** 冷卻檢查：lastFiredAt=0 視為從未施放 */
export function canFire(lastFiredAt: number, cooldownMs: number, now: number): boolean {
  return now - lastFiredAt >= cooldownMs
}

/** 冷卻進度 0（剛施放）→ 1（可再施放），供 HUD 掃描動畫用 */
export function cooldownProgress(lastFiredAt: number, cooldownMs: number, now: number): number {
  if (cooldownMs <= 0) return 1
  return Math.min(1, Math.max(0, (now - lastFiredAt) / cooldownMs))
}
