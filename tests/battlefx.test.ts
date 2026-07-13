import { describe, expect, test } from 'bun:test'
import { MOVES, MOVE_VISUAL_IDS, type MoveVisualId } from '@/lib/battle/moves'
import { SPECIES, SPECIES_MOVES } from '@/lib/battle/species'
import { TYPE_MOVE } from '@/lib/battle/genericMoves'
import { LAUNCH_SOUND } from '@/lib/sfx'

const isVisual = (v: unknown): v is MoveVisualId => MOVE_VISUAL_IDS.includes(v as MoveVisualId)

describe('招式視覺樣式（visual）覆蓋率', () => {
  test('手工出戰名單：每個投射技都有合法 visual', () => {
    for (const s of Object.values(SPECIES)) {
      const proj = s.moves[1]
      expect(proj.kind).toBe('projectile')
      expect(isVisual(proj.visual)).toBe(true)
    }
  })

  test('SPECIES_MOVES：所有投射技都有 visual、近戰不需要', () => {
    for (const m of Object.values(SPECIES_MOVES)) {
      if (m.kind === 'projectile') expect(isVisual(m.visual)).toBe(true)
    }
  })

  test('TYPE_MOVE（18 屬性通用技）：全部有合法 visual', () => {
    for (const m of Object.values(TYPE_MOVE)) {
      expect(isVisual(m.visual)).toBe(true)
    }
  })

  test('招牌招式對到指定樣式：十萬伏特=bolt、高速星星=stars、氣旋攻擊=wind、水手裏劍=shuriken、青焰=flame、月亮之力=moon', () => {
    expect(MOVES.thunderbolt.visual).toBe('bolt')
    expect(SPECIES_MOVES.swift.visual).toBe('stars')
    expect(SPECIES_MOVES.aeroblast.visual).toBe('wind')
    expect(SPECIES_MOVES.waterShuriken.visual).toBe('shuriken')
    expect(SPECIES_MOVES.blueFlare.visual).toBe('flame')
    expect(SPECIES_MOVES.moonblast.visual).toBe('moon')
    expect(TYPE_MOVE.rock.visual).toBe('rock')
    expect(TYPE_MOVE.ice.visual).toBe('beam')
  })

  test('曾經同模組的兩招現在分家：十萬伏特 vs 高速星星 樣式不同', () => {
    expect(MOVES.thunderbolt.visual).not.toBe(SPECIES_MOVES.swift.visual)
  })
})

describe('發射音效對照表', () => {
  test('每種視覺樣式都有發射音', () => {
    for (const id of MOVE_VISUAL_IDS) {
      expect(LAUNCH_SOUND[id]).toBeTruthy()
    }
  })

  test('發射音不共用同一個（每種樣式專屬）', () => {
    const sounds = Object.values(LAUNCH_SOUND)
    expect(new Set(sounds).size).toBe(sounds.length)
  })
})

describe('sfx 模組在無音訊環境安全', () => {
  test('import 不需要 window；播放函式為 no-op 不丟例外', async () => {
    const sfx = await import('@/lib/sfx')
    expect(() => {
      sfx.sfxZap()
      sfx.sfxImpact(true)
      sfx.sfxSuperEffective()
      sfx.sfxKo()
      sfx.sfxFanfare()
      sfx.playLaunch('stars')
      sfx.playLaunch(undefined)
      sfx.unlockAudio()
    }).not.toThrow()
    expect(sfx.audioState()).toBe('none')
  })
})
