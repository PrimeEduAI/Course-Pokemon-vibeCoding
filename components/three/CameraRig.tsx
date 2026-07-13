'use client'
import { useRef } from 'react'
import { Vector3, type Camera } from 'three'
import { battleWorld } from '@/stores/battleWorld'

/** 錨點（注視點）在角色上方的高度 */
export const ANCHOR_Y = 1.1

/** 鏡頭基準距離 / 抬高（world 單位） */
const CAM_DIST = 5.2
const CAM_UP = 2.5
/** 雙方貼近（<3）時把鏡頭拉遠一點，避免穿進 BOSS 模型 */
const CLOSE_DIST = 3
const CLOSE_EXTRA = 1.2
/** 注視點偏向敵人的比例：0 = 只看玩家、1 = 只看敵人 */
const LOOK_BIAS = 0.55
/** 位置 / 注視點的每幀 lerp 係數 */
const POS_LERP = 0.08
const LOOK_LERP = 0.12
/** 勝負底定後的慢速環繞（rad/s） */
const END_DRIFT = 0.14

/**
 * 鎖定鏡頭（無滑鼠）：永遠站在「玩家背對敵人」的延長線上——
 * back = normalize(playerPos - enemyPos)，鏡頭 = 玩家錨點 + back·dist + 抬高，
 * 注視點偏向敵人（LOOK_BIAS），讓雙方同框且敵人恆在畫面中心附近。
 * 戰鬥結束（victory / defeat）改為繞著結尾構圖緩慢漂移，不做任何跳切。
 */
export function useLockOnCamera() {
  const back = useRef(new Vector3(0, 0, 1))
  const extra = useRef(0)
  const look = useRef(new Vector3(0, ANCHOR_Y, 0))
  const initialized = useRef(false)
  const tmp = useRef({ desired: new Vector3(), lookDesired: new Vector3(), pAnchor: new Vector3(), eAnchor: new Vector3() })

  /** 每幀呼叫；locked = 戰鬥進行中（false = 勝負底定 → 慢速漂移） */
  const update = (camera: Camera, dt: number, locked: boolean) => {
    const { desired, lookDesired, pAnchor, eAnchor } = tmp.current
    const p = battleWorld.playerPos
    const e = battleWorld.enemyPos
    pAnchor.set(p.x, p.y + ANCHOR_Y, p.z)
    eAnchor.copy(e)

    const dx = p.x - e.x
    const dz = p.z - e.z
    const distXZ = Math.hypot(dx, dz)
    if (locked) {
      if (distXZ > 0.001) back.current.set(dx / distXZ, 0, dz / distXZ)
    } else {
      // 結尾運鏡：沿用最後的 back 方向緩慢環繞
      back.current.applyAxisAngle(UP, END_DRIFT * dt)
    }

    // 近身時緩緩拉遠
    const wantExtra = distXZ < CLOSE_DIST ? CLOSE_EXTRA : 0
    extra.current += (wantExtra - extra.current) * Math.min(1, dt * 4)
    const dist = CAM_DIST + extra.current

    desired.set(
      pAnchor.x + back.current.x * dist,
      Math.max(0.4, pAnchor.y + CAM_UP), // y 夾住 ≥0.4，避免鑽地
      pAnchor.z + back.current.z * dist,
    )
    lookDesired.copy(pAnchor).lerp(eAnchor, LOOK_BIAS)

    if (!initialized.current) {
      initialized.current = true
      camera.position.copy(desired)
      look.current.copy(lookDesired)
    } else {
      camera.position.lerp(desired, POS_LERP)
      look.current.lerp(lookDesired, LOOK_LERP)
    }
    camera.lookAt(look.current)
  }

  return { update }
}

const UP = new Vector3(0, 1, 0)
