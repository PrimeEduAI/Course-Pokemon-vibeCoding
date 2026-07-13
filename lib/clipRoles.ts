/**
 * Pokémon-HOME GLB 動畫片段 → 戰鬥角色對照（純函式，可單元測試）。
 *
 * 片段命名：`pm####_.._#####_<action><nn>[_start|_loop|_end]`
 * 5 位數 set id 分三套：20xxx（戰鬥組）> 10xxx > 00xxx；同角色優先取高位套組，
 * 缺片時跨套組遞補（例：150 超夢的 rangeattack01 只在 00xxx）。
 */

export interface ClipInfo {
  name: string
  duration: number
}

export interface ClipRoles {
  /** 待機循環：battlewait > defaultwait */
  idle: string | null
  /** 移動循環：run > walk */
  move: string | null
  /** 近戰一次性：attack01 優先 */
  attack: string | null
  /** 遠攻一次性：rangeattack01（無 suffix）優先，缺則 rangeattack02_start */
  rangeattack: string | null
  /** 受擊一次性：damage01 */
  damage: string | null
  /** 倒地：down01_start（播完停最後一幀或接 loop） */
  downStart: string | null
  downLoop: string | null
}

export const EMPTY_ROLES: ClipRoles = {
  idle: null, move: null, attack: null, rangeattack: null,
  damage: null, downStart: null, downLoop: null,
}

interface Parsed {
  name: string
  duration: number
  /** 套組帶：2 / 1 / 0（set id ÷ 10000） */
  band: number
  action: string
  num: number
  suffix: string | null
}

const CLIP_RE = /_(\d{5})_(rangeattack|battlewait|defaultwait|attack|damage|down|walk|run)(\d+)(?:_(start|loop|end))?$/

function parse(c: ClipInfo): Parsed | null {
  const m = c.name.toLowerCase().match(CLIP_RE)
  if (!m) return null
  return {
    name: c.name,
    duration: c.duration,
    band: Math.floor(Number(m[1]) / 10000),
    action: m[2],
    num: Number(m[3]),
    suffix: m[4] ?? null,
  }
}

/** 高套組帶優先、低動作編號優先 */
function best(cands: Parsed[]): string | null {
  if (cands.length === 0) return null
  cands.sort((a, b) => (b.band - a.band) || (a.num - b.num))
  return cands[0].name
}

/** 單一非官方片段的雜訊名單（Charizard_dizzy / Blender 預設 Armature action 之類不是招式動作） */
const JUNK_SINGLE = /dizzy|armature|idle|wait/i
/** 單一片段可充當攻擊手勢的長度上限（秒）——Pikachu Impactrueno 4.5s 屬有效手勢 */
const SINGLE_ATTACK_MAX_S = 6

export function resolveClipRoles(clips: ClipInfo[]): ClipRoles {
  const parsed = clips.map(parse).filter((p): p is Parsed => p !== null)

  // 完全不符合 HOME 命名 → 單片段特例：名字不像雜訊且夠短，就當攻擊手勢
  // （近戰 / 遠攻共用同一手勢：Pikachu 的 Impactrueno 本來就是打雷姿勢）
  if (parsed.length === 0) {
    if (clips.length === 1 && !JUNK_SINGLE.test(clips[0].name) && clips[0].duration <= SINGLE_ATTACK_MAX_S) {
      return { ...EMPTY_ROLES, attack: clips[0].name, rangeattack: clips[0].name }
    }
    return { ...EMPTY_ROLES }
  }

  const pick = (action: string, suffix: string | null) =>
    parsed.filter((p) => p.action === action && p.suffix === suffix)

  return {
    idle: best(pick('battlewait', 'loop')) ?? best(pick('defaultwait', 'loop')),
    move: best(pick('run', 'loop')) ?? best(pick('walk', 'loop')),
    attack: best(pick('attack', null)),
    rangeattack: best(pick('rangeattack', null)) ?? best(pick('rangeattack', 'start')),
    damage: best(pick('damage', null)),
    downStart: best(pick('down', 'start')),
    downLoop: best(pick('down', 'loop')),
  }
}
