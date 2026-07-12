import { expect, test } from 'bun:test'
import { extractCardInfo, parseVisionResponse } from '../lib/vision'

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
test('throws with context when JSON is malformed', () => {
  expect(() => parseVisionResponse('{"name": "Pika", }')).toThrow(/invalid JSON/)
})
test('extractCardInfo sends image+prompt and handles refusal', async () => {
  let captured: any
  const stub = { messages: { create: async (req: any) => { captured = req; return { stop_reason: 'refusal', content: [] } } } }
  await expect(extractCardInfo('B64', 'image/jpeg', stub as any)).rejects.toThrow(/refused/)
  expect(captured.model).toBe('claude-sonnet-5')
  expect(captured.max_tokens).toBe(500)
  expect(captured.messages[0].content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'B64' } })
})
