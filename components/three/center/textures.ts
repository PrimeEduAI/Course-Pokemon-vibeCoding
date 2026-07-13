import { CanvasTexture, SRGBColorSpace } from 'three'

/** Client-only canvas texture factory + 單例快取（同一貼圖只畫一次） */
const cache = new Map<string, CanvasTexture>()

function make(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const hit = cache.get(key)
  if (hit) return hit
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  draw(ctx, w, h)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  cache.set(key, tex)
  return tex
}

function drawPokeball(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, stroke: string, lineW: number, fill?: string) {
  ctx.save()
  ctx.lineWidth = lineW
  ctx.strokeStyle = stroke
  if (fill) {
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx - r, cy)
  ctx.lineTo(cx - r * 0.34, cy)
  ctx.moveTo(cx + r * 0.34, cy)
  ctx.lineTo(cx + r, cy)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.34, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.14, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

/** 卡背：深藍面板 + 金色寶貝球徽章（圖片載入失敗時的優雅替代） */
export function cardBackTexture() {
  return make('cardback', 512, 712, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, '#141b3c')
    g.addColorStop(0.55, '#0d1128')
    g.addColorStop(1, '#171233')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    // 內框
    ctx.strokeStyle = 'rgba(224, 178, 92, 0.85)'
    ctx.lineWidth = 6
    ctx.strokeRect(22, 22, w - 44, h - 44)
    ctx.strokeStyle = 'rgba(224, 178, 92, 0.30)'
    ctx.lineWidth = 2
    ctx.strokeRect(38, 38, w - 76, h - 76)
    // 角落斜線裝飾
    ctx.strokeStyle = 'rgba(224, 178, 92, 0.5)'
    ctx.lineWidth = 3
    for (const [x, y, dx, dy] of [[38, 38, 1, 1], [w - 38, 38, -1, 1], [38, h - 38, 1, -1], [w - 38, h - 38, -1, -1]] as const) {
      ctx.beginPath()
      ctx.moveTo(x + dx * 50, y)
      ctx.lineTo(x, y)
      ctx.lineTo(x, y + dy * 50)
      ctx.stroke()
    }
    // 中央金色寶貝球
    const grad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, 190)
    grad.addColorStop(0, 'rgba(255, 208, 110, 0.22)')
    grad.addColorStop(1, 'rgba(255, 208, 110, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
    drawPokeball(ctx, w / 2, h / 2, 128, '#e4b45e', 10)
    ctx.fillStyle = '#e4b45e'
    ctx.font = 'bold 34px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('COLLECTION', w / 2, h - 92)
    ctx.font = '20px Georgia, serif'
    ctx.fillStyle = 'rgba(228, 180, 94, 0.65)'
    ctx.fillText('P O K É M O N  T C G', w / 2, h - 62)
  })
}

/** 幽靈框：虛線玻璃 + 淡寶貝球浮水印 + 發光問號（空收藏佔位） */
export function ghostSlotTexture() {
  return make('ghost', 512, 712, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    // 微弱玻璃底
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, 'rgba(150, 180, 235, 0.10)')
    g.addColorStop(1, 'rgba(90, 110, 190, 0.05)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.roundRect(14, 14, w - 28, h - 28, 26)
    ctx.fill()
    // 虛線邊框
    ctx.setLineDash([26, 18])
    ctx.lineWidth = 6
    ctx.strokeStyle = 'rgba(170, 200, 255, 0.45)'
    ctx.beginPath()
    ctx.roundRect(14, 14, w - 28, h - 28, 26)
    ctx.stroke()
    ctx.setLineDash([])
    // 寶貝球浮水印
    drawPokeball(ctx, w / 2, h / 2 - 30, 120, 'rgba(160, 190, 250, 0.16)', 9)
    // 發光問號
    ctx.shadowColor = 'rgba(150, 200, 255, 0.9)'
    ctx.shadowBlur = 38
    ctx.fillStyle = 'rgba(205, 226, 255, 0.85)'
    ctx.font = 'bold 130px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('?', w / 2, h / 2 + 18)
    ctx.shadowBlur = 0
    ctx.font = '26px Georgia, serif'
    ctx.fillStyle = 'rgba(170, 200, 255, 0.4)'
    ctx.fillText('E M P T Y  S L O T', w / 2, h - 74)
  })
}

/** 夜窗：拱形夜空 + 星星 + 月光，含窗框（一張貼圖 = 一個 mesh） */
export function nightWindowTexture() {
  return make('window', 256, 448, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    const frame = 16
    const arcR = w / 2 - frame
    // 拱形裁切
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(frame, h - frame)
    ctx.lineTo(frame, frame + arcR)
    ctx.arc(w / 2, frame + arcR, arcR, Math.PI, 0)
    ctx.lineTo(w - frame, h - frame)
    ctx.closePath()
    ctx.clip()
    // 夜空漸層
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#101a44')
    g.addColorStop(0.55, '#182456')
    g.addColorStop(1, '#2a2c52')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    // 月亮
    ctx.shadowColor = 'rgba(235, 240, 255, 0.9)'
    ctx.shadowBlur = 30
    ctx.fillStyle = '#f4f2e2'
    ctx.beginPath()
    ctx.arc(w * 0.68, h * 0.2, 20, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    // 星星
    let seed = 7
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    for (let i = 0; i < 70; i++) {
      const x = rand() * w
      const y = rand() * h * 0.8
      const r = rand() * 1.6 + 0.4
      ctx.fillStyle = `rgba(255, 255, 255, ${0.35 + rand() * 0.6})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    // 遠處城市剪影
    ctx.fillStyle = '#0b0f24'
    for (let i = 0; i < 9; i++) {
      const bw = 18 + rand() * 22
      const bh = 30 + rand() * 60
      const bx = i * (w / 9)
      ctx.fillRect(bx, h - bh, bw, bh)
      ctx.fillStyle = '#0b0f24'
    }
    ctx.restore()
    // 窗框
    ctx.strokeStyle = '#e8dcc8'
    ctx.lineWidth = 12
    ctx.beginPath()
    ctx.moveTo(frame, h - frame + 2)
    ctx.lineTo(frame, frame + arcR)
    ctx.arc(w / 2, frame + arcR, arcR, Math.PI, 0)
    ctx.lineTo(w - frame, h - frame + 2)
    ctx.stroke()
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.moveTo(frame, h - frame)
    ctx.lineTo(w - frame, h - frame)
    ctx.stroke()
    // 十字窗櫺
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(w / 2, frame)
    ctx.lineTo(w / 2, h - frame)
    ctx.moveTo(frame, h * 0.5)
    ctx.lineTo(w - frame, h * 0.5)
    ctx.stroke()
  })
}

/** 柔光柱：由上往下淡出的白色漸層（光束/聚光錐共用） */
export function lightShaftTexture() {
  return make('shaft', 64, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, 'rgba(255, 255, 255, 0.85)')
    g.addColorStop(0.5, 'rgba(255, 255, 255, 0.32)')
    g.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
}

/** 櫃台上方紅底白字招牌 */
export function centerSignTexture() {
  return make('sign', 1024, 224, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#e6404e')
    g.addColorStop(1, '#c02836')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.roundRect(4, 4, w - 8, h - 8, 30)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 230, 210, 0.75)'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.roundRect(14, 14, w - 28, h - 28, 22)
    ctx.stroke()
    drawPokeball(ctx, 118, h / 2, 66, '#ffffff', 9, 'rgba(255,255,255,0.10)')
    ctx.fillStyle = '#ffffff'
    ctx.shadowColor = 'rgba(255, 200, 190, 0.9)'
    ctx.shadowBlur = 18
    ctx.font = 'bold 76px Verdana, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('POKéMON CENTER', 214, h / 2 + 12)
    ctx.shadowBlur = 0
    ctx.font = '26px Verdana, sans-serif'
    ctx.fillStyle = 'rgba(255, 226, 216, 0.85)'
    ctx.fillText('收 藏 大 廳  ·  C O L L E C T I O N  H A L L', 218, h / 2 + 62)
  })
}

/** PC 終端螢幕 */
export function pcScreenTexture() {
  return make('screen', 256, 192, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#052a33')
    g.addColorStop(1, '#04343f')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    // 掃描線
    ctx.fillStyle = 'rgba(80, 240, 255, 0.05)'
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1)
    // 視窗框
    ctx.strokeStyle = 'rgba(80, 240, 255, 0.8)'
    ctx.lineWidth = 3
    ctx.strokeRect(10, 10, w - 20, h - 20)
    ctx.fillStyle = 'rgba(80, 240, 255, 0.85)'
    ctx.fillRect(10, 10, w - 20, 22)
    ctx.fillStyle = '#04333d'
    ctx.font = 'bold 15px monospace'
    ctx.fillText('SOMEONE\'S PC', 18, 26)
    // 資料列
    ctx.fillStyle = 'rgba(80, 240, 255, 0.5)'
    for (let i = 0; i < 5; i++) ctx.fillRect(22, 48 + i * 24, 90 + (i % 3) * 40, 9)
    drawPokeball(ctx, w - 52, h - 52, 30, 'rgba(80, 240, 255, 0.9)', 4)
  })
}

/** 櫃台正面寶貝球徽章 */
export function deskEmblemTexture() {
  return make('emblem', 256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    drawPokeball(ctx, w / 2, h / 2, 100, '#ffffff', 12, 'rgba(255, 255, 255, 0.07)')
  })
}
