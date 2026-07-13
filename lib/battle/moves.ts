import type { StatusKind } from './status'

export type MoveKind = 'melee' | 'projectile'

/** 投射視覺樣式 ID：components/three/moveVisuals 註冊表的鍵（每招專屬外觀）
 *  後五個為控制技（status）視覺家族：slow / root / stun / burn / weaken 各一 */
export const MOVE_VISUAL_IDS = [
  'bolt', 'stars', 'flame', 'wind', 'shuriken', 'aura', 'moon', 'beam', 'rock',
  'ringwave', 'iceshard', 'concussion', 'flamelet', 'darkpulse',
] as const
export type MoveVisualId = (typeof MOVE_VISUAL_IDS)[number]

/** 狀態種類 → 控制技視覺樣式（黃色環波 / 冰晶 / 震盪環 / 藍白鬼火 / 暗影脈衝） */
export const STATUS_VISUAL: Record<StatusKind, MoveVisualId> = {
  slow: 'ringwave',
  root: 'iceshard',
  stun: 'concussion',
  burn: 'flamelet',
  weaken: 'darkpulse',
}

/** 控制技（moves[2]，U 鍵）共用刻度：小傷害 + 長冷卻，價值在附帶狀態 */
export const CONTROL_POWER = 18
export const CONTROL_COOLDOWN_MS = 8500

/** 完整 18 屬性 */
export type PokeType =
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice'
  | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic' | 'bug'
  | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy'

export type TypeName = PokeType

export interface MoveDef {
  id: string
  nameZh: string
  nameEn: string
  type: PokeType
  power: number
  cooldownMs: number
  kind: MoveKind
  /** projectile 飛行速度 m/s */
  speed?: number
  /** melee 有效距離 / projectile 最大射程 */
  range?: number
  /** 彈體 / 特效主色 */
  color: string
  /** projectile 專屬視覺樣式（未指定時退回 beam） */
  visual?: MoveVisualId
  /** 控制技：命中時對目標施加的狀態（lib/battle/status.ts） */
  status?: StatusKind
}

/** 舊出戰組合的招式表（皮卡丘 / 噴火龍），現由 species.ts 資料驅動；保留供測試與平衡基準 */
export const MOVES = {
  quickAttack: {
    id: 'quickAttack',
    nameZh: '電光一閃',
    nameEn: 'Quick Attack',
    type: 'normal',
    power: 40,
    cooldownMs: 900,
    kind: 'melee',
    range: 2.2,
    color: '#c8f6ff',
  },
  thunderbolt: {
    id: 'thunderbolt',
    nameZh: '十萬伏特',
    nameEn: 'Thunderbolt',
    type: 'electric',
    power: 90,
    cooldownMs: 4000,
    kind: 'projectile',
    speed: 14,
    range: 25,
    color: '#ffe95c',
    visual: 'bolt',
  },
  firePunch: {
    id: 'firePunch',
    nameZh: '火焰拳',
    nameEn: 'Fire Punch',
    type: 'fire',
    power: 75,
    cooldownMs: 2200,
    kind: 'melee',
    range: 2.6,
    color: '#ff8a3d',
  },
  flamethrower: {
    id: 'flamethrower',
    nameZh: '噴射火焰',
    nameEn: 'Flamethrower',
    type: 'fire',
    power: 90,
    cooldownMs: 5000,
    kind: 'projectile',
    speed: 11,
    range: 25,
    color: '#ff8a3d',
    visual: 'flame',
  },
} as const satisfies Record<string, MoveDef>

export type MoveId = keyof typeof MOVES

export interface FighterStats {
  level: number
  atk: number
  def: number
  maxHp: number
  types: PokeType[]
}

/** HP 池 = 種族值*2 + 110（Lv50 簡化） */
export const hpPool = (baseHp: number) => baseHp * 2 + 110

/** 招式屬性與使用者屬性相同 → STAB 1.5x */
export const hasStab = (move: MoveDef, attacker: { types: readonly PokeType[] }) => attacker.types.includes(move.type)
