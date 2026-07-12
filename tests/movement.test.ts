import { expect, test } from 'bun:test'
import { dirFromKeys, idleBob } from '../lib/movement'

test('single key gives unit vector', () => {
  expect(dirFromKeys({ forward: true, backward: false, left: false, right: false })).toEqual([0, -1])
})
test('backward key gives opposite unit vector', () => {
  expect(dirFromKeys({ forward: false, backward: true, left: false, right: false })).toEqual([0, 1])
})
test('diagonal is normalized', () => {
  const [x, z] = dirFromKeys({ forward: true, backward: false, left: false, right: true })
  expect(Math.hypot(x, z)).toBeCloseTo(1)
})
test('no keys gives zero vector', () => {
  expect(dirFromKeys({ forward: false, backward: false, left: false, right: false })).toEqual([0, 0])
})
test('idleBob oscillates around baseY with amplitude', () => {
  expect(idleBob(0, 1, 0.1)).toBeCloseTo(1)
  expect(Math.abs(idleBob(0.7, 1, 0.1) - 1)).toBeLessThanOrEqual(0.1)
})
