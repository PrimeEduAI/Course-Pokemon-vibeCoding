import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { addCard, listCards } from '@/lib/collection'
import { getPokemon } from '@/lib/pokeapi'
import type { TcgCard } from '@/lib/tcg'

export const runtime = 'nodejs'

const PHOTO_PATH_RE = /^data\/photos\/\d+\.(jpe?g|png|webp)$/

export async function GET() {
  return NextResponse.json({ cards: listCards(getDb()) })
}

export async function POST(req: Request) {
  const body = (await req.json()) as { card: TcgCard; photoPath: string | null }
  if (!body?.card?.id) return NextResponse.json({ error: 'card required' }, { status: 400 })
  const photoPath = typeof body.photoPath === 'string' && PHOTO_PATH_RE.test(body.photoPath) ? body.photoPath : null
  try {
    const inserted = await addCard(getDb(), body.card, photoPath, getPokemon)
    return NextResponse.json({ ok: true, id: inserted.id })
  } catch (e) {
    const msg = String(e)
    const status = msg.includes('UNIQUE') ? 409 : 500
    return NextResponse.json({ error: status === 409 ? '這張卡已在收藏中' : msg }, { status })
  }
}
