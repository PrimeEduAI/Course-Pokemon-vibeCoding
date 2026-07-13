import { hpPool, MOVES, type MoveDef, type PokeType } from './moves'

export type TypeName = PokeType

export interface BaseStats {
  hp: number
  atk: number
  def: number
  spa: number
  spd: number
  spe: number
}

/** 手工整備的出戰定義：真實種族值 + 兩招（[近戰, 投射]） */
export interface SpeciesDef {
  dexId: number
  nameZh: string
  nameEn: string
  types: TypeName[]
  base: BaseStats
  moves: [MoveDef, MoveDef]
  targetHeight: number
}

/** 戰鬥時解析完成的出戰者（玩家或 BOSS 共用） */
export interface FighterDef {
  dexId: number
  nameZh: string
  nameEn: string
  types: TypeName[]
  level: number
  atk: number
  def: number
  maxHp: number
  moves: [MoveDef, MoveDef]
  targetHeight: number
}

const m = (def: MoveDef) => def

/** 手工招式庫（威力/冷卻以 電光一閃40/0.9s、十萬伏特90/4s 為基準刻度） */
export const SPECIES_MOVES = {
  quickAttack: MOVES.quickAttack,
  thunderbolt: MOVES.thunderbolt,
  firePunch: MOVES.firePunch,
  flamethrower: MOVES.flamethrower,
  swift: m({ id: 'swift', nameZh: '高速星星', nameEn: 'Swift', type: 'normal', power: 60, cooldownMs: 2500, kind: 'projectile', speed: 16, range: 25, color: '#ffd75e', visual: 'stars' }),
  extrasensory: m({ id: 'extrasensory', nameZh: '神通力', nameEn: 'Extrasensory', type: 'psychic', power: 80, cooldownMs: 2400, kind: 'melee', range: 2.8, color: '#ffb3f0' }),
  aeroblast: m({ id: 'aeroblast', nameZh: '氣旋攻擊', nameEn: 'Aeroblast', type: 'flying', power: 100, cooldownMs: 5500, kind: 'projectile', speed: 13, range: 25, color: '#bfe8ff', visual: 'wind' }),
  dragonClaw: m({ id: 'dragonClaw', nameZh: '龍爪', nameEn: 'Dragon Claw', type: 'dragon', power: 80, cooldownMs: 2200, kind: 'melee', range: 2.8, color: '#7ef0c9' }),
  dragonPulse: m({ id: 'dragonPulse', nameZh: '龍之波動', nameEn: 'Dragon Pulse', type: 'dragon', power: 85, cooldownMs: 4500, kind: 'projectile', speed: 12, range: 25, color: '#54e0c0', visual: 'aura' }),
  bulletPunch: m({ id: 'bulletPunch', nameZh: '子彈拳', nameEn: 'Bullet Punch', type: 'steel', power: 40, cooldownMs: 1000, kind: 'melee', range: 2.4, color: '#cdd6e8' }),
  auraSphere: m({ id: 'auraSphere', nameZh: '波導彈', nameEn: 'Aura Sphere', type: 'fighting', power: 80, cooldownMs: 3500, kind: 'projectile', speed: 13, range: 25, color: '#4aa3ff', visual: 'aura' }),
  blueFlare: m({ id: 'blueFlare', nameZh: '青焰', nameEn: 'Blue Flare', type: 'fire', power: 130, cooldownMs: 6500, kind: 'projectile', speed: 11, range: 25, color: '#6ec8ff', visual: 'flame' }),
  suckerPunch: m({ id: 'suckerPunch', nameZh: '瞬猝突襲', nameEn: 'Sucker Punch', type: 'dark', power: 70, cooldownMs: 1800, kind: 'melee', range: 2.6, color: '#8a6bd8' }),
  waterShuriken: m({ id: 'waterShuriken', nameZh: '水手裏劍', nameEn: 'Water Shuriken', type: 'water', power: 60, cooldownMs: 2200, kind: 'projectile', speed: 18, range: 25, color: '#5ad0ff', visual: 'shuriken' }),
  ironHead: m({ id: 'ironHead', nameZh: '鐵頭功', nameEn: 'Iron Head', type: 'steel', power: 80, cooldownMs: 2200, kind: 'melee', range: 2.8, color: '#cdd6e8' }),
  psychicBlast: m({ id: 'psychicBlast', nameZh: '精神強念', nameEn: 'Psychic', type: 'psychic', power: 90, cooldownMs: 4500, kind: 'projectile', speed: 12, range: 25, color: '#e08aff', visual: 'aura' }),
  behemothBlade: m({ id: 'behemothBlade', nameZh: '巨獸斬', nameEn: 'Behemoth Blade', type: 'steel', power: 100, cooldownMs: 2800, kind: 'melee', range: 3.0, color: '#9fd8ff' }),
  moonblast: m({ id: 'moonblast', nameZh: '月亮之力', nameEn: 'Moonblast', type: 'fairy', power: 95, cooldownMs: 4500, kind: 'projectile', speed: 12, range: 25, color: '#ffb3d9', visual: 'moon' }),
} as const satisfies Record<string, MoveDef>

const sm = SPECIES_MOVES

/** 手工出戰名單：玩家預設（皮卡丘/伊布）+ 八大 BOSS */
export const SPECIES: Record<number, SpeciesDef> = {
  25: {
    dexId: 25, nameZh: '皮卡丘', nameEn: 'PIKACHU', types: ['electric'],
    base: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 },
    moves: [sm.quickAttack, sm.thunderbolt], targetHeight: 1.9,
  },
  133: {
    dexId: 133, nameZh: '伊布', nameEn: 'EEVEE', types: ['normal'],
    base: { hp: 55, atk: 55, def: 50, spa: 45, spd: 65, spe: 55 },
    moves: [sm.quickAttack, sm.swift], targetHeight: 1.7,
  },
  6: {
    dexId: 6, nameZh: '噴火龍', nameEn: 'CHARIZARD', types: ['fire', 'flying'],
    base: { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 },
    moves: [sm.firePunch, sm.flamethrower], targetHeight: 2.2,
  },
  249: {
    dexId: 249, nameZh: '洛奇亞', nameEn: 'LUGIA', types: ['psychic', 'flying'],
    base: { hp: 106, atk: 90, def: 130, spa: 90, spd: 154, spe: 110 },
    moves: [sm.extrasensory, sm.aeroblast], targetHeight: 2.6,
  },
  384: {
    dexId: 384, nameZh: '烈空坐', nameEn: 'RAYQUAZA', types: ['dragon', 'flying'],
    base: { hp: 105, atk: 150, def: 90, spa: 150, spd: 90, spe: 95 },
    moves: [sm.dragonClaw, sm.dragonPulse], targetHeight: 2.8,
  },
  448: {
    dexId: 448, nameZh: '路卡利歐', nameEn: 'LUCARIO', types: ['fighting', 'steel'],
    base: { hp: 70, atk: 110, def: 70, spa: 115, spd: 70, spe: 90 },
    moves: [sm.bulletPunch, sm.auraSphere], targetHeight: 2.0,
  },
  643: {
    dexId: 643, nameZh: '雷希拉姆', nameEn: 'RESHIRAM', types: ['dragon', 'fire'],
    base: { hp: 100, atk: 120, def: 100, spa: 150, spd: 120, spe: 90 },
    moves: [sm.dragonClaw, sm.blueFlare], targetHeight: 2.7,
  },
  658: {
    dexId: 658, nameZh: '甲賀忍蛙', nameEn: 'GRENINJA', types: ['water', 'dark'],
    base: { hp: 72, atk: 95, def: 67, spa: 103, spd: 71, spe: 122 },
    moves: [sm.suckerPunch, sm.waterShuriken], targetHeight: 2.0,
  },
  791: {
    dexId: 791, nameZh: '索爾迦雷歐', nameEn: 'SOLGALEO', types: ['psychic', 'steel'],
    base: { hp: 137, atk: 137, def: 107, spa: 113, spd: 89, spe: 97 },
    moves: [sm.ironHead, sm.psychicBlast], targetHeight: 2.6,
  },
  888: {
    dexId: 888, nameZh: '蒼響', nameEn: 'ZACIAN', types: ['fairy', 'steel'],
    base: { hp: 92, atk: 130, def: 115, spa: 80, spd: 115, spe: 138 },
    moves: [sm.behemothBlade, sm.moonblast], targetHeight: 2.4,
  },
}

export function getSpecies(dexId: number): SpeciesDef | null {
  return SPECIES[dexId] ?? null
}

/** SpeciesDef → 戰鬥用 FighterDef（Lv50、物攻/物防、HP 池） */
export function toFighter(s: SpeciesDef, hpScale = 1): FighterDef {
  return {
    dexId: s.dexId,
    nameZh: s.nameZh,
    nameEn: s.nameEn,
    types: s.types,
    level: 50,
    atk: s.base.atk,
    def: s.base.def,
    maxHp: Math.round(hpPool(s.base.hp) * hpScale),
    moves: s.moves,
    targetHeight: s.targetHeight,
  }
}

/** 屬性中文標籤（選角 UI 徽章用） */
export const TYPE_ZH: Record<TypeName, string> = {
  normal: '一般', fire: '火', water: '水', electric: '電', grass: '草', ice: '冰',
  fighting: '格鬥', poison: '毒', ground: '地面', flying: '飛行', psychic: '超能力', bug: '蟲',
  rock: '岩石', ghost: '幽靈', dragon: '龍', dark: '惡', steel: '鋼', fairy: '妖精',
}

/** 屬性代表色（官方風格） */
export const TYPE_COLOR: Record<TypeName, string> = {
  normal: '#a8a878', fire: '#f08030', water: '#6890f0', electric: '#f8d030', grass: '#78c850', ice: '#98d8d8',
  fighting: '#c03028', poison: '#a040a0', ground: '#e0c068', flying: '#a890f0', psychic: '#f85888', bug: '#a8b820',
  rock: '#b8a038', ghost: '#705898', dragon: '#7038f8', dark: '#705848', steel: '#b8b8d0', fairy: '#ee99ac',
}

export const ALL_TYPES = Object.keys(TYPE_ZH) as TypeName[]

export function isTypeName(t: string): t is TypeName {
  return t in TYPE_ZH
}
