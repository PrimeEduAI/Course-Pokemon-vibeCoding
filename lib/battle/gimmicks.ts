/**
 * 世代招牌能力（Generation Signature Ability）純解析層：
 * 依「戰場世代 × 出戰圖鑑編號」決定發動的招牌機制 —— 羈絆爆發（Gen1–5）、
 * MEGA 進化（Gen6）、Z 招式（Gen7）、極巨化 / 超極巨化（Gen8）。
 * 純資料 + 純函式，無 DOM / three 相依，可直接 bun test。
 */

export type GimmickKind = 'bond' | 'mega' | 'zmove' | 'dynamax'

export interface GimmickDef {
  kind: GimmickKind
  nameZh: string
  /** 有對應 GLB 才給：mega → /assets/glb/mega/、gmax → /assets/glb/gmax/ */
  modelSwap?: 'mega' | 'gmax'
  /** 模型體型倍率（極巨化 2.3×；其餘微幅或 1） */
  scale: number
  /** 持續時間：MEGA = Infinity（整場）、Z 招式 = 演出窗口 */
  durationMs: number
  atkMult: number
  defMult: number
  /** 招式威力倍率（Z 招式的超彈用；由 combat 統一套用避免重複乘） */
  movePowerMult: number
}

// ---------------------------------------------------------------------------
// 能量計量（meter）常數：0–100，滿了才能按 R 發動；一場一次
// ---------------------------------------------------------------------------

export const METER_MAX = 100
/** 玩家 / AI 打中對手 */
export const METER_GAIN_DEALT = 8
/** 被打中 */
export const METER_GAIN_TAKEN = 5
/** 重擊（傷害 ≥60）加成 +50% */
export const HEAVY_METER_MULT = 1.5
/** AI 發動門檻：HP ≤50% 且 meter ≥60 */
export const ENEMY_GIMMICK_METER_MIN = 60
export const ENEMY_GIMMICK_HP_RATIO = 0.5

/** 單次命中的計量增益（dealt = 打中人、taken = 被打） */
export function meterGain(event: 'dealt' | 'taken', heavy: boolean): number {
  const base = event === 'dealt' ? METER_GAIN_DEALT : METER_GAIN_TAKEN
  return heavy ? base * HEAVY_METER_MULT : base
}

// ---------------------------------------------------------------------------
// 素材可用性：public/assets/glb/{mega,gmax}/ 實際存在的圖鑑編號
// （client 端不能 fs，故硬編碼；scripts 若補模型記得同步這兩張表）
// ---------------------------------------------------------------------------

export const MEGA_DEX_IDS: readonly number[] = [
  3, 15, 18, 65, 80, 94, 115, 121, 127, 130, 142, 160, 181, 208, 212, 214,
  227, 229, 248, 254, 257, 260, 282, 302, 303, 306, 308, 310, 319, 323, 334, 354,
  359, 362, 373, 376, 380, 381, 384, 428, 445, 448, 460, 475, 491, 530, 531, 604,
  652, 655, 658, 670, 718, 719, 720, 807,
]

export const GMAX_DEX_IDS: readonly number[] = [3, 6, 9, 12, 25, 52, 68, 131, 842, 870]

export const hasMegaModel = (dexId: number): boolean => MEGA_DEX_IDS.includes(dexId)
export const hasGmaxModel = (dexId: number): boolean => GMAX_DEX_IDS.includes(dexId)

/** 招牌能力對應的 GLB 路徑（無 modelSwap 回 null） */
export function gimmickModelUrl(def: GimmickDef, dexId: number): string | null {
  return def.modelSwap ? `/assets/glb/${def.modelSwap}/${dexId}.glb` : null
}

// ---------------------------------------------------------------------------
// 解析：戰場世代 → 招牌能力
// ---------------------------------------------------------------------------

/** Z 招式演出窗口：1.2s 蓄力 + 超彈飛行 + 收尾 */
export const ZMOVE_CHARGE_MS = 1200
export const ZMOVE_WINDOW_MS = 2600

export function resolveGimmick(arenaGen: number, dexId: number): GimmickDef {
  if (arenaGen === 6) {
    const swap = hasMegaModel(dexId)
    return {
      kind: 'mega',
      nameZh: swap ? 'MEGA 進化' : 'MEGA 進化力',
      modelSwap: swap ? 'mega' : undefined,
      scale: 1.12,
      durationMs: Infinity, // 整場
      atkMult: 1.3,
      defMult: 1.2,
      movePowerMult: 1,
    }
  }
  if (arenaGen === 7) {
    return {
      kind: 'zmove',
      nameZh: 'Z 招式',
      scale: 1,
      durationMs: ZMOVE_WINDOW_MS,
      atkMult: 1,
      defMult: 1,
      movePowerMult: 2.6,
    }
  }
  if (arenaGen >= 8) {
    const gmax = hasGmaxModel(dexId)
    return {
      kind: 'dynamax',
      nameZh: gmax ? '超極巨化' : '極巨化',
      modelSwap: gmax ? 'gmax' : undefined,
      scale: 2.3,
      durationMs: 18000,
      atkMult: 1.35,
      defMult: 1,
      movePowerMult: 1,
    }
  }
  // Gen 1–5（含未知世代保底）：羈絆爆發
  return {
    kind: 'bond',
    nameZh: '羈絆爆發',
    scale: 1.06,
    durationMs: 12000,
    atkMult: 1.4,
    defMult: 1,
    movePowerMult: 1,
  }
}
