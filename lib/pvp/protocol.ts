import type { ArenaId, FieldType } from '@/components/three/arenas/types'
import type { FighterDef } from '@/lib/battle/species'
import type { StatusKind } from '@/lib/battle/status'
import type { MotionState } from '@/stores/battleWorld'

/**
 * PvP 連線協定（好友對戰）：
 * - 拓撲：兩個玩家連上同一台 Bun WebSocket relay（server/pvp-server.ts），4 碼房號配對。
 * - 同步模型：自己的角色自己模擬（零延遲手感），20Hz 廣播狀態快照；招式走事件。
 * - 傷害權威：被打的那方自己算（hitA 嘗試 → 守方驗證疾走 i-frames、算傷害 → hitC 回報）。
 * - 座標鏡像：雙方都把自己當「南側玩家」，送出前把座標/朝向鏡像（x,z 取負、yaw+π），
 *   對方收到即為自己世界座標系裡的敵方位置。
 */

export const PVP_DEFAULT_PORT = 3412

export type Vec3 = [number, number, number]

/** 座標鏡像：繞原點水平翻轉（雙方各自認為自己站南側）；+0 正規化避免 -0 */
export const mirrorVec3 = (v: Vec3): Vec3 => [-v[0] + 0, v[1], -v[2] + 0]

/** 朝向鏡像：yaw + π，收斂回 (-π, π] */
export const mirrorYaw = (yaw: number): number => {
  const y = yaw + Math.PI
  return y > Math.PI ? y - Math.PI * 2 : y
}

// ---------------------------------------------------------------------------
// 遊戲訊息（經 relay 盲轉發給同房另一位玩家）
// ---------------------------------------------------------------------------

/** 房主選定戰場（含 gen1–3 的隨機場地型別，客隊照單全收） */
export interface ConfigMsg { g: 'config'; arena: ArenaId; fieldType: FieldType | null }
/** 出戰寶可夢（送完整 FighterDef：收藏寶可夢對方本地可能沒有資料） */
export interface FighterMsg { g: 'fighter'; fighter: FighterDef }
/** 20Hz 狀態快照（座標已鏡像；hp/meter 為己方權威值，對方 HUD 直接採用） */
export interface SnapMsg { g: 'snap'; p: Vec3; f: number; m: MotionState; hp: number; meter: number; used: boolean }
/** 近戰揮擊（動畫 + 斬擊特效；是否命中另走 hitA） */
export interface SwingMsg { g: 'swing' }
/** 投射出膛（對方生成純視覺彈體；傷害由 hitA 事件送達） */
export interface ShotMsg { g: 'shot'; moveId: string; origin: Vec3; dir: Vec3; scale?: number }
/** 攻方判定命中 → 請守方結算（守方驗 i-frames、算傷害） */
export interface HitAttemptMsg { g: 'hitA'; moveId: string }
/** 守方結算完成 → 攻方顯示傷害數字 / 特效 / 計量 */
export interface HitConfirmMsg { g: 'hitC'; dmg: number; mult: number; statusKind?: StatusKind }
/** 發動世代招牌能力（對方以 resolveGimmick 重建同一個定義） */
export interface GimmickMsg { g: 'gimmick' }
/** 再戰一場（任一方按下 → 雙方各自 reset） */
export interface RematchMsg { g: 'rematch' }

export type GameMsg =
  | ConfigMsg | FighterMsg | SnapMsg | SwingMsg | ShotMsg
  | HitAttemptMsg | HitConfirmMsg | GimmickMsg | RematchMsg

// ---------------------------------------------------------------------------
// 客戶端 ↔ relay 控制訊息
// ---------------------------------------------------------------------------

export type ClientMsg =
  | { t: 'create' }
  | { t: 'join'; room: string }
  | { t: 'msg'; d: GameMsg }

export type PvpErrorCode = 'room-not-found' | 'room-full' | 'bad-request'

export type ServerMsg =
  | { t: 'created'; room: string }
  | { t: 'joined'; room: string }
  | { t: 'peer-joined' }
  | { t: 'peer-left' }
  | { t: 'msg'; d: GameMsg }
  | { t: 'error'; code: PvpErrorCode }

/** 伺服器位址 → ws URL（沒寫 port 就補預設 3412） */
export const wsUrl = (addr: string): string => {
  const trimmed = addr.trim()
  const hostport = trimmed.includes(':') ? trimmed : `${trimmed}:${PVP_DEFAULT_PORT}`
  return `ws://${hostport}`
}
