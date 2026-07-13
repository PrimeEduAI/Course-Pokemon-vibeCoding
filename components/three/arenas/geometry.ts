import { BufferGeometry, Float32BufferAttribute } from 'three'

export const SEG = 96

/** 橢圓環面（內圈→外圈，可含高低差），用於看台斜面 / 立面牆 */
export function ellipseRing(
  aIn: number, bIn: number, yIn: number,
  aOut: number, bOut: number, yOut: number,
  seg = SEG,
): BufferGeometry {
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= seg; i++) {
    const t = (i / seg) * Math.PI * 2
    const cos = Math.cos(t)
    const sin = Math.sin(t)
    pos.push(cos * aIn, yIn, sin * bIn)
    pos.push(cos * aOut, yOut, sin * bOut)
  }
  for (let i = 0; i < seg; i++) {
    const k = i * 2
    idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2)
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

/** 看台層規格：內圈半徑、底高、進深、爬升、排數 */
export type Tier = { aIn: number; bIn: number; yBase: number; depth: number; rise: number; rows: number }
