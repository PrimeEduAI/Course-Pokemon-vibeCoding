import { CanvasTexture, LinearMipmapLinearFilter, NearestFilter, SRGBColorSpace } from 'three'

/**
 * 觀眾 sprite sheet（執行期 Canvas 生成）：
 * - 'gba'：GBA 主世界風的粗像素小人（12×16 邏輯像素，硬邊、NearestFilter）
 * - 'modern'：較高保真的迷你小人（24×32 邏輯像素，柔和陰影）
 * 4×4 = 16 個變體排在一張 384×512 的圖上；cell 96×128。
 */
export type CrowdStyle = 'gba' | 'modern'

export const SHEET_COLS = 4
export const SHEET_ROWS = 4
export const VARIANT_COUNT = SHEET_COLS * SHEET_ROWS

const CELL_W = 96
const CELL_H = 128

const SKINS = ['#f8c890', '#eeb87e', '#d09058', '#8a5a32']
const CAPS = ['#e02818', '#2848d0', '#18a048', '#f0a000', '#e8e8e8', '#181820']
const HAIRS = ['#402818', '#181818', '#a06020', '#d8c040', '#803018', '#4a4a52']
const SHIRTS = ['#f03030', '#3050e8', '#28b050', '#f0d020', '#f078b0', '#f4f4f4', '#30303e', '#f08828']
const PANTS = ['#283048', '#584838', '#906038', '#303030', '#1e4a8a']

/** 簡單決定性偽隨機（讓 sheet 每次生成一致） */
function rng(seed: number) {
  let s = seed * 2654435761 % 4294967296
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/** GBA 小人：12×16 邏輯像素，畫在 cell 內（放大 6 倍 = 72×96，置中貼底） */
function drawGbaPerson(g: CanvasRenderingContext2D, cx: number, cy: number, v: number) {
  const r = rng(v + 7)
  const S = 6
  const ox = cx + (CELL_W - 12 * S) / 2
  const oy = cy + (CELL_H - 16 * S)
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    g.fillStyle = color
    g.fillRect(ox + x * S, oy + y * S, w * S, h * S)
  }
  const skin = SKINS[(r() * SKINS.length) | 0]
  const shirt = SHIRTS[v % SHIRTS.length]
  const pant = PANTS[(r() * PANTS.length) | 0]
  const hasCap = v % 2 === 0
  const cap = CAPS[(v >> 1) % CAPS.length]
  const hair = HAIRS[(r() * HAIRS.length) | 0]

  // 頭：帽 or 髮（含 1px 輪廓感的深色頂）
  if (hasCap) {
    px(4, 0, 4, 1, cap)
    px(3, 1, 6, 1, cap)
    px(2, 2, 8, 1, cap) // 帽簷
    px(3, 3, 6, 1, skin)
  } else {
    px(4, 0, 4, 1, hair)
    px(3, 1, 6, 2, hair)
    px(3, 3, 6, 1, skin)
    px(3, 3, 1, 1, hair) // 鬢角
    px(8, 3, 1, 1, hair)
  }
  // 臉
  px(3, 4, 6, 3, skin)
  px(4, 4, 1, 1, '#141418') // 眼
  px(7, 4, 1, 1, '#141418')
  // 軀幹（衣服）
  px(2, 7, 8, 6, shirt)
  // 衣服簡單陰影邊
  g.fillStyle = 'rgba(0,0,0,0.18)'
  g.fillRect(ox + 2 * S, oy + 12 * S, 8 * S, 1 * S)
  // 手（膚色）
  px(2, 11, 1, 2, skin)
  px(9, 11, 1, 2, skin)
  // 腿
  px(3, 13, 2, 2, pant)
  px(7, 13, 2, 2, pant)
  // 鞋
  px(3, 15, 2, 1, '#20242c')
  px(7, 15, 2, 1, '#20242c')
}

/** 現代小人：用平滑形狀 + 漸層畫在 cell 內（頭圓、衣服漸層、有四肢） */
function drawModernPerson(g: CanvasRenderingContext2D, cx: number, cy: number, v: number) {
  const r = rng(v + 31)
  const skin = SKINS[(r() * SKINS.length) | 0]
  const shirt = SHIRTS[v % SHIRTS.length]
  const pant = PANTS[(r() * PANTS.length) | 0]
  const hair = HAIRS[(r() * HAIRS.length) | 0]
  const hasCap = v % 3 === 0
  const cap = CAPS[(v >> 1) % CAPS.length]
  const mx = cx + CELL_W / 2

  g.save()
  g.lineJoin = 'round'

  // 腿
  g.fillStyle = pant
  g.fillRect(mx - 13, cy + 92, 10, 28)
  g.fillRect(mx + 3, cy + 92, 10, 28)
  // 鞋
  g.fillStyle = '#23262e'
  g.fillRect(mx - 14, cy + 118, 12, 7)
  g.fillRect(mx + 2, cy + 118, 12, 7)

  // 軀幹（漸層衣服，肩窄腰寬的微梯形）
  const grad = g.createLinearGradient(mx - 18, cy + 50, mx + 14, cy + 95)
  grad.addColorStop(0, lighten(shirt, 0.25))
  grad.addColorStop(1, darken(shirt, 0.25))
  g.fillStyle = grad
  g.beginPath()
  g.moveTo(mx - 16, cy + 54)
  g.quadraticCurveTo(mx, cy + 46, mx + 16, cy + 54)
  g.lineTo(mx + 14, cy + 95)
  g.lineTo(mx - 14, cy + 95)
  g.closePath()
  g.fill()

  // 手臂（衣袖 + 手）
  g.strokeStyle = darken(shirt, 0.12)
  g.lineWidth = 8
  g.lineCap = 'round'
  const wave = v % 4 === 1 // 部分變體舉手歡呼
  g.beginPath()
  g.moveTo(mx - 15, cy + 58)
  if (wave) g.lineTo(mx - 24, cy + 36)
  else g.lineTo(mx - 20, cy + 84)
  g.stroke()
  g.beginPath()
  g.moveTo(mx + 15, cy + 58)
  g.lineTo(mx + 20, cy + 84)
  g.stroke()
  g.fillStyle = skin
  if (wave) g.fillRect(mx - 28, cy + 26, 9, 9)
  else g.fillRect(mx - 24, cy + 82, 9, 9)
  g.fillRect(mx + 16, cy + 82, 9, 9)

  // 頭（放最後蓋住肩線）：膚色 radial 漸層
  const hg = g.createRadialGradient(mx - 5, cy + 26, 3, mx, cy + 31, 17)
  hg.addColorStop(0, lighten(skin, 0.18))
  hg.addColorStop(1, darken(skin, 0.12))
  g.fillStyle = hg
  g.beginPath()
  g.arc(mx, cy + 31, 15, 0, Math.PI * 2)
  g.fill()
  // 髮 or 帽
  if (hasCap) {
    g.fillStyle = cap
    g.beginPath()
    g.arc(mx, cy + 28, 15.5, Math.PI, Math.PI * 2)
    g.fill()
    g.fillRect(mx - 17, cy + 24, 34, 5)
  } else {
    g.fillStyle = hair
    g.beginPath()
    g.arc(mx, cy + 28, 15.5, Math.PI * 0.92, Math.PI * 2.08)
    g.fill()
  }
  // 眼睛
  g.fillStyle = '#1a1a20'
  g.fillRect(mx - 7, cy + 32, 3, 3)
  g.fillRect(mx + 4, cy + 32, 3, 3)

  g.restore()
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function lighten(hex: string, f: number) {
  const [r, g, b] = hexToRgb(hex)
  return `rgb(${Math.min(255, r + (255 - r) * f) | 0},${Math.min(255, g + (255 - g) * f) | 0},${Math.min(255, b + (255 - b) * f) | 0})`
}
function darken(hex: string, f: number) {
  const [r, g, b] = hexToRgb(hex)
  return `rgb(${(r * (1 - f)) | 0},${(g * (1 - f)) | 0},${(b * (1 - f)) | 0})`
}

export function makeCrowdSheet(style: CrowdStyle): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = SHEET_COLS * CELL_W
  c.height = SHEET_ROWS * CELL_H
  const g = c.getContext('2d')!
  g.clearRect(0, 0, c.width, c.height)

  for (let v = 0; v < VARIANT_COUNT; v++) {
    const col = v % SHEET_COLS
    const row = (v / SHEET_COLS) | 0
    // three.js 預設 flipY：uv row 0 = 圖片底部 → 變體 row 0 畫在 canvas 底部
    const cx = col * CELL_W
    const cy = c.height - (row + 1) * CELL_H
    if (style === 'gba') drawGbaPerson(g, cx, cy, v)
    else drawModernPerson(g, cx, cy, v)
  }

  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  if (style === 'gba') {
    tex.magFilter = NearestFilter // 硬像素邊
    tex.minFilter = LinearMipmapLinearFilter
  }
  tex.anisotropy = 4
  return tex
}
