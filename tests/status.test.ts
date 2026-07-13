import { describe, expect, test } from 'bun:test'
import {
  BURN_TICK_MS, SLOW_SPEED_MULT, STATUS_META, WEAKEN_ATK_MULT,
  activeStatuses, applyStatus, atkMult, hasStatus, isActionLocked, isMoveLocked,
  pruneStatuses, speedMult, tickBurn, type StatusEffect,
} from '@/lib/battle/status'

describe('status：施加 / 刷新 / 過期', () => {
  test('applyStatus 押入效果並依 STATUS_META 設定持續時間', () => {
    const fx = applyStatus([], 'slow', 1000)
    expect(fx).toHaveLength(1)
    expect(fx[0].kind).toBe('slow')
    expect(fx[0].expiresAt).toBe(1000 + STATUS_META.slow.durationMs)
  })
  test('同種重複施加 = 刷新持續時間（不疊加成兩筆）', () => {
    let fx = applyStatus([], 'burn', 0)
    fx = applyStatus(fx, 'burn', 2000)
    expect(fx).toHaveLength(1)
    expect(fx[0].appliedAt).toBe(2000)
    expect(fx[0].expiresAt).toBe(2000 + STATUS_META.burn.durationMs)
  })
  test('不同種可並存；applyStatus 順手清掉過期效果', () => {
    let fx = applyStatus([], 'stun', 0) // 850ms 到期
    fx = applyStatus(fx, 'weaken', 100)
    expect(fx).toHaveLength(2)
    fx = applyStatus(fx, 'slow', 6000) // stun / weaken 都過期了
    expect(fx).toHaveLength(1)
    expect(fx[0].kind).toBe('slow')
  })
  test('pruneStatuses：全部有效回原陣列（同參考）、過期才重建', () => {
    const fx = applyStatus([], 'slow', 0)
    expect(pruneStatuses(fx, 100)).toBe(fx)
    expect(pruneStatuses(fx, 99999)).toHaveLength(0)
  })
  test('hasStatus / activeStatuses 以 now 判定', () => {
    const fx = applyStatus([], 'root', 0)
    expect(hasStatus(fx, 'root', 100)).toBe(true)
    expect(hasStatus(fx, 'root', STATUS_META.root.durationMs + 1)).toBe(false)
    expect(activeStatuses(fx, 100)).toHaveLength(1)
    expect(activeStatuses(fx, 99999)).toHaveLength(0)
  })
})

describe('status：行動限制與倍率', () => {
  test('root：鎖移動、不鎖出招', () => {
    const fx = applyStatus([], 'root', 0)
    expect(isMoveLocked(fx, 100)).toBe(true)
    expect(isActionLocked(fx, 100)).toBe(false)
  })
  test('stun：移動與出招全鎖；過期解鎖', () => {
    const fx = applyStatus([], 'stun', 0)
    expect(isMoveLocked(fx, 100)).toBe(true)
    expect(isActionLocked(fx, 100)).toBe(true)
    expect(isMoveLocked(fx, 900)).toBe(false)
    expect(isActionLocked(fx, 900)).toBe(false)
  })
  test('slow：speedMult 0.55；無 slow = 1', () => {
    const fx = applyStatus([], 'slow', 0)
    expect(speedMult(fx, 100)).toBe(SLOW_SPEED_MULT)
    expect(speedMult(fx, 99999)).toBe(1)
    expect(speedMult([], 0)).toBe(1)
  })
  test('weaken：atkMult 0.72；slow / burn 不影響攻擊', () => {
    const fx = applyStatus(applyStatus([], 'weaken', 0), 'slow', 0)
    expect(atkMult(fx, 100)).toBe(WEAKEN_ATK_MULT)
    expect(atkMult(applyStatus([], 'burn', 0), 100)).toBe(1)
  })
})

describe('status：burn DoT', () => {
  const MAX_HP = 200 // 3%/s → 6/s → 每跳（0.5s）3
  test('未滿一跳：damage 0、effects 原參考', () => {
    const fx = applyStatus([], 'burn', 0)
    const r = tickBurn(fx, BURN_TICK_MS - 1, MAX_HP)
    expect(r.damage).toBe(0)
    expect(r.effects).toBe(fx)
  })
  test('每滿 500ms 燒 maxHp×1.5%；lastTickAt 前移整數跳', () => {
    const fx = applyStatus([], 'burn', 0)
    const r = tickBurn(fx, 1100, MAX_HP) // 2 跳
    expect(r.damage).toBe(6)
    expect((r.effects[0] as StatusEffect).lastTickAt).toBe(1000)
    // 續燒：餘下 100ms 不足一跳
    const r2 = tickBurn(r.effects, 1400, MAX_HP)
    expect(r2.damage).toBe(0)
  })
  test('全程 4s 共 8 跳 ≈ 12% maxHp；到期後不再燒', () => {
    let fx: readonly StatusEffect[] = applyStatus([], 'burn', 0)
    let total = 0
    for (let t = 500; t <= 6000; t += 500) {
      const r = tickBurn(fx, t, MAX_HP)
      total += r.damage
      fx = r.effects
    }
    expect(total).toBe(24) // 200 × 3% × 4s
  })
  test('傷害下限 1（極小 HP 池）', () => {
    const fx = applyStatus([], 'burn', 0)
    expect(tickBurn(fx, 500, 10).damage).toBe(1)
  })
  test('無 burn：no-op', () => {
    const fx = applyStatus([], 'slow', 0)
    const r = tickBurn(fx, 5000, MAX_HP)
    expect(r.damage).toBe(0)
    expect(r.effects).toBe(fx)
  })
})
