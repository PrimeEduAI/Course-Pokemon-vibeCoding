import { expect, test } from 'bun:test'
import { dirFromKeys, idleBob, lerpAngle, lockOnDir, rotateDirByYaw, yawBetween } from '../lib/movement'

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

// —— 鎖定視角移動映射 ——

test('yawBetween points from player to enemy (enemy at +X → π/2)', () => {
  expect(yawBetween(0, 0, 5, 0)).toBeCloseTo(Math.PI / 2)
  expect(yawBetween(0, 0, 0, -5)).toBeCloseTo(Math.PI) // 敵人在 -Z（開場配置）
})

test('lockOnDir: W moves toward the enemy (player at origin, enemy at +X)', () => {
  const yawE = yawBetween(0, 0, 10, 0)
  const [mx, mz] = lockOnDir(...dirFromKeys({ forward: true, backward: false, left: false, right: false }), yawE)
  expect(mx).toBeCloseTo(1)
  expect(mz).toBeCloseTo(0)
})

test('lockOnDir: S moves away from the enemy', () => {
  const yawE = yawBetween(0, 0, 10, 0)
  const [mx, mz] = lockOnDir(...dirFromKeys({ forward: false, backward: true, left: false, right: false }), yawE)
  expect(mx).toBeCloseTo(-1)
  expect(mz).toBeCloseTo(0)
})

test('lockOnDir: D strafes to screen-right (enemy at +X → +Z)', () => {
  const yawE = yawBetween(0, 0, 10, 0)
  const [mx, mz] = lockOnDir(...dirFromKeys({ forward: false, backward: false, left: false, right: true }), yawE)
  expect(mx).toBeCloseTo(0)
  expect(mz).toBeCloseTo(1)
})

test('lockOnDir: A strafes to screen-left (enemy at +X → -Z)', () => {
  const yawE = yawBetween(0, 0, 10, 0)
  const [mx, mz] = lockOnDir(...dirFromKeys({ forward: false, backward: false, left: true, right: false }), yawE)
  expect(mx).toBeCloseTo(0)
  expect(mz).toBeCloseTo(-1)
})

test('lockOnDir: opening layout (enemy at -Z) keeps W = -Z, matching pre-change feel', () => {
  const yawE = yawBetween(0, 6, 0, -6.5)
  const [mx, mz] = lockOnDir(...dirFromKeys({ forward: true, backward: false, left: false, right: false }), yawE)
  expect(mx).toBeCloseTo(0)
  expect(mz).toBeCloseTo(-1)
})

test('lerpAngle takes the shortest path across the ±π seam', () => {
  expect(lerpAngle(Math.PI * 0.9, -Math.PI * 0.9, 0.5)).toBeCloseTo(Math.PI) // 往縫合處走而非繞遠路
  expect(lerpAngle(0, 1, 0.5)).toBeCloseTo(0.5)
  expect(lerpAngle(1.2, 1.2, 0.7)).toBeCloseTo(1.2)
})
