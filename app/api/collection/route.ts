import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { addCard, isValidPhotoPath, listCards, listCollectionPokemon } from '@/lib/collection'
import { getPokemon } from '@/lib/pokeapi'
import type { TcgCard } from '@/lib/tcg'

export const runtime = 'nodejs'

export async function GET() {
  const db = getDb()
  return NextResponse.json({ cards: listCards(db), pokemon: listCollectionPokemon(db) })
}

export async function POST(req: Request) {
  const body = (await req.json()) as { card: TcgCard; photoPath: string | null }
  if (!body?.card?.id) return NextResponse.json({ error: 'card required' }, { status: 400 })
  const photoPath = isValidPhotoPath(body.photoPath) ? body.photoPath : null
  if (body.photoPath != null && photoPath === null) console.warn('photoPath rejected:', body.photoPath)
  try {
    const inserted = await addCard(getDb(), body.card, photoPath, getPokemon)
    return NextResponse.json({ ok: true, id: inserted.id })
  } catch (e) {
    const msg = String(e)
    const status = msg.includes('UNIQUE') ? 409 : 500
    return NextResponse.json({ error: status === 409 ? '這張卡已在收藏中' : msg }, { status })
  }
}
