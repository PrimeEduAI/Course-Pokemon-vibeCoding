'use client'
import { useEffect, useState } from 'react'
import { Texture, TextureLoader } from 'three'
import BillboardCore from './BillboardCore'
import { configureSpriteTexture } from './spriteUtils'

export interface TexSource {
  url: string
  /** true = 點陣 sprite（NearestFilter + 放大係數 + 跳動待機）；false = 官繪 fallback */
  pixelated: boolean
}

interface Loaded {
  tex: Texture
  aspect: number
  pixelated: boolean
}

/** 依序嘗試載入來源（sprite → 官繪），全滅回傳 null（渲染空 → 不炸場景）。 */
function useTextureChain(sources: TexSource[]): Loaded | null {
  const [result, setResult] = useState<Loaded | null>(null)
  const key = sources.map((s) => s.url).join('|')
  useEffect(() => {
    let alive = true
    let current: Texture | null = null
    const loader = new TextureLoader()
    const tryLoad = (i: number) => {
      if (!alive || i >= sources.length) return
      loader.load(
        sources[i].url,
        (tex) => {
          if (!alive) {
            tex.dispose()
            return
          }
          configureSpriteTexture(tex, sources[i].pixelated)
          current = tex
          const img = tex.image as { width: number; height: number }
          setResult({ tex, aspect: img.width / img.height, pixelated: sources[i].pixelated })
        },
        undefined,
        () => tryLoad(i + 1),
      )
    }
    setResult(null)
    tryLoad(0)
    return () => {
      alive = false
      current?.dispose()
    }
    // key 已涵蓋 sources 內容
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return result
}

interface Props {
  sources: TexSource[]
  targetHeight: number
  /** 點陣 sprite 的視覺放大（貼圖留白多，稍大才有存在感） */
  heightScale?: number
  entity?: 'player' | 'enemy'
}

/** 靜態點陣 sprite 看板：世代點陣圖優先，缺圖退官繪，再缺就不畫。 */
export default function SpriteBillboard({ sources, targetHeight, heightScale = 1.15, entity }: Props) {
  const loaded = useTextureChain(sources)
  if (!loaded) return null
  const height = targetHeight * (loaded.pixelated ? heightScale : 1)
  return (
    <BillboardCore
      texture={loaded.tex}
      aspect={loaded.aspect}
      height={height}
      entity={entity}
      hop={loaded.pixelated}
    />
  )
}
