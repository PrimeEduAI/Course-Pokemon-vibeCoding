import { CanvasTexture, ClampToEdgeWrapping } from 'three'

/** 光束漸層 alpha 貼圖：v=0（光源端）亮 → v=1（遠端）透明 */
let cached: CanvasTexture | null = null
export function getBeamAlphaMap(): CanvasTexture {
  if (cached) return cached
  const c = document.createElement('canvas')
  c.width = 2
  c.height = 128
  const g = c.getContext('2d')!
  // flipY=true：canvas 底部 = v0
  const grad = g.createLinearGradient(0, 0, 0, 128)
  grad.addColorStop(0, '#000000') // v=1 遠端
  grad.addColorStop(0.55, '#5a5a5a')
  grad.addColorStop(1, '#ffffff') // v=0 光源端
  g.fillStyle = grad
  g.fillRect(0, 0, 2, 128)
  cached = new CanvasTexture(c)
  cached.wrapS = ClampToEdgeWrapping
  cached.wrapT = ClampToEdgeWrapping
  return cached
}
