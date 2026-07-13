import { expect, test } from 'bun:test'
import { pickVisionBackend } from '../lib/vision-router'

test('empty string API key → local', () => {
  expect(pickVisionBackend('')).toBe('local')
})
test('undefined API key → local', () => {
  expect(pickVisionBackend(undefined)).toBe('local')
})
test('non-empty API key → api', () => {
  expect(pickVisionBackend('sk-ant-xxx')).toBe('api')
})
test('whitespace-only counts as non-empty → api', () => {
  // 我們只檢查長度；呼叫端負責 trim。此測試釘住現行行為。
  expect(pickVisionBackend(' ')).toBe('api')
})
