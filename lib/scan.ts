import { buildCardQuery, type CardHint, type TcgCard } from './tcg'

export type Candidate = TcgCard & { validated: boolean }

/** Vision 卡名與 API 卡名完全一致（不分大小寫）才算 validated */
export function crossValidate(visionName: string, cards: TcgCard[]): Candidate[] {
  const target = visionName.trim().toLowerCase()
  return cards.map((c) => ({ ...c, validated: c.name.trim().toLowerCase() === target }))
}

export interface ScanDeps {
  extract: () => Promise<CardHint>
  search: (q: string) => Promise<TcgCard[]>
}

export async function scanCard(deps: ScanDeps): Promise<{ hint: CardHint; candidates: Candidate[] }> {
  const hint = await deps.extract()
  let cards = await deps.search(buildCardQuery(hint))
  // Vision 可能誤讀編號 → 退回只用卡名查
  if (cards.length === 0 && (hint.number || hint.printedTotal)) {
    cards = await deps.search(buildCardQuery({ name: hint.name, number: null, printedTotal: null }))
  }
  return { hint, candidates: crossValidate(hint.name, cards) }
}
