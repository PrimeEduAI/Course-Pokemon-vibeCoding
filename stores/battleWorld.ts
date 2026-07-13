import { Vector3 } from 'three'

/** 連續動作狀態（每幀由 Player / EnemyFighter 寫入） */
export type MotionState = 'idle' | 'move' | 'ko'

/**
 * 非反應式動作頻道：戰鬥實體 → 模型層的骨骼動畫指令。
 * 連續狀態直接覆寫 state；一次性動作（攻擊 / 遠攻）寫 performance.now() 時間戳，
 * PokemonModel 在自己的 useFrame 比對上次消耗的時間戳來觸發。
 * hasKoClip 由 PokemonModel 回寫：目前掛載的 3D 模型有 down01 片段 → 外層不再做程序式翻倒。
 */
export interface MotionChannel {
  state: MotionState
  attackAt: number
  rangeAttackAt: number
  hasKoClip: boolean
}

const freshMotion = (): MotionChannel => ({ state: 'idle', attackAt: 0, rangeAttackAt: 0, hasKoClip: false })

/**
 * 非反應式的 3D 戰場共享狀態（每幀讀寫，不觸發 React 重繪）。
 * 位置為剛體中心；擊退向量由攻擊方寫入、被擊方在自己的 useFrame 消耗後歸零。
 */
export const battleWorld = {
  playerPos: new Vector3(0, 1, 6),
  enemyPos: new Vector3(0, 1.6, -6.5),
  /** 玩家目前面向（rotation.y） */
  playerFacing: 0,
  /** 受擊白閃截止時間（performance.now() 毫秒） */
  playerFlashUntil: 0,
  enemyFlashUntil: 0,
  /** 擊退速度向量（被擊方消耗） */
  playerKnock: new Vector3(),
  enemyKnock: new Vector3(),
  /** 骨骼動畫指令頻道 */
  playerMotion: freshMotion(),
  enemyMotion: freshMotion(),
}

export const PLAYER_SPAWN: [number, number, number] = [0, 1, 6]
export const ENEMY_SPAWN: [number, number, number] = [0, 1.6, -6.5]

export function resetWorld() {
  battleWorld.playerPos.set(...PLAYER_SPAWN)
  battleWorld.enemyPos.set(...ENEMY_SPAWN)
  battleWorld.playerFacing = 0
  battleWorld.playerFlashUntil = 0
  battleWorld.enemyFlashUntil = 0
  battleWorld.playerKnock.set(0, 0, 0)
  battleWorld.enemyKnock.set(0, 0, 0)
  // hasKoClip 跟著掛載中的模型走（由 PokemonModel effect 管理），reset 不清
  for (const m of [battleWorld.playerMotion, battleWorld.enemyMotion]) {
    m.state = 'idle'
    m.attackAt = 0
    m.rangeAttackAt = 0
  }
}
