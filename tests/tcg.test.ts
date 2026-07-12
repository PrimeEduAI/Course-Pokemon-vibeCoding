import { expect, test } from 'bun:test'
import { buildCardQuery, pickPrice, searchCards, type TcgCard } from '../lib/tcg'

test('buildCardQuery composes name/number/printedTotal, strips leading zeros', () => {
  expect(buildCardQuery({ name: 'Pikachu', number: '025', printedTotal: '193' }))
    .toBe('name:"Pikachu" number:25 set.printedTotal:193')
  expect(buildCardQuery({ name: 'Mew ex', number: null, printedTotal: null })).toBe('name:"Mew ex"')
})

test('pickPrice prefers holofoil market, falls back to any variant', () => {
  expect(pickPrice({ holofoil: { market: 12.3, low: 8, mid: 11, high: 20 } }))
    .toEqual({ market: 12.3, low: 8, mid: 11, high: 20, variant: 'holofoil' })
  expect(pickPrice({ normal: { market: 0.2, low: 0.1, mid: 0.3, high: 1 } })?.variant).toBe('normal')
  expect(pickPrice(undefined)).toBeNull()
})

test('searchCards calls v2 endpoint with encoded q and maps cards', async () => {
  let calledUrl = ''
  const fakeFetch = (async (url: string) => {
    calledUrl = url
    return new Response(JSON.stringify({ data: [{
      id: 'base1-58', name: 'Pikachu', number: '58', rarity: 'Common',
      set: { id: 'base1', name: 'Base', printedTotal: 102 },
      images: { small: 's.png', large: 'l.png' },
      nationalPokedexNumbers: [25],
      tcgplayer: { updatedAt: '2026/07/12', prices: { normal: { market: 1.2, low: 0.5, mid: 1, high: 3 } } },
    }] }))
  }) as unknown as typeof fetch
  const cards: TcgCard[] = await searchCards('name:"Pikachu"', { fetcher: fakeFetch, apiKey: 'k' })
  expect(calledUrl).toContain('https://api.pokemontcg.io/v2/cards?q=name%3A%22Pikachu%22')
  expect(cards[0].name).toBe('Pikachu')
  expect(cards[0].pokedexNumbers).toEqual([25])
  expect(cards[0].price?.market).toBe(1.2)
})
