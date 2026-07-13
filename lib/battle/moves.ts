export type MoveKind = 'melee' | 'projectile'
export type PokeType = 'normal' | 'electric' | 'fire' | 'flying' | 'water' | 'grass'

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
}

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

/** 皮卡丘：HP35 攻55 防40（電） */
export const PIKACHU: FighterStats = { level: 50, atk: 55, def: 40, maxHp: hpPool(35), types: ['electric'] }
/** 噴火龍：HP78 攻84 防78（火/飛行） */
export const CHARIZARD: FighterStats = { level: 50, atk: 84, def: 78, maxHp: hpPool(78), types: ['fire', 'flying'] }

/** 招式屬性與使用者屬性相同 → STAB 1.5x */
export const hasStab = (move: MoveDef, attacker: FighterStats) => attacker.types.includes(move.type)
