import { Vector3 } from 'three'

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
}
