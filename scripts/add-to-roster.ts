#!/usr/bin/env bun
/**
 * 把一隻寶可夢加入收藏（收藏會自動出現在對戰選角名單）。
 * 用法：bun scripts/add-to-roster.ts <圖鑑編號 1-1025> [卡片名稱] [照片路徑]
 * 供 .claude/skills/add-card-to-roster 拍卡辨識流程呼叫，也可手動執行。
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { extname } from 'node:path'
import { eq } from 'drizzle-orm'
import { createDb } from '../lib/db'
import { pokemonCache } from '../lib/db/schema'
import { addCard } from '../lib/collection'
import { getPokemon, type CachedPokemon } from '../lib/pokeapi'
import { SPECIES } from '../lib/battle/species'
import type { TcgCard } from '../lib/tcg'

const [, , dexArg, nameArg, photoArg] = process.argv
const dexId = Number(dexArg)
if (!Number.isInteger(dexId) || dexId < 1 || dexId > 1025) {
  console.error('用法：bun scripts/add-to-roster.ts <圖鑑編號 1-1025> [卡片名稱] [照片路徑]')
  process.exit(1)
}
if (!existsSync('package.json')) {
  console.error('請在專案根目錄（pokemon-3d-arena/）執行')
  process.exit(1)
}

const species = SPECIES[dexId]

// PokeAPI 掛掉時退回手工物種表，離線教室也能加卡
const info: CachedPokemon | null = await getPokemon(dexId).catch(() =>
  species
    ? {
        dexId, name: species.nameEn.toLowerCase(), stats: species.base,
        moves: [], types: species.types, cryUrl: `/assets/cries/latest/${dexId}.ogg`,
      }
    : null,
)

// 用戶給了照片檔就複製進 data/photos（收藏大廳會顯示原照片）
let photoPath: string | null = null
if (photoArg && existsSync(photoArg)) {
  const ext = extname(photoArg).toLowerCase()
  if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    mkdirSync('data/photos', { recursive: true })
    photoPath = `data/photos/${Date.now()}${ext}`
    copyFileSync(photoArg, photoPath)
  }
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const cardName = nameArg || species?.nameEn || (info ? cap(info.name) : `No.${dexId}`)
const artwork = existsSync(`public/assets/artwork/${dexId}.png`) ? `/assets/artwork/${dexId}.png` : ''

const card: TcgCard = {
  id: `roster-${dexId}`, name: cardName, number: String(dexId), rarity: null,
  setId: 'vibe-roster', setName: 'Vibe Roster', printedTotal: 0,
  imageSmall: artwork, imageLarge: artwork,
  pokedexNumbers: [dexId], price: null, priceUpdatedAt: null,
}

const db = createDb('data/collection.db')
const cacheFetcher = async () => {
  if (info) return info
  throw new Error(`無法取得 #${dexId} 的能力值（離線且不在手工物種表）`)
}

let duplicated = false
try {
  await addCard(db, card, photoPath, cacheFetcher)
} catch (e) {
  if (!String(e).includes('UNIQUE')) throw e
  duplicated = true
  // 重跑時順手補齊之前失敗的 pokemon_cache（例如上次離線）
  const cached = db.select().from(pokemonCache).where(eq(pokemonCache.dexId, dexId)).all()
  if (cached.length === 0 && info) {
    db.insert(pokemonCache).values({
      dexId, name: info.name, statsJson: JSON.stringify(info.stats),
      movesJson: JSON.stringify(info.moves), typesJson: JSON.stringify(info.types ?? []),
      cryUrl: info.cryUrl,
    }).run()
    console.log(`🔧 已補齊 #${dexId} 的能力值資料`)
  }
}

const zh = species?.nameZh && species.nameZh !== cardName ? `（${species.nameZh}）` : ''
console.log(duplicated
  ? `⚠️ #${dexId} ${cardName}${zh} 已在收藏中，不用重複加`
  : `✅ 已加入收藏：#${dexId} ${cardName}${zh}`)

console.log(species
  ? '   戰鬥資料：手工調校（專屬招式）'
  : info
    ? '   戰鬥資料：PokeAPI 能力值 + 屬性通用招式'
    : '   ⚠️ 能力值抓取失敗（離線？）：這隻目前不可出戰，連上網後重跑本指令即可補齊')

console.log(existsSync(`public/assets/glb/regular/${dexId}.glb`)
  ? '   3D 模型：✅ 素材包已內建'
  : '   3D 模型：⚠️ 不在輕量素材包 — 選牠出戰畫面會出錯！先執行 bash scripts/setup-assets.sh 下載完整素材，或改加素材包內建的寶可夢')

console.log('   查看方式：對戰頁 →「選擇出戰寶可夢」重新進入即可看到（收藏大廳也會顯示）')
