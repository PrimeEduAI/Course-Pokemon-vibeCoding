import { expect, test } from 'bun:test'
import { crossValidate, scanCard } from '../lib/scan'
import type { TcgCard } from '../lib/tcg'

const card = (over: Partial<TcgCard>): TcgCard => ({
  id: 'x', name: 'Pikachu', number: '58', rarity: null, setId: 's', setName: 'S',
  printedTotal: 102, imageSmall: '', imageLarge: '', pokedexNumbers: [25],
  price: null, priceUpdatedAt: null, ...over,
})

test('crossValidate flags exact-name candidates', () => {
  const out = crossValidate('Pikachu', [card({}), card({ id: 'y', name: 'Pikachu ex' })])
  expect(out.find((c) => c.id === 'x')?.validated).toBe(true)
  expect(out.find((c) => c.id === 'y')?.validated).toBe(false)
})

test('scanCard wires vision hint into tcg search', async () => {
  const result = await scanCard({
    extract: async () => ({ name: 'Pikachu', number: '58', printedTotal: '102' }),
    search: async (q) => {
      expect(q).toBe('name:"Pikachu" number:58 set.printedTotal:102')
      return [card({})]
    },
  })
  expect(result.hint.name).toBe('Pikachu')
  expect(result.candidates[0].validated).toBe(true)
})

test('scanCard retries name-only when strict query is empty', async () => {
  const queries: string[] = []
  const result = await scanCard({
    extract: async () => ({ name: 'Pikachu', number: '99', printedTotal: '102' }),
    search: async (q) => { queries.push(q); return q.includes('number') ? [] : [card({})] },
  })
  expect(queries).toHaveLength(2)
  expect(result.candidates).toHaveLength(1)
})

test('scanCard resolves with empty candidates when both queries find nothing', async () => {
  const result = await scanCard({
    extract: async () => ({ name: 'Fakemon', number: '01', printedTotal: '99' }),
    search: async () => [],
  })
  expect(result.candidates).toEqual([])
  expect(result.hint.name).toBe('Fakemon')
})
