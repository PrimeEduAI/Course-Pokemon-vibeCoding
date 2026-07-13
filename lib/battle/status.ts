/**
 * 控制技能狀態系統（純函式，無 DOM / three 相依，可直接 bun test）。
 * 五種狀態：slow（麻痺減速）、root（禁錮定身）、stun（震懾封招）、
 * burn（灼傷 DoT）、weaken（弱化減攻）。
 * 效果清單（StatusEffect[]）由 useBattle 每邊各持一份；重複施加＝刷新持續時間。
 */

export type StatusKind = 'slow' | 'root' | 'stun' | 'burn' | 'weaken'

export interface StatusEffect {
  kind: StatusKind
  appliedAt: number
  expiresAt: number
  /** burn 專用：上次 DoT 結算時間（其餘狀態 = appliedAt，不使用） */
  lastTickAt: number
}

export interface StatusDefMeta {
  nameZh: string
  durationMs: number
  /** HUD 徽章 / 粒子主色 */
  color: string
  /** HUD 徽章單字 */
  glyph: string
}

export const STATUS_META: Record<StatusKind, StatusDefMeta> = {
  slow: { nameZh: '麻痺', durationMs: 3500, color: '#ffe95c', glyph: '麻' },
  root: { nameZh: '禁錮', durationMs: 1400, color: '#9fdcff', glyph: '縛' },
  stun: { nameZh: '震懾', durationMs: 850, color: '#ffd75e', glyph: '暈' },
  burn: { nameZh: '灼傷', durationMs: 4000, color: '#ff7a3d', glyph: '灼' },
  weaken: { nameZh: '弱化', durationMs: 5000, color: '#b48ae8', glyph: '弱' },
}

/** slow：移動速度倍率 */
export const SLOW_SPEED_MULT = 0.55
/** weaken：輸出傷害倍率 */
export const WEAKEN_ATK_MULT = 0.72
/** burn：每秒燒 maxHp 的比例 */
export const BURN_HP_PCT_PER_S = 0.03
/** burn：DoT 結算間隔 */
export const BURN_TICK_MS = 500

/** kind 在 now 當下是否生效 */
export function hasStatus(effects: readonly StatusEffect[], kind: StatusKind, now: number): boolean {
  return effects.some((e) => e.kind === kind && now < e.expiresAt)
}

/** 施加狀態：同種重複施加＝刷新持續時間（移除舊的、押新的） */
export function applyStatus(effects: readonly StatusEffect[], kind: StatusKind, now: number): StatusEffect[] {
  const next = effects.filter((e) => e.kind !== kind && now < e.expiresAt)
  next.push({ kind, appliedAt: now, expiresAt: now + STATUS_META[kind].durationMs, lastTickAt: now })
  return next
}

/** 清掉已過期的效果；全部仍有效時回傳原陣列（省 React set 抖動） */
export function pruneStatuses(effects: readonly StatusEffect[], now: number): readonly StatusEffect[] {
  return effects.every((e) => now < e.expiresAt) ? effects : effects.filter((e) => now < e.expiresAt)
}

/** 不能移動：root（可攻擊）或 stun（全鎖） */
export function isMoveLocked(effects: readonly StatusEffect[], now: number): boolean {
  return hasStatus(effects, 'root', now) || hasStatus(effects, 'stun', now)
}

/** 不能出招（含疾走）：只有 stun */
export function isActionLocked(effects: readonly StatusEffect[], now: number): boolean {
  return hasStatus(effects, 'stun', now)
}

/** 移動速度倍率（slow 生效 → 0.55） */
export function speedMult(effects: readonly StatusEffect[], now: number): number {
  return hasStatus(effects, 'slow', now) ? SLOW_SPEED_MULT : 1
}

/** 輸出傷害倍率（weaken 生效 → 0.72） */
export function atkMult(effects: readonly StatusEffect[], now: number): number {
  return hasStatus(effects, 'weaken', now) ? WEAKEN_ATK_MULT : 1
}

/**
 * 灼傷 DoT 結算：從 lastTickAt 起每滿 BURN_TICK_MS 燒一跳
 * （每跳 = maxHp × 3%/s × 0.5s），跳數截止於 expiresAt。
 * 無到期跳數時回傳 damage 0 且 effects 為原陣列。
 */
export function tickBurn(effects: readonly StatusEffect[], now: number, maxHp: number): { damage: number; effects: readonly StatusEffect[] } {
  const burn = effects.find((e) => e.kind === 'burn')
  if (!burn) return { damage: 0, effects }
  const until = Math.min(now, burn.expiresAt)
  const ticks = Math.floor((until - burn.lastTickAt) / BURN_TICK_MS)
  if (ticks <= 0) return { damage: 0, effects }
  const perTick = maxHp * BURN_HP_PCT_PER_S * (BURN_TICK_MS / 1000)
  const damage = Math.max(1, Math.round(ticks * perTick))
  const next = effects.map((e) => (e === burn ? { ...e, lastTickAt: e.lastTickAt + ticks * BURN_TICK_MS } : e))
  return { damage, effects: next }
}

/** HUD / 模型染色用：目前生效中的效果（依剩餘時間短→長排序無必要，維持施加順序） */
export function activeStatuses(effects: readonly StatusEffect[], now: number): StatusEffect[] {
  return effects.filter((e) => now < e.expiresAt)
}
