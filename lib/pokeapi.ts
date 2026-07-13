export interface CachedPokemon {
  dexId: number; name: string
  stats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }
  moves: string[]
  /** 屬性名（小寫英文，slot 順序） */
  types: string[]
  cryUrl: string | null
}

const STAT_KEYS: Record<string, keyof CachedPokemon['stats']> = {
  hp: 'hp', attack: 'atk', defense: 'def',
  'special-attack': 'spa', 'special-defense': 'spd', speed: 'spe',
}

export async function getPokemon(dexId: number, fetcher: typeof fetch = fetch): Promise<CachedPokemon> {
  const res = await fetcher(`https://pokeapi.co/api/v2/pokemon/${dexId}`)
  if (!res.ok) throw new Error(`PokeAPI ${res.status} for #${dexId}`)
  const p = await res.json()
  const stats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
  for (const s of p.stats) {
    const k = STAT_KEYS[s.stat.name]
    if (k) stats[k] = s.base_stat
  }
  return {
    dexId, name: p.name, stats,
    moves: p.moves.slice(0, 40).map((m: { move: { name: string } }) => m.move.name),
    types: (p.types ?? []).map((t: { type: { name: string } }) => t.type.name),
    cryUrl: `/assets/cries/latest/${dexId}.ogg`, // 已下載到本地
  }
}
