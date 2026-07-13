import { expect, test } from 'bun:test'
import { getPokemon } from '../lib/pokeapi'

const stubFetch = (async () =>
  new Response(
    JSON.stringify({
      name: 'pikachu',
      stats: [
        { base_stat: 35, stat: { name: 'hp' } },
        { base_stat: 55, stat: { name: 'attack' } },
        { base_stat: 40, stat: { name: 'defense' } },
        { base_stat: 50, stat: { name: 'special-attack' } },
        { base_stat: 50, stat: { name: 'special-defense' } },
        { base_stat: 90, stat: { name: 'speed' } },
        { base_stat: 999, stat: { name: 'accuracy' } }, // unknown key ignored
      ],
      moves: [{ move: { name: 'thunderbolt' } }, { move: { name: 'quick-attack' } }],
      types: [{ slot: 1, type: { name: 'electric' } }],
    }),
    { status: 200 },
  )) as unknown as typeof fetch

test('getPokemon maps PokeAPI stat names onto the abbreviated stat keys', async () => {
  const p = await getPokemon(25, stubFetch)
  expect(p.dexId).toBe(25)
  expect(p.name).toBe('pikachu')
  expect(p.stats).toEqual({ hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 })
  expect(p.moves).toEqual(['thunderbolt', 'quick-attack'])
  expect(p.types).toEqual(['electric'])
  expect(p.cryUrl).toBe('/assets/cries/latest/25.ogg')
})
