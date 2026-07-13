import type { ArenaId } from '@/components/three/arenas/types'
import { SPECIES, toFighter, type FighterDef } from './species'

/** 各世代戰場的 BOSS＝該世代最具代表性的寶可夢 */
export const ARENA_BOSS: Record<ArenaId, number> = {
  gen1: 6,    // 噴火龍
  gen2: 249,  // 洛奇亞
  gen3: 384,  // 烈空坐
  gen4: 448,  // 路卡利歐
  gen5: 643,  // 雷希拉姆
  gen6: 658,  // 甲賀忍蛙
  gen7: 791,  // 索爾迦雷歐
  gen8: 888,  // 蒼響
}

/**
 * 每隻 BOSS 的體感微調：
 * - hpScale：HP 池縮放（預設 1.0 —— 真實種族值已經夠坦）
 * - dmgScale：在全域 ENEMY_DAMAGE_SCALE 0.45 之上再乘（高攻 BOSS 用皮卡丘打會被兩拳帶走 → 壓回 3~4 拳節奏）
 */
export const BOSS_TUNING: Record<number, { hpScale?: number; dmgScale?: number }> = {
  384: { dmgScale: 0.6 },  // 烈空坐 atk150：龍爪原 90/拳 → 54
  643: { dmgScale: 0.55 }, // 雷希拉姆：青焰原 117 → 64
  791: { dmgScale: 0.65 }, // 索爾迦雷歐 atk137：鐵頭功原 82 → 53
  888: { dmgScale: 0.5 },  // 蒼響 atk130：巨獸斬原 97 → 48
}

/** BOSS 追加傷害縮放（不在名單 = 1.0） */
export function bossDmgScale(dexId: number): number {
  return BOSS_TUNING[dexId]?.dmgScale ?? 1
}

/** 指定戰場的 BOSS FighterDef（含 hpScale） */
export function bossFor(arenaId: ArenaId): FighterDef {
  const dexId = ARENA_BOSS[arenaId]
  const species = SPECIES[dexId]
  if (!species) throw new Error(`missing boss species for ${arenaId} (#${dexId})`)
  return toFighter(species, BOSS_TUNING[dexId]?.hpScale ?? 1)
}
