import { describe, expect, test } from 'bun:test'
import { hpPool } from '@/lib/battle/moves'
import { SPECIES, getSpecies, isTypeName, toFighter, TYPE_ZH } from '@/lib/battle/species'
import { buildGenericMoves, GENERIC_MELEE, TYPE_MOVE } from '@/lib/battle/genericMoves'
import { ARENA_BOSS, BOSS_TUNING, bossDmgScale, bossFor } from '@/lib/battle/bosses'
import { ARENA_IDS } from '@/stores/useArena'

describe('species 資料', () => {
  test('名單完整：預設 25/133 + 八大 BOSS', () => {
    for (const dex of [25, 133, 6, 249, 384, 448, 643, 658, 791, 888]) {
      expect(getSpecies(dex)).not.toBeNull()
    }
    expect(getSpecies(151)).toBeNull()
  })
  test('每筆定義：兩招 = [近戰, 投射]、屬性合法、六項種族值 > 0', () => {
    for (const s of Object.values(SPECIES)) {
      expect(s.moves[0].kind).toBe('melee')
      expect(s.moves[1].kind).toBe('projectile')
      expect(s.moves[1].speed ?? 0).toBeGreaterThan(0)
      expect(s.moves[0].color).toMatch(/^#/)
      expect(s.moves[1].color).toMatch(/^#/)
      expect(s.types.length).toBeGreaterThan(0)
      for (const t of s.types) expect(isTypeName(t)).toBe(true)
      for (const v of Object.values(s.base)) expect(v).toBeGreaterThan(0)
      expect(s.targetHeight).toBeGreaterThan(1)
    }
  })
  test('重點種族值抽查：伊布 HP55、烈空坐 atk150、蒼響 spe138', () => {
    expect(SPECIES[133].base.hp).toBe(55)
    expect(SPECIES[384].base.atk).toBe(150)
    expect(SPECIES[888].base.spe).toBe(138)
  })
  test('toFighter：Lv50、HP 池、hpScale 縮放', () => {
    const f = toFighter(SPECIES[25])
    expect(f.level).toBe(50)
    expect(f.maxHp).toBe(hpPool(35))
    expect(f.atk).toBe(55)
    expect(f.def).toBe(40)
    const tanky = toFighter(SPECIES[888], 1.2)
    expect(tanky.maxHp).toBe(Math.round(hpPool(92) * 1.2))
  })
  test('伊布投射技 = 高速星星（一般 60 / 2.5s）', () => {
    const swift = SPECIES[133].moves[1]
    expect(swift.nameZh).toBe('高速星星')
    expect(swift.power).toBe(60)
    expect(swift.cooldownMs).toBe(2500)
  })
})

describe('genericMoves', () => {
  test('火屬性 → 噴射火焰', () => {
    const [melee, proj] = buildGenericMoves(['fire'])
    expect(melee.nameZh).toBe('撞擊')
    expect(proj.nameZh).toBe('噴射火焰')
    expect(proj.type).toBe('fire')
  })
  test('複合屬性用第一屬性：水/惡 → 水炮', () => {
    const [, proj] = buildGenericMoves(['water', 'dark'])
    expect(proj.nameZh).toBe('水炮')
    expect(proj.power).toBe(110)
  })
  test('一般屬性 fallback → 高速星星；空陣列亦然', () => {
    expect(buildGenericMoves(['normal'])[1].nameZh).toBe('高速星星')
    expect(buildGenericMoves([])[1].nameZh).toBe('高速星星')
  })
  test('18 屬性招牌技表：全屬性覆蓋、皆為投射、顏色齊備', () => {
    for (const t of Object.keys(TYPE_ZH)) {
      const mv = TYPE_MOVE[t as keyof typeof TYPE_MOVE]
      expect(mv).toBeDefined()
      expect(mv.kind).toBe('projectile')
      expect(mv.speed ?? 0).toBeGreaterThan(0)
      expect(mv.color).toMatch(/^#/)
    }
    expect(GENERIC_MELEE.kind).toBe('melee')
  })
})

describe('bosses', () => {
  test('八大戰場都有 BOSS，且 species 名單內', () => {
    for (const id of ARENA_IDS) {
      const dex = ARENA_BOSS[id]
      expect(dex).toBeGreaterThan(0)
      expect(getSpecies(dex)).not.toBeNull()
      const boss = bossFor(id)
      expect(boss.maxHp).toBeGreaterThan(0)
      expect(boss.moves).toHaveLength(2)
    }
  })
  test('世代對位：gen1 噴火龍、gen2 洛奇亞、gen8 蒼響', () => {
    expect(ARENA_BOSS.gen1).toBe(6)
    expect(ARENA_BOSS.gen2).toBe(249)
    expect(ARENA_BOSS.gen8).toBe(888)
  })
  test('高攻 BOSS 有 dmgScale 壓制；未調校 = 1', () => {
    expect(bossDmgScale(888)).toBe(BOSS_TUNING[888].dmgScale!)
    expect(bossDmgScale(888)).toBeLessThan(1)
    expect(bossDmgScale(6)).toBe(1)
  })
})
