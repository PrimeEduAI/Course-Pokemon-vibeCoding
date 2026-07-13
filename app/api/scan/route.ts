import { NextResponse } from 'next/server'
import { mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { extractCard } from '@/lib/vision-router'
import { searchCards } from '@/lib/tcg'
import { scanCard } from '@/lib/scan'

export const runtime = 'nodejs'

const MEDIA: Record<string, 'image/jpeg' | 'image/png' | 'image/webp'> = {
  'image/jpeg': 'image/jpeg', 'image/png': 'image/png', 'image/webp': 'image/webp',
}

export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('photo')
  if (!(file instanceof File)) return NextResponse.json({ error: 'photo required' }, { status: 400 })
  const mediaType = MEDIA[file.type]
  if (!mediaType) return NextResponse.json({ error: `unsupported type ${file.type}` }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  mkdirSync('data/photos', { recursive: true })
  const ext = mediaType.split('/')[1]
  const photoPath = `data/photos/${Date.now()}.${ext}`
  await writeFile(photoPath, buf)
  const photoAbsPath = resolve(photoPath)

  try {
    const result = await scanCard({
      extract: () => extractCard(buf, mediaType, photoAbsPath),
      search: (q) => searchCards(q, { apiKey: process.env.POKEMONTCG_API_KEY }),
    })
    return NextResponse.json({ ...result, photoPath })
  } catch (e) {
    return NextResponse.json({ error: String(e), photoPath }, { status: 502 })
  }
}
