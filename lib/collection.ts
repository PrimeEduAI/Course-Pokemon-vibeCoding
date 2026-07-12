import { desc, eq } from 'drizzle-orm'
import type { Db } from './db'
import { cards, pokemonCache, priceSnapshots } from './db/schema'
import type { TcgCard } from './tcg'
import type { CachedPokemon } from './pokeapi'

type PokemonFetcher = (dexId: number) => Promise<CachedPokemon>

export async function addCard(db: Db, card: TcgCard, photoPath: string | null, getPokemon: PokemonFetcher) {
  const inserted = db.insert(cards).values({
    tcgCardId: card.id, name: card.name, setId: card.setId, number: card.number,
    rarity: card.rarity, imageSmall: card.imageSmall, imageLarge: card.imageLarge,
    photoPath, pokedexNumbers: JSON.stringify(card.pokedexNumbers),
  }).returning().get()

  if (card.price) {
    db.insert(priceSnapshots).values({
      cardId: inserted.id, market: card.price.market, low: card.price.low,
      mid: card.price.mid, high: card.price.high, currency: 'USD',
    }).run()
  }

  for (const dexId of card.pokedexNumbers) {
    const exists = db.select().from(pokemonCache).where(eq(pokemonCache.dexId, dexId)).all()
    if (exists.length > 0) continue
    try {
      const p = await getPokemon(dexId)
      db.insert(pokemonCache).values({
        dexId, name: p.name, statsJson: JSON.stringify(p.stats),
        movesJson: JSON.stringify(p.moves), cryUrl: p.cryUrl,
      }).run()
    } catch {
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
