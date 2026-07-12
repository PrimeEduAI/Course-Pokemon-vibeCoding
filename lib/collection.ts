import { desc, eq } from 'drizzle-orm'
import type { Db } from './db'
import { cards, pokemonCache, priceSnapshots } from './db/schema'
import type { TcgCard } from './tcg'
import type { CachedPokemon } from './pokeapi'

type PokemonFetcher = (dexId: number) => Promise<CachedPokemon>

/** photoPath 只接受掃卡 route 產生的固定格式，防 path traversal（M4 會拿它去 serve 檔案） */
export function isValidPhotoPath(p: unknown): p is string {
  return typeof p === 'string' && /^data\/photos\/\d+\.(jpe?g|png|webp)$/.test(p)
}

export async function addCard(db: Db, card: TcgCard, photoPath: string | null, getPokemon: PokemonFetcher) {
  const inserted = db.transaction((tx) => {
    const row = tx.insert(cards).values({
      tcgCardId: card.id, name: card.name, setId: card.setId, number: card.number,
      rarity: card.rarity, imageSmall: card.imageSmall, imageLarge: card.imageLarge,
      photoPath, pokedexNumbers: JSON.stringify(card.pokedexNumbers),
    }).returning().get()

    if (card.price) {
      tx.insert(priceSnapshots).values({
        cardId: row.id, market: card.price.market, low: card.price.low,
        mid: card.price.mid, high: card.price.high, currency: 'USD',
      }).run()
    }
    return row
  })

  for (const dexId of card.pokedexNumbers) {
    const exists = db.select().from(pokemonCache).where(eq(pokemonCache.dexId, dexId)).all()
    if (exists.length > 0) continue
    try {
      const p = await getPokemon(dexId)
      db.insert(pokemonCache).values({
        dexId, name: p.name, statsJson: JSON.stringify(p.stats),
        movesJson: JSON.stringify(p.moves), cryUrl: p.cryUrl,
      }).run()
    } catch (e) {
      console.warn(`pokemonCache fetch failed for #${dexId}`, e)
      // PokéAPI 掛了不擋入庫，之後可重補
    }
  }
  return inserted
}

export function listCards(db: Db) {
  return db.select().from(cards).orderBy(desc(cards.createdAt)).all().map((c) => {
    const snap = db.select().from(priceSnapshots)
      .where(eq(priceSnapshots.cardId, c.id))
      .orderBy(desc(priceSnapshots.fetchedAt)).all()[0]
    return { ...c, pokedexNumbers: JSON.parse(c.pokedexNumbers) as number[], latestPrice: snap?.market ?? null }
  })
}
