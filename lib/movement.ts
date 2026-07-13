export interface KeyState { forward: boolean; backward: boolean; left: boolean; right: boolean }

/** 方向鍵狀態 → 正規化的 XZ 平面移動向量（-Z 為前方） */
export function dirFromKeys(k: KeyState): [number, number] {
  const x = (k.right ? 1 : 0) - (k.left ? 1 : 0)
  const z = (k.backward ? 1 : 0) - (k.forward ? 1 : 0)
  const len = Math.hypot(x, z)
  return len === 0 ? [0, 0] : [x / len, z / len]
}

/** 待機上下浮動：t 秒時的 Y 值 */
export function idleBob(t: number, baseY: number, amplitude: number): number {
  return baseY + Math.sin(t * 2.4) * amplitude
}

/**
 * 依鏡頭 yaw 旋轉 XZ 平面輸入向量，使「前進」永遠是遠離鏡頭的方向。
 * yaw 0 為單位運算；配合 Player 以 (yaw - π) 呼叫，讓預設視角下的行為與改動前完全一致。
 */
export function rotateDirByYaw(x: number, z: number, yaw: number): [number, number] {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  return [x * c + z * s, -x * s + z * c]
}

/** (fromX,fromZ) 指向 (toX,toZ) 的朝向角（與 playerFacing 同慣例：方向向量 = (sin yaw, cos yaw)） */
export function yawBetween(fromX: number, fromZ: number, toX: number, toZ: number): number {
  return Math.atan2(toX - fromX, toZ - fromZ)
}

/**
 * 鎖定視角的移動映射：W = 朝敵人、S = 遠離、A/D = 繞敵側移。
 * dirFromKeys 的「前」是 (0,-1)，因此以 (yawToEnemy + π) 旋轉即可讓前進對準敵人。
 */
export function lockOnDir(x: number, z: number, yawToEnemy: number): [number, number] {
  return rotateDirByYaw(x, z, yawToEnemy + Math.PI)
}

/** 角度插值（取最短路徑），t ∈ [0,1] */
export function lerpAngle(a: number, b: number, t: number): number {
  const TWO_PI = Math.PI * 2
  let d = (b - a) % TWO_PI
  if (d > Math.PI) d -= TWO_PI
  if (d < -Math.PI) d += TWO_PI
  return a + d * t
}
