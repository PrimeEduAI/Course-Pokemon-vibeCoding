/** 現行出戰名單的圖鑑編號 → Showdown sprite 英文名（小寫檔名）。 */
export const DEX_NAMES: Record<number, string> = {
  6: 'charizard',
  25: 'pikachu',
  133: 'eevee',
  150: 'mewtwo',
  249: 'lugia',
  384: 'rayquaza',
  448: 'lucario',
  643: 'reshiram',
  658: 'greninja',
  791: 'solgaleo',
  888: 'zacian',
}

/** dexId → sprite 檔名；不在名單內回傳 null（呼叫端 fallback 至官方繪圖）。 */
export function spriteNameForDex(dexId: number): string | null {
  return DEX_NAMES[dexId] ?? null
}

export type PixelSpriteSet = 'gen1' | 'gen2' | 'gen3' | 'gen4' | 'gen5'

/** 點陣模式的 sprite 世代：跟著戰場年代走（gen1–4 各用當代圖，其餘用 gen5 高規點陣）。 */
export function spriteSetForGen(arenaGen?: number): PixelSpriteSet {
  switch (arenaGen) {
    case 1: return 'gen1'
    case 2: return 'gen2'
    case 3: return 'gen3'
    case 4: return 'gen4'
    default: return 'gen5'
  }
}
