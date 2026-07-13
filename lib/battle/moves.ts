export type MoveKind = 'melee' | 'projectile'

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
