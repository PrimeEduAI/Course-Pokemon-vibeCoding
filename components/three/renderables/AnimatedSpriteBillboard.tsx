'use client'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CanvasTexture } from 'three'
import BillboardCore from './BillboardCore'
import SpriteBillboard from './SpriteBillboard'
import { configureSpriteTexture } from './spriteUtils'
import { loadGifChain, type DecodedGif } from './gifCache'

interface Props {
  /** GIF 來源（依序 fallback，例如 gen5ani → ani） */
  urls: string[]
  /** GIF 全滅時的官繪保底 */
  artworkUrl: string
  targetHeight: number
  heightScale?: number
  entity?: 'player' | 'enemy'
}

/** 已解碼 GIF 的播放器：每個實例自有 canvas + CanvasTexture，影格資料共用快取。 */
function GifBillboard({ gif, height, entity }: { gif: DecodedGif; height: number; entity?: 'player' | 'enemy' }) {
  const { ctx, texture } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = gif.width
    canvas.height = gif.height
    const ctx = canvas.getContext('2d')!
    ctx.putImageData(gif.frames[0].image, 0, 0)
    const texture = new CanvasTexture(canvas)
    configureSpriteTexture(texture, true)
    return { ctx, texture }
  }, [gif])
  useEffect(() => () => texture.dispose(), [texture])

  const play = useRef({ frame: 0, acc: 0 })
  useEffect(() => {
    play.current = { frame: 0, acc: 0 }
  }, [gif])

  // 依每幀 delay 推進（gifuct 的 delay 為毫秒；分頁閒置回來不快轉）
  useFrame((_, dt) => {
    const p = play.current
    p.acc += Math.min(dt, 0.25) * 1000
    let f = p.frame
    let advanced = false
    let guard = 0
    while (p.acc >= gif.frames[f].delayMs) {
      p.acc -= gif.frames[f].delayMs
      f = (f + 1) % gif.frames.length
      advanced = true
      if (++guard > gif.frames.length) {
        p.acc = 0
        break
      }
    }
    if (advanced) {
      p.frame = f
      ctx.putImageData(gif.frames[f].image, 0, 0)
      texture.needsUpdate = true
    }
  })

  return <BillboardCore texture={texture} aspect={gif.width / gif.height} height={height} entity={entity} />
}

/** 動畫 GIF 看板（B/W 世代動態點陣）：解碼失敗退回官繪靜態看板。 */
export default function AnimatedSpriteBillboard({ urls, artworkUrl, targetHeight, heightScale = 1.1, entity }: Props) {
  const [gif, setGif] = useState<DecodedGif | null>(null)
  const [failed, setFailed] = useState(false)
  const key = urls.join('|')
  useEffect(() => {
    let alive = true
    setGif(null)
    setFailed(false)
    loadGifChain(urls)
      .then((g) => {
        if (alive) setGif(g)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
    // key 已涵蓋 urls 內容
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (failed) {
    return (
      <SpriteBillboard
        sources={[{ url: artworkUrl, pixelated: false }]}
        targetHeight={targetHeight}
        entity={entity}
      />
    )
  }
  if (!gif) return null
  return <GifBillboard gif={gif} height={targetHeight * heightScale} entity={entity} />
}
