import { create } from 'zustand'
import { hpPool } from '@/lib/battle/moves'
import {
  SPECIES, isTypeName, toFighter,
  type BaseStats, type FighterDef, type TypeName,
} from '@/lib/battle/species'
import { buildGenericMoves } from '@/lib/battle/genericMoves'

/** 收藏 API 回傳的 pokemon_cache 條目（含 types） */
interface CollectionPokemon {
  dexId: number
  name: string
  stats: BaseStats
  types: string[]
}

interface CollectionResponse {
  cards: { pokedexNumbers: number[] }[]
  pokemon?: CollectionPokemon[]
}

export interface RosterEntry {
  dexId: number
  nameZh: string
  nameEn: string
  types: TypeName[]
  /** null = 快取缺漏（資料補抓中，不可出戰） */
  base: BaseStats | null
  source: 'default' | 'collection'
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

const defaultEntry = (dexId: number): RosterEntry => {
  const s = SPECIES[dexId]
  return { dexId: s.dexId, nameZh: s.nameZh, nameEn: s.nameEn, types: s.types, base: s.base, source: 'default' }
}

/** 預設出戰名單：皮卡丘 + 伊布 */
export const DEFAULT_ROSTER_DEX = [25, 133, 448, 94]  // 皮卡丘/伊布 + 路卡利歐/耿鬼（MEGA 展示用）

interface RosterState {
  playerDex: number
  roster: RosterEntry[]
  loading: boolean
  setPlayerDex: (dexId: number) => void
  /** 進選角畫面時抓收藏，合併到 roster（預設 ∪ 收藏） */
  load: () => Promise<void>
  /** dexId → 戰鬥用 FighterDef；手工名單優先，收藏走通用招式；無資料回 null */
  buildFighter: (dexId: number) => FighterDef | null
}

export const useRoster = create<RosterState>((set, get) => ({
  playerDex: 25,
  roster: DEFAULT_ROSTER_DEX.map(defaultEntry),
  loading: false,

  setPlayerDex: (dexId) => set({ playerDex: dexId }),

  load: async () => {
    set({ loading: true })
    try {
      const res = await fetch('/api/collection')
      if (!res.ok) throw new Error(`collection ${res.status}`)
      const data = (await res.json()) as CollectionResponse
      const cacheByDex = new Map((data.pokemon ?? []).map((p) => [p.dexId, p]))
      const entries: RosterEntry[] = DEFAULT_ROSTER_DEX.map(defaultEntry)
      const seen = new Set(DEFAULT_ROSTER_DEX)
      for (const card of data.cards ?? []) {
        for (const dexId of card.pokedexNumbers ?? []) {
          if (seen.has(dexId)) continue
          seen.add(dexId)
          const species = SPECIES[dexId]
          if (species) {
            entries.push({ ...defaultEntry(dexId), source: 'collection' })
            continue
          }
          const cached = cacheByDex.get(dexId)
          const types = (cached?.types ?? []).filter(isTypeName)
          entries.push({
            dexId,
            nameZh: cached ? capitalize(cached.name) : `No.${dexId}`,
            nameEn: cached ? cached.name.toUpperCase() : `NO.${dexId}`,
            types,
            base: cached?.stats ?? null,
            source: 'collection',
          })
        }
      }
      set({ roster: entries, loading: false })
    } catch {
      // 收藏抓不到不擋出戰：保底預設名單
      set({ roster: DEFAULT_ROSTER_DEX.map(defaultEntry), loading: false })
    }
  },

  buildFighter: (dexId) => {
    const species = SPECIES[dexId]
    if (species) return toFighter(species)
    const entry = get().roster.find((e) => e.dexId === dexId)
    if (!entry || !entry.base) return null
    return {
      dexId,
      nameZh: entry.nameZh,
      nameEn: entry.nameEn,
      types: entry.types,
      level: 50,
      atk: entry.base.atk,
      def: entry.base.def,
      maxHp: hpPool(entry.base.hp),
      moves: buildGenericMoves(entry.types),
      targetHeight: 1.8,
    }
  },
}))
