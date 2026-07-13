import { describe, expect, test } from 'bun:test'
import { spriteNameForDex, spriteSetForGen } from '@/lib/dex-names'

describe('dex-names', () => {
  test('現行名單：25 → pikachu、6 → charizard、150 → mewtwo', () => {
    expect(spriteNameForDex(25)).toBe('pikachu')
    expect(spriteNameForDex(6)).toBe('charizard')
    expect(spriteNameForDex(150)).toBe('mewtwo')
  })
  test('名單外回傳 null（呼叫端 fallback 官繪）', () => {
    expect(spriteNameForDex(151)).toBeNull()
    expect(spriteNameForDex(0)).toBeNull()
  })
})

describe('spriteSetForGen（點陣套組跟戰場年代）', () => {
  test('gen1–4 用當代點陣圖', () => {
    expect(spriteSetForGen(1)).toBe('gen1')
    expect(spriteSetForGen(2)).toBe('gen2')
    expect(spriteSetForGen(3)).toBe('gen3')
    expect(spriteSetForGen(4)).toBe('gen4')
  })
  test('gen5+ 與未指定 → gen5', () => {
    expect(spriteSetForGen(5)).toBe('gen5')
    expect(spriteSetForGen(8)).toBe('gen5')
    expect(spriteSetForGen(undefined)).toBe('gen5')
  })
})
