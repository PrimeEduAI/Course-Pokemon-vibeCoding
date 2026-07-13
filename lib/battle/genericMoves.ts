import { CONTROL_COOLDOWN_MS, CONTROL_POWER, STATUS_VISUAL, type MoveDef, type MoveVisualId, type PokeType } from './moves'
import type { StatusKind } from './status'

/** 收藏寶可夢（無手工整備）的通用近戰：撞擊 */
export const GENERIC_MELEE: MoveDef = {
  id: 'tackle', nameZh: '撞擊', nameEn: 'Tackle', type: 'normal',
  power: 50, cooldownMs: 1200, kind: 'melee', range: 2.4, color: '#e8ecff',
}

const proj = (id: string, nameZh: string, nameEn: string, type: PokeType, power: number, cooldownMs: number, color: string, visual: MoveVisualId, speed = 12): MoveDef =>
  ({ id, nameZh, nameEn, type, power, cooldownMs, kind: 'projectile', speed, range: 25, color, visual })

/** 屬性 → 招牌投射技（威力/冷卻對齊 十萬伏特 90/4s 刻度；顏色/視覺樣式跟屬性走） */
export const TYPE_MOVE: Record<PokeType, MoveDef> = {
  fire: proj('gFlamethrower', '噴射火焰', 'Flamethrower', 'fire', 90, 5000, '#ff8a3d', 'flame', 11),
  water: proj('gHydroPump', '水炮', 'Hydro Pump', 'water', 110, 5500, '#4aa3ff', 'beam', 13),
  electric: proj('gThunderbolt', '十萬伏特', 'Thunderbolt', 'electric', 90, 4000, '#ffe95c', 'bolt', 14),
  grass: proj('gEnergyBall', '能量球', 'Energy Ball', 'grass', 90, 4500, '#7ee06b', 'aura'),
  ice: proj('gIceBeam', '冰凍光束', 'Ice Beam', 'ice', 90, 4500, '#bfe8ff', 'beam', 14),
  psychic: proj('gPsychic', '精神強念', 'Psychic', 'psychic', 90, 4500, '#e08aff', 'aura'),
  dark: proj('gDarkPulse', '惡之波動', 'Dark Pulse', 'dark', 80, 4000, '#8a6bd8', 'aura'),
  fairy: proj('gMoonblast', '月亮之力', 'Moonblast', 'fairy', 95, 4500, '#ffb3d9', 'moon'),
  dragon: proj('gDragonPulse', '龍之波動', 'Dragon Pulse', 'dragon', 85, 4500, '#54e0c0', 'aura'),
  fighting: proj('gAuraSphere', '波導彈', 'Aura Sphere', 'fighting', 80, 3500, '#4aa3ff', 'aura', 13),
  ground: proj('gEarthPower', '大地之力', 'Earth Power', 'ground', 90, 4500, '#d09a5a', 'beam'),
  rock: proj('gPowerGem', '力量寶石', 'Power Gem', 'rock', 80, 4000, '#ffb85c', 'rock'),
  steel: proj('gFlashCannon', '加農光炮', 'Flash Cannon', 'steel', 80, 4000, '#cdd6e8', 'beam', 14),
  bug: proj('gBugBuzz', '蟲鳴', 'Bug Buzz', 'bug', 90, 4500, '#b6d84a', 'aura'),
  ghost: proj('gShadowBall', '暗影球', 'Shadow Ball', 'ghost', 80, 4000, '#9a70d8', 'aura'),
  poison: proj('gSludgeBomb', '污泥炸彈', 'Sludge Bomb', 'poison', 90, 4500, '#c060d8', 'aura', 11),
  flying: proj('gAirSlash', '空氣斬', 'Air Slash', 'flying', 75, 3500, '#bfe8ff', 'wind', 15),
  normal: proj('gSwift', '高速星星', 'Swift', 'normal', 60, 2500, '#ffd75e', 'stars', 16),
}

const ctrl = (id: string, nameZh: string, nameEn: string, type: PokeType, status: StatusKind, color: string): MoveDef =>
  ({ id, nameZh, nameEn, type, status, power: CONTROL_POWER, cooldownMs: CONTROL_COOLDOWN_MS, kind: 'projectile', speed: 14, range: 25, color, visual: STATUS_VISUAL[status] })

/** 通用控制技庫（依第一屬性分派；名稱走屬性風味） */
const CTRL_THUNDER_WAVE = ctrl('cThunderWave', '電磁波', 'Thunder Wave', 'electric', 'slow', '#ffe95c')
const CTRL_FREEZE = ctrl('cFreeze', '凍結', 'Freeze', 'ice', 'root', '#9fdcff')
const CTRL_WILL_O_WISP = ctrl('cWillOWisp', '鬼火', 'Will-O-Wisp', 'fire', 'burn', '#8ad4ff')
const CTRL_CONCUSS = ctrl('cConcuss', '震懾', 'Concussion', 'fighting', 'stun', '#ffd75e')
const CTRL_TERRIFY = ctrl('cTerrify', '怖嚇', 'Terrify', 'ghost', 'weaken', '#9a70d8')
const CTRL_CHARM = ctrl('cCharm', '魅惑', 'Charm', 'fairy', 'weaken', '#ffb3d9')
const CTRL_INTIMIDATE = ctrl('cIntimidate', '威嚇', 'Intimidate', 'normal', 'weaken', '#c9b8e8')

/** 屬性 → 控制技（electric→麻痺、水/冰→凍結、火→灼傷、硬派系→震懾、靈系→怖嚇、妖精→魅惑、其餘→威嚇） */
export function controlMoveForType(primary: PokeType | undefined): MoveDef {
  switch (primary) {
    case 'electric': return CTRL_THUNDER_WAVE
    case 'water': case 'ice': return CTRL_FREEZE
    case 'fire': return CTRL_WILL_O_WISP
    case 'fighting': case 'steel': case 'rock': case 'ground': return CTRL_CONCUSS
    case 'psychic': case 'ghost': case 'dark': return CTRL_TERRIFY
    case 'fairy': return CTRL_CHARM
    default: return CTRL_INTIMIDATE
  }
}

/**
 * 任意收藏寶可夢的招式組合：近戰 = 撞擊、投射 = 第一屬性的招牌技、控制 = 屬性對應控制技。
 * 空屬性（快取缺漏）退回一般屬性。
 */
export function buildGenericMoves(types: readonly PokeType[]): [MoveDef, MoveDef, MoveDef] {
  const primary = types[0]
  return [GENERIC_MELEE, (primary && TYPE_MOVE[primary]) || TYPE_MOVE.normal, controlMoveForType(primary)]
}
