import { expect, test } from 'bun:test'
import { parseVisionResponse } from '../lib/vision'

test('parses plain json', () => {
  expect(parseVisionResponse('{"name":"Pikachu","number":"025","printedTotal":"193"}'))
    .toEqual({ name: 'Pikachu', number: '025', printedTotal: '193' })
})
test('parses fenced json and null fields', () => {
  expect(parseVisionResponse('```json\n{"name":"Mew ex","number":null,"printedTotal":null}\n```'))
    .toEqual({ name: 'Mew ex', number: null, printedTotal: null })
})
test('throws on garbage', () => {
  expect(() => parseVisionResponse('I cannot read this card')).toThrow()
})
test('throws when number contains non-digits', () => {
  expect(() => parseVisionResponse('{"name":"Pikachu","number":"25a","printedTotal":"193"}')).toThrow()
})
