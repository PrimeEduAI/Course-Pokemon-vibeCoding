import { describe, expect, test } from 'bun:test'
import { CHARIZARD, MOVES, PIKACHU, hasStab, hpPool } from '@/lib/battle/moves'
import { getTypeMult } from '@/lib/battle/typeChart'
import { computeDamage } from '@/lib/battle/damage'
import { canFire, cooldownProgress } from '@/lib/battle/cooldown'

const rngMax = () => 1 // roll = 1.0
const rngMin = () => 0 // roll = 0.85

describe('typeChart', () => {
  test('電屬性打噴火龍（火/飛行）= 2x（飛行 2x × 火 1x）', () => {
    expect(getTypeMult('electric', CHARIZARD.types)).toBe(2)
  })
  test('火打電 = 1x、一般打火/飛行 = 1x、火打火 = 0.5x', () => {
    expect(getTypeMult('fire', PIKACHU.types)).toBe(1)
    expect(getTypeMult('normal', CHARIZARD.types)).toBe(1)
    expect(getTypeMult('fire', ['fire'])).toBe(0.5)
  })
  test('電打電 = 0.5x', () => {
    expect(getTypeMult('electric', ['electric'])).toBe(0.5)
  })
})

describe('damage', () => {
  test('十萬伏特 vs 噴火龍：base floor(29.92)=29 → 29*1.5*2 = 87（rng=1）', () => {
    const dmg = computeDamage(MOVES.thunderbolt, PIKACHU, CHARIZARD, true, 2, rngMax)
    expect(dmg).toBe(87)
  })
  test('電光一閃 vs 噴火龍：無 STAB、1x → floor((22*40*55/78)/50+2) = 14（rng=1）', () => {
    const dmg = computeDamage(MOVES.quickAttack, PIKACHU, CHARIZARD, false, 1, rngMax)
    expect(dmg).toBe(14)
  })
  test('噴射火焰 vs 皮卡丘：base 85 * 1.5 STAB = 127（rng=1）', () => {
    const dmg = computeDamage(MOVES.flamethrower, CHARIZARD, PIKACHU, true, 1, rngMax)
    expect(dmg).toBe(127)
  })
  test('隨機下限 0.85：十萬伏特 = floor(87*0.85) = 73', () => {
    const dmg = computeDamage(MOVES.thunderbolt, PIKACHU, CHARIZARD, true, 2, rngMin)
    expect(dmg).toBe(73)
  })
  test('傷害至少為 1', () => {
    const dmg = computeDamage(MOVES.quickAttack, { level: 1, atk: 1 }, { def: 999 }, false, 0.25, rngMin)
    expect(dmg).toBe(1)
  })
})

describe('stats / moves data', () => {
  test('HP 池：皮卡丘 35→180、噴火龍 78→266', () => {
    expect(hpPool(35)).toBe(180)
    expect(PIKACHU.maxHp).toBe(180)
    expect(CHARIZARD.maxHp).toBe(266)
  })
  test('STAB 判定：皮卡丘用十萬伏特有、電光一閃沒有', () => {
    expect(hasStab(MOVES.thunderbolt, PIKACHU)).toBe(true)
    expect(hasStab(MOVES.quickAttack, PIKACHU)).toBe(false)
    expect(hasStab(MOVES.flamethrower, CHARIZARD)).toBe(true)
  })
  test('招式定義完整：投射技有 speed、皆有冷卻', () => {
    for (const m of Object.values(MOVES)) {
      expect(m.cooldownMs).toBeGreaterThan(0)
      if (m.kind === 'projectile') expect(m.speed ?? 0).toBeGreaterThan(0)
    }
  })
})

describe('cooldown', () => {
  test('canFire：冷卻中 false、冷卻好 true、從未施放 true', () => {
    expect(canFire(1000, 900, 1500)).toBe(false)
    expect(canFire(1000, 900, 1900)).toBe(true)
    expect(canFire(0, 4000, 4000)).toBe(true)
  })
  test('cooldownProgress 0→1 並夾住', () => {
    expect(cooldownProgress(1000, 1000, 1000)).toBe(0)
    expect(cooldownProgress(1000, 1000, 1500)).toBe(0.5)
    expect(cooldownProgress(1000, 1000, 3000)).toBe(1)
  })
})
