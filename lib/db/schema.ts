import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const cards = sqliteTable('cards', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tcgCardId: text('tcg_card_id').notNull().unique(),
  name: text('name').notNull(),
  setId: text('set_id').notNull(),
  number: text('number').notNull(),
  rarity: text('rarity'),
  imageSmall: text('image_small').notNull(),
  imageLarge: text('image_large').notNull(),
  photoPath: text('photo_path'),
  pokedexNumbers: text('pokedex_numbers').notNull().default('[]'), // JSON array
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const priceSnapshots = sqliteTable('price_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cardId: integer('card_id').notNull().references(() => cards.id),
  market: real('market'), low: real('low'), mid: real('mid'), high: real('high'),
  currency: text('currency').notNull().default('USD'),
  fetchedAt: text('fetched_at').notNull().default(sql`(datetime('now'))`),
})

export const pokemonCache = sqliteTable('pokemon_cache', {
  dexId: integer('dex_id').primaryKey(),
  name: text('name').notNull(),
  statsJson: text('stats_json').notNull(),
  movesJson: text('moves_json').notNull(),
  typesJson: text('types_json').notNull().default('[]'), // JSON array of type names
  cryUrl: text('cry_url'),
})
