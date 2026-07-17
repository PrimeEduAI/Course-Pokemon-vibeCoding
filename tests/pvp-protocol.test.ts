import { describe, expect, test } from 'bun:test'
import { mirrorVec3, mirrorYaw, wsUrl, PVP_DEFAULT_PORT } from '../lib/pvp/protocol'

describe('PvP 協定：座標鏡像', () => {
  test('mirrorVec3 水平翻轉、保留高度；鏡像兩次 = 原座標', () => {
    expect(mirrorVec3([3, 1.5, -6])).toEqual([-3, 1.5, 6])
    expect(mirrorVec3(mirrorVec3([2.5, 0.8, 4]))).toEqual([2.5, 0.8, 4])
  })

  test('雙方出生點對稱：南側玩家 (0,1,6) 在對方世界是北側 (0,1,-6)', () => {
    expect(mirrorVec3([0, 1, 6])).toEqual([0, 1, -6])
  })

  test('mirrorYaw 轉半圈且收斂在 (-π, π]；鏡像兩次回到原角', () => {
    expect(mirrorYaw(0)).toBeCloseTo(Math.PI)
    expect(mirrorYaw(Math.PI / 2)).toBeCloseTo(-Math.PI / 2)
    expect(mirrorYaw(mirrorYaw(1.23))).toBeCloseTo(1.23)
    // 任意角都不會跑出範圍
    for (const y of [-3.1, -1, 0, 0.5, 2.9, 3.14]) {
      const m = mirrorYaw(y)
      expect(m).toBeGreaterThan(-Math.PI - 1e-9)
      expect(m).toBeLessThanOrEqual(Math.PI + 1e-9)
    }
  })
})

describe('PvP 協定：伺服器位址', () => {
  test('沒寫 port 補預設；寫了就照用', () => {
    expect(wsUrl('192.168.1.10')).toBe(`ws://192.168.1.10:${PVP_DEFAULT_PORT}`)
    expect(wsUrl(' localhost ')).toBe(`ws://localhost:${PVP_DEFAULT_PORT}`)
    expect(wsUrl('10.0.0.5:9999')).toBe('ws://10.0.0.5:9999')
  })
})
