import { beforeEach, describe, expect, test } from 'bun:test'
import {
  ENEMY_GIMMICK_HP_RATIO, ENEMY_GIMMICK_METER_MIN, GMAX_DEX_IDS, MEGA_DEX_IDS, METER_MAX,
  ZMOVE_WINDOW_MS, gimmickModelUrl, hasGmaxModel, hasMegaModel, meterGain, resolveGimmick,
} from '@/lib/battle/gimmicks'
import { useBattle } from '@/stores/useBattle'

describe('resolveGimmick：世代 → 招牌能力', () => {
  test('gen1–5 → 羈絆爆發（12s、atk×1.4、無模型換裝）', () => {
    for (const gen of [1, 2, 3, 4, 5]) {
      const g = resolveGimmick(gen, 25)
      expect(g.kind).toBe('bond')
      expect(g.nameZh).toBe('羈絆爆發')
      expect(g.durationMs).toBe(12000)
      expect(g.atkMult).toBe(1.4)
      expect(g.modelSwap).toBeUndefined()
    }
  })

  test('gen6 + 有 mega 模型（路卡利歐 448）→ MEGA 進化 + 模型換裝、整場有效', () => {
    const g = resolveGimmick(6, 448)
    expect(g.kind).toBe('mega')
    expect(g.nameZh).toBe('MEGA 進化')
    expect(g.modelSwap).toBe('mega')
    expect(g.durationMs).toBe(Infinity)
    expect(g.atkMult).toBe(1.3)
    expect(g.defMult).toBe(1.2)
    expect(gimmickModelUrl(g, 448)).toBe('/assets/glb/mega/448.glb')
  })

  test('gen6 + 無 mega 模型（皮卡丘 25）→ 退化為「MEGA 進化力」氣場、加成相同', () => {
    const g = resolveGimmick(6, 25)
    expect(g.kind).toBe('mega')
    expect(g.nameZh).toBe('MEGA 進化力')
    expect(g.modelSwap).toBeUndefined()
    expect(g.atkMult).toBe(1.3)
    expect(gimmickModelUrl(g, 25)).toBeNull()
  })

  test('gen7 → Z 招式（一次性演出窗口、威力 ×2.6、必中彈由 FX 結算）', () => {
    const g = resolveGimmick(7, 791)
    expect(g.kind).toBe('zmove')
    expect(g.movePowerMult).toBe(2.6)
    expect(g.durationMs).toBe(ZMOVE_WINDOW_MS)
    expect(g.atkMult).toBe(1)
  })

  test('gen8 + 有 gmax 模型（皮卡丘 25）→ 超極巨化 + gmax 換裝 ×2.3', () => {
    const g = resolveGimmick(8, 25)
    expect(g.kind).toBe('dynamax')
    expect(g.nameZh).toBe('超極巨化')
    expect(g.modelSwap).toBe('gmax')
    expect(g.scale).toBe(2.3)
    expect(g.atkMult).toBe(1.35)
    expect(g.durationMs).toBe(18000)
    expect(gimmickModelUrl(g, 25)).toBe('/assets/glb/gmax/25.glb')
  })

  test('gen8 + 無 gmax 模型（蒼響 888 / 伊布 133）→ 一般極巨化：只放大不換模', () => {
    for (const dex of [888, 133]) {
      const g = resolveGimmick(8, dex)
      expect(g.kind).toBe('dynamax')
      expect(g.nameZh).toBe('極巨化')
      expect(g.modelSwap).toBeUndefined()
      expect(g.scale).toBe(2.3)
    }
  })

  test('未知世代（0 / undefined 補 1）保底羈絆爆發', () => {
    expect(resolveGimmick(0, 25).kind).toBe('bond')
  })
})

describe('模型可用性表', () => {
  test('mega 表 = 56 隻、含招牌組（448/94/130/282）、不含雙 mega 缺檔（6/150/9）', () => {
    expect(MEGA_DEX_IDS.length).toBe(56)
    for (const dex of [448, 94, 130, 282, 3, 384]) expect(hasMegaModel(dex)).toBe(true)
    for (const dex of [6, 150, 9, 25]) expect(hasMegaModel(dex)).toBe(false)
  })
  test('gmax 表 = 10 隻（3/6/9/12/25/52/68/131/842/870）', () => {
    expect([...GMAX_DEX_IDS]).toEqual([3, 6, 9, 12, 25, 52, 68, 131, 842, 870])
    expect(hasGmaxModel(25)).toBe(true)
    expect(hasGmaxModel(888)).toBe(false)
  })
})

describe('meterGain：計量增益', () => {
  test('打中 +14、被打 +9；重擊 ×1.5（約 4–6 次命中集滿）', () => {
    expect(meterGain('dealt', false)).toBe(14)
    expect(meterGain('taken', false)).toBe(9)
    expect(meterGain('dealt', true)).toBe(21)
    expect(meterGain('taken', true)).toBe(13.5)
    // 全普通命中 8 次內必滿；重擊參與更快
    expect(Math.ceil(METER_MAX / meterGain('dealt', false))).toBeLessThanOrEqual(8)
  })
  test('AI 發動門檻常數：HP ≤50%、meter ≥60', () => {
    expect(ENEMY_GIMMICK_HP_RATIO).toBe(0.5)
    expect(ENEMY_GIMMICK_METER_MIN).toBe(60)
    expect(METER_MAX).toBe(100)
  })
})

describe('useBattle：招牌能力狀態機', () => {
  beforeEach(() => {
    useBattle.getState().reset()
  })

  test('gainMeter 累積並夾在 0–100', () => {
    const st = useBattle.getState()
    st.gainMeter('player', 8)
    st.gainMeter('player', 12)
    expect(useBattle.getState().playerGimmick.meter).toBe(20)
    st.gainMeter('player', 999)
    expect(useBattle.getState().playerGimmick.meter).toBe(100)
  })

  test('玩家計量未滿不能發動；滿了發動 → 清空計量、標記已用、一場一次', () => {
    const st = useBattle.getState()
    const def = resolveGimmick(8, 25)
    expect(st.tryActivateGimmick('player', def, 1000)).toBe(false)
    st.gainMeter('player', 100)
    expect(st.tryActivateGimmick('player', def, 1000)).toBe(true)
    const g = useBattle.getState().playerGimmick
    expect(g.meter).toBe(0)
    expect(g.used).toBe(true)
    expect(g.active?.kind).toBe('dynamax')
    expect(g.activatedAt).toBe(1000)
    expect(g.endsAt).toBe(1000 + 18000)
    // 二度發動失敗；已用後計量不再累積
    expect(st.tryActivateGimmick('player', def, 2000)).toBe(false)
    st.gainMeter('player', 50)
    expect(useBattle.getState().playerGimmick.meter).toBe(0)
  })

  test('敵方（AI）發動不受 meter=100 限制（門檻由 AI 端把關）；MEGA endsAt = Infinity', () => {
    const st = useBattle.getState()
    st.gainMeter('enemy', ENEMY_GIMMICK_METER_MIN)
    const def = resolveGimmick(6, 448)
    expect(st.tryActivateGimmick('enemy', def, 500)).toBe(true)
    expect(useBattle.getState().enemyGimmick.endsAt).toBe(Infinity)
  })

  test('expireGimmick 收掉發動狀態、保留已用標記；reset 全部歸零', () => {
    const st = useBattle.getState()
    st.gainMeter('player', 100)
    st.tryActivateGimmick('player', resolveGimmick(2, 25), 0)
    st.expireGimmick('player')
    let g = useBattle.getState().playerGimmick
    expect(g.active).toBeNull()
    expect(g.used).toBe(true)
    useBattle.getState().reset()
    g = useBattle.getState().playerGimmick
    expect(g.meter).toBe(0)
    expect(g.used).toBe(false)
    expect(g.active).toBeNull()
  })
})
