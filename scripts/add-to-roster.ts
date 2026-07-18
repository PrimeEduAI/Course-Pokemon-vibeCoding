#!/usr/bin/env bun
/**
 * 把一隻寶可夢加入收藏（收藏會自動出現在對戰選角名單）。
 * 用法：bun scripts/add-to-roster.ts <圖鑑編號 1-1025> [卡片名稱] [照片路徑]
 * 供 .claude/skills/add-card-to-roster 拍卡辨識流程呼叫，也可手動執行。
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, extname } from 'node:path'
import { eq } from 'drizzle-orm'
import { createDb } from '../lib/db'
import { pokemonCache } from '../lib/db/schema'
import { addCard } from '../lib/collection'
import { hasGmaxModel, hasMegaModel } from '../lib/battle/gimmicks'
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

// ---- 自動補素材：輕量包缺這隻時，先從本地完整備份複製，否則上網抓單檔 ----
const BACKUP = process.env.POKE_ASSETS_BACKUP ?? '../pokemon-assets-full-backup'
const RAW_3D = 'https://raw.githubusercontent.com/Pokemon-3D-api/assets/main/models/opt'
const RAW_ART = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork'
const RAW_CRY = 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest'

interface AssetTarget { rel: string; url: string; label: string }
const targets: AssetTarget[] = [
  { rel: `glb/regular/${dexId}.glb`, url: `${RAW_3D}/regular/${dexId}.glb`, label: '3D 模型' },
  ...(hasMegaModel(dexId) ? [{ rel: `glb/mega/${dexId}.glb`, url: `${RAW_3D}/mega/${dexId}.glb`, label: 'MEGA 模型' }] : []),
  ...(hasGmaxModel(dexId) ? [{ rel: `glb/gmax/${dexId}.glb`, url: `${RAW_3D}/gmax/${dexId}.glb`, label: 'G-MAX 模型' }] : []),
  { rel: `artwork/${dexId}.png`, url: `${RAW_ART}/${dexId}.png`, label: '官方繪圖' },
  { rel: `cries/latest/${dexId}.ogg`, url: `${RAW_CRY}/${dexId}.ogg`, label: '叫聲' },
]

for (const t of targets) {
  const local = `public/assets/${t.rel}`
  if (existsSync(local)) continue
  mkdirSync(dirname(local), { recursive: true })
  const backup = `${BACKUP}/${t.rel}`
  if (existsSync(backup)) {
    copyFileSync(backup, local)
    console.log(`📦 ${t.label}：已從本地備份補入`)
    continue
  }
  try {
    const res = await fetch(t.url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    writeFileSync(local, buf)
    console.log(`⬇️ ${t.label}：已下載（${(buf.length / 1024 / 1024).toFixed(1)}MB）`)
  } catch (e) {
    console.log(`⚠️ ${t.label}：自動補失敗（${String(e).slice(0, 60)}）`)
  }
}

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
  ? '   3D 模型：✅ 已就緒'
  : '   3D 模型：⚠️ 自動補失敗（離線且無本地備份）— 選牠出戰畫面會出錯！連上網路後重跑本指令即可補齊')

console.log('   查看方式：對戰頁 →「選擇出戰寶可夢」重新進入即可看到（收藏大廳也會顯示）')
