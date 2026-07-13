'use client'
import { parseGIF, decompressFrames } from 'gifuct-js'

/**
 * GIF 解碼快取：url → 已合成的完整影格（ImageData）序列。
 * gifuct-js 只給 patch（差分區塊），這裡在解碼時一次合成為全幅影格並處理
 * disposal（2 = 清區塊、3 = 還原前幀），播放端只要 putImageData 即可。
 * module-level Map 讓畫風切換 / re-mount 立即命中快取。
 */
export interface DecodedGif {
  width: number
  height: number
  frames: { image: ImageData; delayMs: number }[]
}

const cache = new Map<string, Promise<DecodedGif>>()

const MIN_DELAY_MS = 20
const DEFAULT_DELAY_MS = 100

async function decode(url: string): Promise<DecodedGif> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`gif fetch ${res.status}: ${url}`)
  const buf = await res.arrayBuffer()
  const gif = parseGIF(buf)
  const raw = decompressFrames(gif, true)
  if (raw.length === 0) throw new Error(`gif has no frames: ${url}`)

  const width = gif.lsd.width
  const height = gif.lsd.height

  // 合成畫布 + patch 畫布
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const patchCanvas = document.createElement('canvas')
  const patchCtx = patchCanvas.getContext('2d')!

  const frames: DecodedGif['frames'] = []
  let restore: ImageData | null = null
  for (const f of raw) {
    const { width: w, height: h, left, top } = f.dims
    if (f.disposalType === 3) restore = ctx.getImageData(0, 0, width, height)
    if (w > 0 && h > 0) {
      if (patchCanvas.width !== w || patchCanvas.height !== h) {
        patchCanvas.width = w
        patchCanvas.height = h
      }
      // 複製到新 buffer：gifuct 的 patch 型別是 ArrayBufferLike，ImageData 需要 ArrayBuffer
      patchCtx.putImageData(new ImageData(new Uint8ClampedArray(f.patch), w, h), 0, 0)
      ctx.drawImage(patchCanvas, left, top)
    }
    const delay = typeof f.delay === 'number' && f.delay > 0 ? f.delay : DEFAULT_DELAY_MS
    frames.push({ image: ctx.getImageData(0, 0, width, height), delayMs: Math.max(MIN_DELAY_MS, delay) })
    // 顯示後的處置
    if (f.disposalType === 2) {
      ctx.clearRect(left, top, w, h)
    } else if (f.disposalType === 3 && restore) {
      ctx.putImageData(restore, 0, 0)
    }
  }
  return { width, height, frames }
}

/** 解碼（含快取）；失敗會從快取移除，之後可重試或走 fallback。 */
export function loadGif(url: string): Promise<DecodedGif> {
  let p = cache.get(url)
  if (!p) {
    p = decode(url)
    p.catch(() => cache.delete(url))
    cache.set(url, p)
  }
  return p
}

/** 依序嘗試多個 GIF 來源，全滅則 reject。 */
export async function loadGifChain(urls: string[]): Promise<DecodedGif> {
  let lastErr: unknown = new Error('no gif urls')
  for (const url of urls) {
    try {
      return await loadGif(url)
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr
}
