import { expect, test } from 'bun:test'
import { dirFromKeys, idleBob, rotateDirByYaw } from '../lib/movement'

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

test('rotateDirByYaw with yaw 0 is identity', () => {
  const [x, z] = rotateDirByYaw(0.6, -0.8, 0)
  expect(x).toBeCloseTo(0.6)
  expect(z).toBeCloseTo(-0.8)
})
test('rotateDirByYaw with yaw π flips the vector', () => {
  const [x, z] = rotateDirByYaw(0, -1, Math.PI)
  expect(x).toBeCloseTo(0)
  expect(z).toBeCloseTo(1)
})
test('rotateDirByYaw with yaw π/2 rotates 90 degrees', () => {
  const [x, z] = rotateDirByYaw(0, -1, Math.PI / 2)
  expect(x).toBeCloseTo(-1)
  expect(z).toBeCloseTo(0)
})
test('rotateDirByYaw preserves length', () => {
  const [x, z] = rotateDirByYaw(0.6, -0.8, 1.234)
  expect(Math.hypot(x, z)).toBeCloseTo(1)
})
test('rotateDirByYaw keeps the zero vector zero', () => {
  const [x, z] = rotateDirByYaw(0, 0, 1.9)
  expect(x).toBeCloseTo(0)
  expect(z).toBeCloseTo(0)
})
