export type CollectionCard = {
  id: number
  tcgCardId: string
  name: string
  setId: string
  number: string
  rarity: string | null
  imageSmall: string
  imageLarge: string
  photoPath: string | null
  pokedexNumbers: number[]
  createdAt: string | number
  latestPrice: number | null
}

export type SummonRequest = { dexId: number; key: number }
