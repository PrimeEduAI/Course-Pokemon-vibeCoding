import { CanvasTexture } from 'three'

/** 放射狀光暈貼圖（加法混合 sprite 用），快取單例 */
let cached: CanvasTexture | null = null
export function getGlowTexture(): CanvasTexture {
  if (cached) return cached
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.25, 'rgba(255,255,255,0.65)')
  grad.addColorStop(0.6, 'rgba(255,255,255,0.18)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  cached = new CanvasTexture(c)
  return cached
}
