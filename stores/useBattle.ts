import { create } from 'zustand'
import { CHARIZARD, MOVES, PIKACHU, type MoveId } from '@/lib/battle/moves'
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
  moveId: MoveId
  owner: 'player' | 'enemy'
  origin: [number, number, number]
  dir: [number, number, number]
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
}

export const DASH_MS = 250
export const DASH_COOLDOWN_MS = 1200
const MAX_PROJECTILES = 4

let uid = 1

interface BattleState {
  playerHp: number
  playerMaxHp: number
  enemyHp: number
  enemyMaxHp: number
  phase: Phase
  /** 玩家招式 lastFiredAt（performance.now() 毫秒） */
  cooldowns: Record<string, number>
  dashLastAt: number
  dashingUntil: number
  lastPlayerHitAt: number
  lastEnemyHitAt: number
  popups: DamagePopup[]
  projectiles: ProjectileState[]
  fx: BurstFx[]
  resetNonce: number

  tryFire: (moveId: MoveId, now: number) => boolean
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
  reset: () => void
}

export const useBattle = create<BattleState>((set, get) => ({
  playerHp: PIKACHU.maxHp,
  playerMaxHp: PIKACHU.maxHp,
  enemyHp: CHARIZARD.maxHp,
  enemyMaxHp: CHARIZARD.maxHp,
  phase: 'fighting',
  cooldowns: {},
  dashLastAt: -Infinity,
  dashingUntil: 0,
  lastPlayerHitAt: -Infinity,
  lastEnemyHitAt: -Infinity,
  popups: [],
  projectiles: [],
  fx: [],
  resetNonce: 0,

  tryFire: (moveId, now) => {
    const s = get()
    if (s.phase !== 'fighting') return false
    const move = MOVES[moveId]
    if (!canFire(s.cooldowns[moveId] ?? 0, move.cooldownMs, now)) return false
    set({ cooldowns: { ...s.cooldowns, [moveId]: now } })
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

  reset: () => {
    resetWorld()
    set((s) => ({
      playerHp: PIKACHU.maxHp,
      enemyHp: CHARIZARD.maxHp,
      phase: 'fighting',
      cooldowns: {},
      dashLastAt: -Infinity,
      dashingUntil: 0,
      lastPlayerHitAt: -Infinity,
      lastEnemyHitAt: -Infinity,
      popups: [],
      projectiles: [],
      fx: [],
      resetNonce: s.resetNonce + 1,
    }))
  },
}))

// dev 診斷：瀏覽器 console 可直接讀 __battle.getState()
if (typeof window !== 'undefined') (window as unknown as { __battle?: typeof useBattle }).__battle = useBattle
