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
