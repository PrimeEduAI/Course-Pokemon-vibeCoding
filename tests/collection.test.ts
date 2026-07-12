import { expect, test } from 'bun:test'
import { createDb } from '../lib/db'
import { cards, pokemonCache, priceSnapshots } from '../lib/db/schema'
import { addCard, isValidPhotoPath, listCards } from '../lib/collection'
import type { TcgCard } from '../lib/tcg'

const tcgCard: TcgCard = {
  id: 'base1-58', name: 'Pikachu', number: '58', rarity: 'Common',
  setId: 'base1', setName: 'Base', printedTotal: 102,
  imageSmall: 's.png', imageLarge: 'l.png', pokedexNumbers: [25],
  price: { market: 1.2, low: 0.5, mid: 1, high: 3, variant: 'normal' },
  priceUpdatedAt: '2026/07/12',
}
const fakePokemon = async (dexId: number) => ({
  dexId, name: 'pikachu',
  stats: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 },
  moves: ['thunderbolt', 'quick-attack'],
  cryUrl: '/assets/cries/latest/25.ogg',
})

test('addCard inserts card + snapshot + pokemon cache; duplicate tcg id rejected', async () => {
  const db = createDb(':memory:')
  await addCard(db, tcgCard, 'data/photos/a.jpg', fakePokemon)
  expect(db.select().from(cards).all()).toHaveLength(1)
  expect(db.select().from(priceSnapshots).all()[0].market).toBe(1.2)
  expect(db.select().from(pokemonCache).all()[0].dexId).toBe(25)
  await expect(addCard(db, tcgCard, 'b.jpg', fakePokemon)).rejects.toThrow()
})

test('listCards returns latest price per card', async () => {
  const db = createDb(':memory:')
  await addCard(db, tcgCard, null, fakePokemon)
  const list = listCards(db)
  expect(list[0].name).toBe('Pikachu')
  expect(list[0].latestPrice).toBe(1.2)
})

test('isValidPhotoPath accepts only canonical data/photos paths', () => {
  expect(isValidPhotoPath('data/photos/123.jpg')).toBe(true)
  expect(isValidPhotoPath('data/photos/123.jpeg')).toBe(true)
  expect(isValidPhotoPath('data/photos/123.png')).toBe(true)
  expect(isValidPhotoPath('data/photos/123.webp')).toBe(true)
  expect(isValidPhotoPath('../../etc/passwd')).toBe(false)
  expect(isValidPhotoPath('data/photos/1.jpg/../x')).toBe(false)
  expect(isValidPhotoPath('data/photos/../1.jpg')).toBe(false)
  expect(isValidPhotoPath('/data/photos/1.jpg')).toBe(false)
  expect(isValidPhotoPath(null)).toBe(false)
})
