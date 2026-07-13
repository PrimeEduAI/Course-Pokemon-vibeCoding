'use client'
// 瑪納羅大會（Gen 7）— 由 W3-B agent 實作。合約固定：default = Scenery、named = Floor（含碰撞地板）。
import Gen8Wyndon from './Gen8Wyndon'
import ArenaFloor from '../ArenaFloor'
import type { FieldType } from './types'

/** 瑪納羅大會 布景（天空/光照/看台/地標）— 暫以宮門替身，實作時整檔重寫 */
export default function Gen7Manalo() {
  return <Gen8Wyndon />
}

/** 戰鬥地板：碰撞範圍必須維持 40×24、頂面 y=0、四面圍牆 */
export function Gen7ManaloFloor(_props: { fieldType?: FieldType | null }) {
  return <ArenaFloor />
}
