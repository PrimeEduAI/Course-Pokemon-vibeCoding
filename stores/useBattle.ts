import { create } from 'zustand'
import type { MoveDef } from '@/lib/battle/moves'
import { METER_MAX, type GimmickDef } from '@/lib/battle/gimmicks'
import { SPECIES, toFighter, type FighterDef } from '@/lib/battle/species'
import { canFire } from '@/lib/battle/cooldown'
import { resetWorld } from './battleWorld'

export type Phase = 'fighting' | 'victory' | 'defeat'

export interface DamagePopup {
  id: number
  text: string
  color: string
  pos: [number, number, number]
  big: boolean
  at: number
}

export interface ProjectileState {
  id: number
  move: MoveDef
  owner: 'player' | 'enemy'
  origin: [number, number, number]
  dir: [number, number, number]
  /** 視覺體型倍率（極巨化中的招式 ×1.8；模擬 / 傷害不受影響） */
  scale?: number
}

export interface BurstFx {
  id: number
  kind: 'burst' | 'slash'
  pos: [number, number, number]
  color: string
  /** slash 用：水平朝向角 */
  angle: number
  scale: number
  at: number
  /** 特效樣式：burst = MoveVisualId、slash = SlashVariant（未指定走通用外觀） */
  variant?: string
}

export type GimmickSideId = 'player' | 'enemy'

/** 單邊的世代招牌能力狀態（計量 0–100、一場一次、發動中定義） */
export interface GimmickSide {
  meter: number
  used: boolean
  active: GimmickDef | null
  /** performance.now() 毫秒；0 = 尚未發動 */
  activatedAt: number
  /** activatedAt + durationMs（MEGA = Infinity） */
  endsAt: number
}

const freshGimmick = (): GimmickSide => ({ meter: 0, used: false, active: null, activatedAt: 0, endsAt: 0 })

export const DASH_MS = 250
export const DASH_COOLDOWN_MS = 1200
const MAX_PROJECTILES = 4

let uid = 1

/** 未 configure 前的預設對戰組合（皮卡丘 vs 噴火龍） */
const DEFAULT_PLAYER = toFighter(SPECIES[25])
const DEFAULT_ENEMY = toFighter(SPECIES[6])

interface BattleState {
  playerFighter: FighterDef
  enemyFighter: FighterDef
  playerHp: number
  playerMaxHp: number
  enemyHp: number
  enemyMaxHp: number
  phase: Phase
  /** 玩家招式 lastFiredAt（performance.now() 毫秒），鍵 = move.id */
  cooldowns: Record<string, number>
  dashLastAt: number
  dashingUntil: number
  lastPlayerHitAt: number
  lastEnemyHitAt: number
  popups: DamagePopup[]
  projectiles: ProjectileState[]
  fx: BurstFx[]
  resetNonce: number
  playerGimmick: GimmickSide
  enemyGimmick: GimmickSide

  /** 選角完成 / 進場：設定雙方出戰者並重開一場乾淨的戰鬥 */
  configure: (player: FighterDef, enemy: FighterDef) => void
  /** slot 0 = 近戰（Z）、1 = 投射（X） */
  tryFire: (slot: 0 | 1, now: number) => boolean
  tryDash: (now: number) => boolean
  isInvulnerable: (now: number) => boolean
  dealDamageToEnemy: (amount: number) => void
  dealDamageToPlayer: (amount: number) => void
  addPopup: (p: Omit<DamagePopup, 'id' | 'at'>) => void
  removePopup: (id: number) => void
  spawnProjectile: (p: Omit<ProjectileState, 'id'>) => void
  removeProjectile: (id: number) => void
  addFx: (f: Omit<BurstFx, 'id' | 'at'>) => void
  removeFx: (id: number) => void
  /** 招牌能力計量增益（已發動過的一邊不再累積）；夾在 0–100 */
  gainMeter: (side: GimmickSideId, amount: number) => void
  /** 計量滿 100（玩家）/ AI 條件達標時發動；一場一次，發動即清空計量 */
  tryActivateGimmick: (side: GimmickSideId, def: GimmickDef, now: number) => boolean
  /** 持續時間到（durationMs 有限）→ 收掉發動狀態 */
  expireGimmick: (side: GimmickSideId) => void
  /** 再戰：保留目前出戰組合 */
  reset: () => void
}

const freshRound = (player: FighterDef, enemy: FighterDef) => ({
  playerFighter: player,
  enemyFighter: enemy,
  playerHp: player.maxHp,
  playerMaxHp: player.maxHp,
  enemyHp: enemy.maxHp,
  enemyMaxHp: enemy.maxHp,
  phase: 'fighting' as Phase,
  cooldowns: {},
  dashLastAt: -Infinity,
  dashingUntil: 0,
  lastPlayerHitAt: -Infinity,
  lastEnemyHitAt: -Infinity,
  popups: [],
  projectiles: [],
  fx: [],
  playerGimmick: freshGimmick(),
  enemyGimmick: freshGimmick(),
})

const gimmickKey = (side: GimmickSideId): 'playerGimmick' | 'enemyGimmick' =>
  side === 'player' ? 'playerGimmick' : 'enemyGimmick'

export const useBattle = create<BattleState>((set, get) => ({
  ...freshRound(DEFAULT_PLAYER, DEFAULT_ENEMY),
  resetNonce: 0,

  configure: (player, enemy) => {
    resetWorld()
    set((s) => ({ ...freshRound(player, enemy), resetNonce: s.resetNonce + 1 }))
  },

  tryFire: (slot, now) => {
    const s = get()
    if (s.phase !== 'fighting') return false
    const move = s.playerFighter.moves[slot]
    if (!canFire(s.cooldowns[move.id] ?? 0, move.cooldownMs, now)) return false
    set({ cooldowns: { ...s.cooldowns, [move.id]: now } })
    return true
  },

  tryDash: (now) => {
    const s = get()
    if (s.phase !== 'fighting') return false
    if (!canFire(s.dashLastAt, DASH_COOLDOWN_MS, now)) return false
    set({ dashLastAt: now, dashingUntil: now + DASH_MS })
    return true
  },

  isInvulnerable: (now) => now < get().dashingUntil,

  dealDamageToEnemy: (amount) => {
    const s = get()
    if (s.phase !== 'fighting') return
    const hp = Math.max(0, s.enemyHp - amount)
    set({ enemyHp: hp, lastEnemyHitAt: performance.now(), ...(hp <= 0 ? { phase: 'victory' as Phase } : null) })
  },

  dealDamageToPlayer: (amount) => {
    const s = get()
    if (s.phase !== 'fighting') return
    const hp = Math.max(0, s.playerHp - amount)
    set({ playerHp: hp, lastPlayerHitAt: performance.now(), ...(hp <= 0 ? { phase: 'defeat' as Phase } : null) })
  },

  addPopup: (p) => set((s) => ({
    popups: [...s.popups.slice(-7), { ...p, id: uid++, at: performance.now() }],
  })),
  removePopup: (id) => set((s) => ({ popups: s.popups.filter((p) => p.id !== id) })),

  spawnProjectile: (p) => set((s) => (
    s.projectiles.length >= MAX_PROJECTILES ? s : { projectiles: [...s.projectiles, { ...p, id: uid++ }] }
  )),
  removeProjectile: (id) => set((s) => ({ projectiles: s.projectiles.filter((p) => p.id !== id) })),

  addFx: (f) => set((s) => ({ fx: [...s.fx.slice(-11), { ...f, id: uid++, at: performance.now() }] })),
  removeFx: (id) => set((s) => ({ fx: s.fx.filter((f) => f.id !== id) })),

  gainMeter: (side, amount) => {
    const key = gimmickKey(side)
    const g = get()[key]
    if (g.used || get().phase !== 'fighting') return
    const meter = Math.min(METER_MAX, Math.max(0, g.meter + amount))
    if (meter === g.meter) return
    set({ [key]: { ...g, meter } } as Partial<BattleState>)
  },

  tryActivateGimmick: (side, def, now) => {
    const s = get()
    if (s.phase !== 'fighting') return false
    const key = gimmickKey(side)
    const g = s[key]
    if (g.used) return false
    if (side === 'player' && g.meter < METER_MAX) return false
    set({
      [key]: { meter: 0, used: true, active: def, activatedAt: now, endsAt: now + def.durationMs },
    } as Partial<BattleState>)
    return true
  },

  expireGimmick: (side) => {
    const key = gimmickKey(side)
    const g = get()[key]
    if (!g.active) return
    set({ [key]: { ...g, active: null } } as Partial<BattleState>)
  },

  reset: () => {
    resetWorld()
    set((s) => ({ ...freshRound(s.playerFighter, s.enemyFighter), resetNonce: s.resetNonce + 1 }))
  },
}))

// dev 診斷：瀏覽器 console 可直接讀 __battle.getState()
if (typeof window !== 'undefined') (window as unknown as { __battle?: typeof useBattle }).__battle = useBattle
