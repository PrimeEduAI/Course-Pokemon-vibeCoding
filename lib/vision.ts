import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { CardHint } from './tcg'

const VisionCard = z.object({
  name: z.string().min(1),
  number: z.string().regex(/^\d+$/).nullable(),
  printedTotal: z.string().regex(/^\d+$/).nullable(),
})

export function parseVisionResponse(text: string): CardHint {
  const stripped = text.replace(/```json\s*|```/g, '').trim()
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error(`vision response has no JSON: ${text.slice(0, 80)}`)
  return VisionCard.parse(JSON.parse(stripped.slice(start, end + 1)))
}

const PROMPT = `你看到的是一張寶可夢集換式卡牌的照片。請讀出：
1. name：卡片最上方的寶可夢/卡片英文名稱（保留 ex/V/VMAX 等後綴）
2. number 與 printedTotal：卡片底部角落的收藏編號，格式如 "025/193" → number="025", printedTotal="193"
只回覆 JSON（不要其他文字）：{"name": string, "number": string|null, "printedTotal": string|null}
讀不到編號就填 null。`

export async function extractCardInfo(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  client?: Anthropic,
): Promise<CardHint> {
  const anthropic = client ?? new Anthropic()
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        { type: 'text', text: PROMPT },
      ],
    }],
  })
  const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
  return parseVisionResponse(text)
}
