import type { MoveDef, PokeType } from './moves'

/** 收藏寶可夢（無手工整備）的通用近戰：撞擊 */
export const GENERIC_MELEE: MoveDef = {
  id: 'tackle', nameZh: '撞擊', nameEn: 'Tackle', type: 'normal',
  power: 50, cooldownMs: 1200, kind: 'melee', range: 2.4, color: '#e8ecff',
}

const proj = (id: string, nameZh: string, nameEn: string, type: PokeType, power: number, cooldownMs: number, color: string, speed = 12): MoveDef =>
  ({ id, nameZh, nameEn, type, power, cooldownMs, kind: 'projectile', speed, range: 25, color })

/** 屬性 → 招牌投射技（威力/冷卻對齊 十萬伏特 90/4s 刻度；顏色跟屬性走） */
export const TYPE_MOVE: Record<PokeType, MoveDef> = {
  fire: proj('gFlamethrower', '噴射火焰', 'Flamethrower', 'fire', 90, 5000, '#ff8a3d', 11),
  water: proj('gHydroPump', '水炮', 'Hydro Pump', 'water', 110, 5500, '#4aa3ff', 13),
  electric: proj('gThunderbolt', '十萬伏特', 'Thunderbolt', 'electric', 90, 4000, '#ffe95c', 14),
  grass: proj('gEnergyBall', '能量球', 'Energy Ball', 'grass', 90, 4500, '#7ee06b'),
  ice: proj('gIceBeam', '冰凍光束', 'Ice Beam', 'ice', 90, 4500, '#bfe8ff', 14),
  psychic: proj('gPsychic', '精神強念', 'Psychic', 'psychic', 90, 4500, '#e08aff'),
  dark: proj('gDarkPulse', '惡之波動', 'Dark Pulse', 'dark', 80, 4000, '#8a6bd8'),
  fairy: proj('gMoonblast', '月亮之力', 'Moonblast', 'fairy', 95, 4500, '#ffb3d9'),
  dragon: proj('gDragonPulse', '龍之波動', 'Dragon Pulse', 'dragon', 85, 4500, '#54e0c0'),
  fighting: proj('gAuraSphere', '波導彈', 'Aura Sphere', 'fighting', 80, 3500, '#4aa3ff', 13),
  ground: proj('gEarthPower', '大地之力', 'Earth Power', 'ground', 90, 4500, '#d09a5a'),
  rock: proj('gPowerGem', '力量寶石', 'Power Gem', 'rock', 80, 4000, '#ffb85c'),
  steel: proj('gFlashCannon', '加農光炮', 'Flash Cannon', 'steel', 80, 4000, '#cdd6e8', 14),
  bug: proj('gBugBuzz', '蟲鳴', 'Bug Buzz', 'bug', 90, 4500, '#b6d84a'),
  ghost: proj('gShadowBall', '暗影球', 'Shadow Ball', 'ghost', 80, 4000, '#9a70d8'),
  poison: proj('gSludgeBomb', '污泥炸彈', 'Sludge Bomb', 'poison', 90, 4500, '#c060d8', 11),
  flying: proj('gAirSlash', '空氣斬', 'Air Slash', 'flying', 75, 3500, '#bfe8ff', 15),
  normal: proj('gSwift', '高速星星', 'Swift', 'normal', 60, 2500, '#ffd75e', 16),
}

/**
 * 任意收藏寶可夢的招式組合：近戰 = 撞擊、投射 = 第一屬性的招牌技。
 * 空屬性（快取缺漏）退回一般屬性。
 */
export function buildGenericMoves(types: readonly PokeType[]): [MoveDef, MoveDef] {
  const primary = types[0]
  return [GENERIC_MELEE, (primary && TYPE_MOVE[primary]) || TYPE_MOVE.normal]
}
