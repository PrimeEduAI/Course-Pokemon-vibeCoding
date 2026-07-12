import { z } from 'zod'

export interface CardHint { name: string; number: string | null; printedTotal: string | null }

export function buildCardQuery(h: CardHint): string {
  const parts = [`name:"${h.name}"`]
  if (h.number) parts.push(`number:${parseInt(h.number, 10)}`)
  if (h.printedTotal) parts.push(`set.printedTotal:${parseInt(h.printedTotal, 10)}`)
  return parts.join(' ')
}

const VariantPrices = z.object({
  market: z.number().nullish(), low: z.number().nullish(),
  mid: z.number().nullish(), high: z.number().nullish(),
})
type Variant = z.infer<typeof VariantPrices>

export interface PickedPrice { market: number | null; low: number | null; mid: number | null; high: number | null; variant: string }

/** 優先 holofoil，其次任何有 market 的變體 */
export function pickPrice(prices: Record<string, Variant> | undefined): PickedPrice | null {
  if (!prices) return null
  const order = ['holofoil', 'reverseHolofoil', 'normal', ...Object.keys(prices)]
  for (const v of order) {
    const p = prices[v]
    if (p && p.market != null) {
      return { market: p.market ?? null, low: p.low ?? null, mid: p.mid ?? null, high: p.high ?? null, variant: v }
    }
  }
  return null
}

const ApiCard = z.object({
  id: z.string(), name: z.string(), number: z.string(),
  rarity: z.string().nullish(),
  set: z.object({ id: z.string(), name: z.string(), printedTotal: z.number() }),
  images: z.object({ small: z.string(), large: z.string() }),
  nationalPokedexNumbers: z.array(z.number()).nullish(),
  tcgplayer: z.object({ updatedAt: z.string(), prices: z.record(z.string(), VariantPrices) }).nullish(),
})

export interface TcgCard {
  id: string; name: string; number: string; rarity: string | null
  setId: string; setName: string; printedTotal: number
  imageSmall: string; imageLarge: string
  pokedexNumbers: number[]
  price: PickedPrice | null
  priceUpdatedAt: string | null
}

export async function searchCards(
  q: string,
  opts: { fetcher?: typeof fetch; apiKey?: string } = {},
): Promise<TcgCard[]> {
  const fetcher = opts.fetcher ?? fetch
  const headers: Record<string, string> = {}
  if (opts.apiKey) headers['X-Api-Key'] = opts.apiKey
  const res = await fetcher(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=10`, { headers })
  if (!res.ok) throw new Error(`TCG API ${res.status}`)
  const json = await res.json()
  return z.array(ApiCard).parse(json.data).map((c) => ({
    id: c.id, name: c.name, number: c.number, rarity: c.rarity ?? null,
    setId: c.set.id, setName: c.set.name, printedTotal: c.set.printedTotal,
    imageSmall: c.images.small, imageLarge: c.images.large,
    pokedexNumbers: c.nationalPokedexNumbers ?? [],
    price: pickPrice(c.tcgplayer?.prices),
    priceUpdatedAt: c.tcgplayer?.updatedAt ?? null,
  }))
}
