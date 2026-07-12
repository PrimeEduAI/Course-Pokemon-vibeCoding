import { expect, test } from 'bun:test'
import { toShowdownId } from '../lib/showdown-name'

test('lowercases and strips punctuation', () => {
  expect(toShowdownId('Mr. Mime')).toBe('mrmime')
  expect(toShowdownId("Farfetch'd")).toBe('farfetchd')
  expect(toShowdownId('nidoran-f')).toBe('nidoranf')
  expect(toShowdownId('Pikachu')).toBe('pikachu')
})

test('handles gender symbols and diacritics', () => {
  expect(toShowdownId('Nidoran♀')).toBe('nidoranf')
  expect(toShowdownId('Nidoran♂')).toBe('nidoranm')
  expect(toShowdownId('Flabébé')).toBe('flabebe')
})
