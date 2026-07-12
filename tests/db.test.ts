import { expect, test } from 'bun:test'
import { createDb } from '../lib/db'
import { cards, priceSnapshots } from '../lib/db/schema'

test('insert and read a card with price snapshot', () => {
  const db = createDb(':memory:')
  db.insert(cards).values({
    tcgCardId: 'base1-58', name: 'Pikachu', setId: 'base1', number: '58',
    rarity: 'Common', imageSmall: 'https://x/s.png', imageLarge: 'https://x/l.png',
    photoPath: 'data/photos/1.jpg', pokedexNumbers: '[25]',
  }).run()
  const row = db.select().from(cards).all()[0]
  expect(row.name).toBe('Pikachu')
  db.insert(priceSnapshots).values({ cardId: row.id, market: 1.25, low: 0.5, mid: 1.5, high: 5, currency: 'USD' }).run()
  expect(db.select().from(priceSnapshots).all()).toHaveLength(1)
})
