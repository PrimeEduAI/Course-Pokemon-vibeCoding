import { expect, test } from 'bun:test'
import { resolveClipRoles, type ClipInfo } from '../lib/clipRoles'

const c = (name: string, duration = 1): ClipInfo => ({ name, duration })

// 真實資料節錄：249 洛奇亞（三套組齊備）
const LUGIA = [
  c('pm0249_00_00_00000_defaultwait01_loop', 2.52),
  c('pm0249_00_00_00030_walk01_loop', 1.35),
  c('pm0249_00_00_00100_run01_loop', 1.02),
  c('pm0249_00_00_10400_attack01', 2.18),
  c('pm0249_00_00_10500_damage01', 0.85),
  c('pm0249_00_00_20001_battlewait01_loop', 1.52),
  c('pm0249_00_00_20030_walk01_loop', 1.68),
  c('pm0249_00_00_20100_run01_loop', 1.02),
  c('pm0249_00_00_20400_attack01', 2.18),
  c('pm0249_00_00_20410_attack02', 2.52),
  c('pm0249_00_00_20450_rangeattack01', 2.32),
  c('pm0249_00_00_20460_rangeattack02_start', 0.78),
  c('pm0249_00_00_20461_rangeattack02_loop', 0.78),
  c('pm0249_00_00_20500_damage01', 0.85),
  c('pm0249_00_00_20520_down01_start', 2.18),
  c('pm0249_00_00_20521_down01_loop', 1.68),
  c('pm0249_00_00_20522_down01_end', 0.85),
  c('pm0249_00_00_28000_eye01', 0.35),
  c('pm0249_00_00_00021_turn_r090', 1.02),
]

test('full HOME set: prefers 20xxx battle set and canonical roles', () => {
  const r = resolveClipRoles(LUGIA)
  expect(r.idle).toBe('pm0249_00_00_20001_battlewait01_loop')
  expect(r.move).toBe('pm0249_00_00_20100_run01_loop')
  expect(r.attack).toBe('pm0249_00_00_20400_attack01') // attack01 優先於 attack02
  expect(r.rangeattack).toBe('pm0249_00_00_20450_rangeattack01')
  expect(r.damage).toBe('pm0249_00_00_20500_damage01')
  expect(r.downStart).toBe('pm0249_00_00_20520_down01_start')
  expect(r.downLoop).toBe('pm0249_00_00_20521_down01_loop')
})

test('falls back across set bands when 20xxx lacks a role (Mewtwo rangeattack01 in 00xxx)', () => {
  const r = resolveClipRoles([
    c('pm0150_00_00_00001_battlewait01_loop', 3.02),
    c('pm0150_00_00_00450_rangeattack01', 2.02),
    c('pm0150_00_00_20400_attack01', 2.18),
    c('pm0150_00_00_20460_rangeattack02_start', 0.78),
  ])
  expect(r.idle).toBe('pm0150_00_00_00001_battlewait01_loop')
  expect(r.attack).toBe('pm0150_00_00_20400_attack01')
  // 無 suffix 的 rangeattack01（即使在低套組）優先於 20xxx 的 _start
  expect(r.rangeattack).toBe('pm0150_00_00_00450_rangeattack01')
})

test('defaultwait fills idle when no battlewait; walk fills move when no run', () => {
  const r = resolveClipRoles([
    c('pm0384_00_00_00000_defaultwait01_loop', 2),
    c('pm0384_00_00_00030_walk01_loop', 1.4),
  ])
  expect(r.idle).toBe('pm0384_00_00_00000_defaultwait01_loop')
  expect(r.move).toBe('pm0384_00_00_00030_walk01_loop')
})

test('rangeattack02_start is used when no plain rangeattack exists', () => {
  const r = resolveClipRoles([c('pm0249_00_00_20460_rangeattack02_start', 0.78)])
  expect(r.rangeattack).toBe('pm0249_00_00_20460_rangeattack02_start')
})

test('single bonus clip becomes the attack + rangeattack gesture (Pikachu Impactrueno)', () => {
  const r = resolveClipRoles([c('Impactrueno', 4.5)])
  expect(r.attack).toBe('Impactrueno')
  expect(r.rangeattack).toBe('Impactrueno') // E 打雷手勢也用同一段
  expect(r.idle).toBeNull()
  expect(r.move).toBeNull()
})

test('junk single clips are ignored (Charizard dizzy / Blender armature action)', () => {
  expect(resolveClipRoles([c('Chariard_dizzy', 4.29)]).attack).toBeNull()
  expect(resolveClipRoles([c('Armature|ArmatureAction', 4.13)]).attack).toBeNull()
})

test('overlong single clip is ignored', () => {
  expect(resolveClipRoles([c('SomeCinematic', 12)]).attack).toBeNull()
})

test('zero clips → all roles null', () => {
  const r = resolveClipRoles([])
  expect(Object.values(r).every((v) => v === null)).toBe(true)
})
