import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import * as schema from './schema'

const BOOTSTRAP = `
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tcg_card_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, set_id TEXT NOT NULL,
  number TEXT NOT NULL, rarity TEXT, image_small TEXT NOT NULL, image_large TEXT NOT NULL,
  photo_path TEXT, pokedex_numbers TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS price_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES cards(id),
  market REAL, low REAL, mid REAL, high REAL,
  currency TEXT NOT NULL DEFAULT 'USD',
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS pokemon_cache (
  dex_id INTEGER PRIMARY KEY, name TEXT NOT NULL,
  stats_json TEXT NOT NULL, moves_json TEXT NOT NULL, cry_url TEXT
);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_card_id ON price_snapshots(card_id);`

export type Db = BaseSQLiteDatabase<'sync', unknown, typeof schema>

// 隱藏 require 讓 webpack/turbopack 不去解析 bun:sqlite（僅 Bun runtime 會走到）
// （eval('require') 在 Bun 的 ESM test context 下沒有 require，改用 createRequire）
const dynamicRequire = createRequire(import.meta.url)

export function createDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  if (process.versions.bun) {
    const { Database } = dynamicRequire('bun:sqlite')
    const { drizzle } = dynamicRequire('drizzle-orm/bun-sqlite')
    const sqlite = new Database(path)
    sqlite.exec('PRAGMA journal_mode = WAL;')
    sqlite.exec(BOOTSTRAP)
    return drizzle(sqlite, { schema }) as Db
  }
  const Database = dynamicRequire('better-sqlite3')
  const { drizzle } = dynamicRequire('drizzle-orm/better-sqlite3')
  const sqlite = new Database(path)
  sqlite.pragma('journal_mode = WAL')
  sqlite.exec(BOOTSTRAP)
  return drizzle(sqlite, { schema }) as Db
}

const g = globalThis as unknown as { __pokeArenaDb?: Db }
/** App 單例（route handlers 用），掛在 globalThis 上避免 Next dev hot-reload 重建連線 */
export function getDb() {
  if (!g.__pokeArenaDb) g.__pokeArenaDb = createDb('data/collection.db')
  return g.__pokeArenaDb
}
