import { extractCardInfo } from './vision'
import { extractCardInfoLocal } from './vision-local'
import type { CardHint } from './tcg'

/** 有 ANTHROPIC_API_KEY 就走 API，否則走本機 Claude Code。純函式，方便單元測試。 */
export function pickVisionBackend(apiKey: string | undefined): 'api' | 'local' {
  return apiKey && apiKey.length > 0 ? 'api' : 'local'
}

export async function extractCard(
  buf: Buffer,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  photoAbsPath: string,
): Promise<CardHint> {
  if (pickVisionBackend(process.env.ANTHROPIC_API_KEY) === 'api') {
    return extractCardInfo(buf.toString('base64'), mediaType)
  }
  return extractCardInfoLocal(photoAbsPath)
}
