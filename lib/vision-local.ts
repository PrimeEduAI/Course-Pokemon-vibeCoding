import { query } from '@anthropic-ai/claude-agent-sdk'
import { PROMPT, parseVisionResponse } from './vision'
import type { CardHint } from './tcg'

/**
 * 不需要 ANTHROPIC_API_KEY：改用本機已登入的 Claude Code session（Claude Agent SDK）。
 * 指示 Claude 用 Read 工具讀取「絕對路徑」的圖片檔，再回覆純 JSON。
 */
export async function extractCardInfoLocal(photoAbsPath: string): Promise<CardHint> {
  const prompt = `請用 Read 工具讀取這個絕對路徑的圖片檔：${photoAbsPath}
${PROMPT}`

  let lastText = ''
  try {
    for await (const message of query({
      prompt,
      options: {
        allowedTools: ['Read'],
        maxTurns: 4,
        permissionMode: 'bypassPermissions',
      },
    })) {
      if (message.type === 'assistant') {
        // 收集本輪 assistant 的文字區塊（覆寫成最後一段 assistant 文字）
        const text = message.message.content
          .map((b) => (b.type === 'text' ? b.text : ''))
          .join('')
        if (text.trim()) lastText = text
      } else if (message.type === 'result') {
        if (message.subtype === 'success') {
          // result message 帶有最終文字，優先採用
          if (message.result.trim()) lastText = message.result
        } else {
          throw new Error('本機 Claude Code 未登入或不可用：' + message.errors.join('; '))
        }
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('本機 Claude Code')) throw e
    throw new Error('本機 Claude Code 未登入或不可用：' + (e instanceof Error ? e.message : String(e)))
  }

  if (!lastText.trim()) throw new Error('本機 Claude Code 未登入或不可用：沒有取得任何回覆文字')
  return parseVisionResponse(lastText)
}
