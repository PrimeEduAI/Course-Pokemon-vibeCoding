# M1 骨架 + M2 掃卡 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 Next.js + R3F 專案骨架（3D 場地 + 方向鍵移動 + GLB 寶可夢），並完成「拍卡 → Claude Vision 辨識 → TCG API 查價 → 入庫 SQLite」全流程。

**Architecture:** Next.js 15 App Router 單一 repo；3D 全部在 client components（`'use client'` + dynamic import）；辨識/查價金鑰只在 API Routes 使用；業務邏輯放 `lib/`（純函式、可注入 fetcher，bun test 可離線測試），route handler 保持薄。素材已在 `public/assets/`（GLB/立繪/叫聲用圖鑑編號命名，sprites 用小寫英文名）。

**Tech Stack:** Bun（package manager + test runner）、Next.js 15、React 19、three 0.185 / @react-three/fiber 9 / drei 10 / rapier 2、drizzle-orm + better-sqlite3、@anthropic-ai/sdk（claude-sonnet-5 vision）、zod。

**與 DESIGN.md 的刻意差異：** M1 角色控制先用 drei `KeyboardControls` + rapier RigidBody 手寫（API 穩定、可測），ecctrl 留到 M3 對戰手感調校時再評估替換 —— YAGNI。

**範圍：** 本計畫只含 M1+M2。M3 對戰、M4 收藏館、M5 畫風切換為後續獨立計畫。

---

## File Structure

```
pokemon-3d-arena/
├── package.json / tsconfig.json / next.config.ts / .gitignore / .env.local
├── app/
│   ├── layout.tsx  globals.css
│   ├── page.tsx                      # 主選單（導向 /scan /battle，顯示收藏數）
│   ├── battle/page.tsx               # M1：3D 場景頁（dynamic import BattleScene）
│   ├── scan/page.tsx                 # M2：拍卡入庫 UI
│   └── api/
│       ├── scan/route.ts             # POST 照片 → vision → tcg 查價 → 候選清單
│       └── collection/route.ts       # GET 列表 / POST 入庫
├── components/three/
│   ├── BattleScene.tsx               # Canvas + Physics + 燈光 + HDRI
│   ├── ArenaFloor.tsx                # 場地地板 + Poké Ball 中圈
│   ├── Player.tsx                    # 方向鍵移動的膠囊體 + 跟隨鏡頭 + 掛載寶可夢
│   └── PokemonModel.tsx              # useGLTF 載入 glb + 程式化待機動畫
├── lib/
│   ├── movement.ts                   # dirFromKeys / idleBob（純函式）
│   ├── showdown-name.ts              # toShowdownId
│   ├── tcg.ts                        # buildCardQuery / searchCards / 價格挑選
│   ├── vision.ts                     # extractCardInfo / parseVisionResponse
│   ├── scan.ts                       # scanPhoto 組合流程（vision+tcg 交叉驗證）
│   ├── pokeapi.ts                    # getPokemon（種族值/招式/叫聲）
│   ├── collection.ts                 # addCard / listCards
│   └── db/ index.ts  schema.ts       # better-sqlite3 + drizzle + CREATE TABLE 引導
├── tests/ *.test.ts                  # bun test（全部離線、注入假 fetcher）
└── data/ (gitignored)                # collection.db、photos/
```

---

### Task 1: 專案初始化與 git

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`, `.env.local`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx`

- [ ] **Step 1: git init 與 .gitignore**

```bash
cd /Users/somer/Desktop/CL/ai-camp-curriculum/pokemon-3d-arena && git init
```

`.gitignore`：

```gitignore
node_modules/
.next/
data/
public/assets/
.env.local
*.tsbuildinfo
```

（`public/assets/` 1GB 版權素材不進 git；`scripts/` 可重載。）

- [ ] **Step 2: package.json**

```json
{
  "name": "pokemon-3d-arena",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "test": "bun test tests/"
  }
}
```

- [ ] **Step 3: 安裝依賴（鎖 RESOURCES.md 驗證過的版本線）**

```bash
bun add next@15 react@19 react-dom@19 three@0.185.1 @react-three/fiber@9 @react-three/drei@10 @react-three/rapier@2 zustand drizzle-orm better-sqlite3 @anthropic-ai/sdk zod
bun add -d typescript @types/react @types/react-dom @types/node @types/better-sqlite3 @types/three
```

- [ ] **Step 4: tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true, "skipLibCheck": true, "strict": true, "noEmit": true,
    "module": "esnext", "moduleResolution": "bundler", "resolveJsonModule": true,
    "isolatedModules": true, "jsx": "preserve", "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "scripts"]
}
```

- [ ] **Step 5: next.config.ts**

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
}
export default nextConfig
```

- [ ] **Step 6: .env.local（向用戶要金鑰，或先留空跑 M1）**

```bash
ANTHROPIC_API_KEY=sk-ant-...
POKEMONTCG_API_KEY=
```

- [ ] **Step 7: app/layout.tsx 與 globals.css**

```tsx
// app/layout.tsx
import './globals.css'

export const metadata = { title: 'Pokémon 3D Arena' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  )
}
```

```css
/* app/globals.css */
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; background: #0f1220; color: #eee; font-family: system-ui, sans-serif; }
a { color: #7cc4ff; }
```

- [ ] **Step 8: app/page.tsx（暫版主選單）**

```tsx
export default function Home() {
  return (
    <main style={{ padding: 40 }}>
      <h1>Pokémon 3D Arena</h1>
      <ul style={{ marginTop: 20, lineHeight: 2 }}>
        <li><a href="/scan">📷 拍卡入庫</a></li>
        <li><a href="/battle">⚔️ 對戰（M1 場景）</a></li>
      </ul>
    </main>
  )
}
```

- [ ] **Step 9: 驗證 dev server 起得來**

Run: `bun run dev`（背景），開 `http://localhost:3000`
Expected: 主選單頁渲染，無 console error。

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat: Next.js 15 + React 19 project skeleton"
```

---

### Task 2: 純函式工具 — showdown 名稱與移動向量（TDD）

**Files:**
- Create: `lib/showdown-name.ts`, `lib/movement.ts`
- Test: `tests/showdown-name.test.ts`, `tests/movement.test.ts`

- [ ] **Step 1: 寫失敗測試**

```ts
// tests/showdown-name.test.ts
import { expect, test } from 'bun:test'
import { toShowdownId } from '../lib/showdown-name'

test('lowercases and strips punctuation', () => {
  expect(toShowdownId('Mr. Mime')).toBe('mrmime')
  expect(toShowdownId("Farfetch'd")).toBe('farfetchd')
  expect(toShowdownId('nidoran-f')).toBe('nidoranf')
  expect(toShowdownId('Pikachu')).toBe('pikachu')
})
```

```ts
// tests/movement.test.ts
import { expect, test } from 'bun:test'
import { dirFromKeys, idleBob } from '../lib/movement'

test('single key gives unit vector', () => {
  expect(dirFromKeys({ forward: true, backward: false, left: false, right: false })).toEqual([0, -1])
})
test('diagonal is normalized', () => {
  const [x, z] = dirFromKeys({ forward: true, backward: false, left: false, right: true })
  expect(Math.hypot(x, z)).toBeCloseTo(1)
})
test('no keys gives zero vector', () => {
  expect(dirFromKeys({ forward: false, backward: false, left: false, right: false })).toEqual([0, 0])
})
test('idleBob oscillates around baseY with amplitude', () => {
  expect(idleBob(0, 1, 0.1)).toBeCloseTo(1)
  expect(Math.abs(idleBob(0.7, 1, 0.1) - 1)).toBeLessThanOrEqual(0.1)
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `bun test tests/`
Expected: FAIL（Cannot find module）

- [ ] **Step 3: 實作**

```ts
// lib/showdown-name.ts
/** PokéAPI/TCG 名稱 → Showdown sprite 檔名 id（小寫、去標點） */
export function toShowdownId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}
```

```ts
// lib/movement.ts
export interface KeyState { forward: boolean; backward: boolean; left: boolean; right: boolean }

/** 方向鍵狀態 → 正規化的 XZ 平面移動向量（-Z 為前方） */
export function dirFromKeys(k: KeyState): [number, number] {
  const x = (k.right ? 1 : 0) - (k.left ? 1 : 0)
  const z = (k.backward ? 1 : 0) - (k.forward ? 1 : 0)
  const len = Math.hypot(x, z)
  return len === 0 ? [0, 0] : [x / len, z / len]
}

/** 待機上下浮動：t 秒時的 Y 值 */
export function idleBob(t: number, baseY: number, amplitude: number): number {
  return baseY + Math.sin(t * 2.4) * amplitude
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `bun test tests/`
Expected: PASS（全綠）

- [ ] **Step 5: Commit**

```bash
git add lib/ tests/ && git commit -m "feat: showdown name + movement pure helpers (TDD)"
```

---

### Task 3: M1 — 3D 場景（Canvas、場地、HDRI）

**Files:**
- Create: `app/battle/page.tsx`, `components/three/BattleScene.tsx`, `components/three/ArenaFloor.tsx`

- [ ] **Step 1: battle page（client + dynamic import，避開 SSR/WASM）**

```tsx
// app/battle/page.tsx
'use client'
import dynamic from 'next/dynamic'

const BattleScene = dynamic(() => import('@/components/three/BattleScene'), {
  ssr: false,
  loading: () => <p style={{ padding: 40 }}>載入 3D 場景…</p>,
})

export default function BattlePage() {
  return <div style={{ width: '100vw', height: '100vh' }}><BattleScene /></div>
}
```

- [ ] **Step 2: ArenaFloor（40×24 標準場 + 中圈）**

```tsx
// components/three/ArenaFloor.tsx
'use client'
import { RigidBody } from '@react-three/rapier'

export default function ArenaFloor() {
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <mesh receiveShadow position={[0, -0.25, 0]}>
        <boxGeometry args={[40, 0.5, 24]} />
        <meshStandardMaterial color="#8a6f4d" />
      </mesh>
      {/* Poké Ball 中圈 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[2.8, 3.2, 64]} />
        <meshStandardMaterial color="#e8e4da" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, 0]}>
        <planeGeometry args={[40, 0.4]} />
        <meshStandardMaterial color="#e8e4da" />
      </mesh>
    </RigidBody>
  )
}
```

- [ ] **Step 3: BattleScene（Canvas + Physics + 燈光 + 本地 HDRI）**

```tsx
// components/three/BattleScene.tsx
'use client'
import { Canvas } from '@react-three/fiber'
import { Environment, KeyboardControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { Suspense } from 'react'
import ArenaFloor from './ArenaFloor'
import Player from './Player'

const keyMap = [
  { name: 'forward', keys: ['ArrowUp'] },
  { name: 'backward', keys: ['ArrowDown'] },
  { name: 'left', keys: ['ArrowLeft'] },
  { name: 'right', keys: ['ArrowRight'] },
]

export default function BattleScene() {
  return (
    <KeyboardControls map={keyMap}>
      <Canvas shadows camera={{ position: [0, 6, 12], fov: 50 }}>
        <Suspense fallback={null}>
          <Environment files="/assets/hdri/venice_sunset_2k.hdr" background />
          <directionalLight position={[8, 12, 6]} intensity={1.2} castShadow />
          <ambientLight intensity={0.3} />
          <Physics>
            <ArenaFloor />
            <Player dexId={25} />
          </Physics>
        </Suspense>
      </Canvas>
    </KeyboardControls>
  )
}
```

（`Player` 下一個 Task 實作 —— 本 Task 結尾前先放一個暫代空元件讓編譯通過：）

```tsx
// components/three/Player.tsx（暫代，Task 4 覆寫）
'use client'
export default function Player(_: { dexId: number }) { return null }
```

- [ ] **Step 4: 驗證**

Run: dev server 開 `http://localhost:3000/battle`
Expected: 夕陽 HDRI 天空 + 棕色場地 + 白色中圈，60fps，console 無錯。

- [ ] **Step 5: Commit**

```bash
git add app/battle components/ && git commit -m "feat(m1): 3d arena scene with hdri + physics floor"
```

---

### Task 4: M1 — GLB 寶可夢 + 方向鍵移動 + 跟隨鏡頭

**Files:**
- Create: `components/three/PokemonModel.tsx`
- Modify: `components/three/Player.tsx`（覆寫暫代版）

- [ ] **Step 1: PokemonModel（useGLTF + 待機浮動）**

```tsx
// components/three/PokemonModel.tsx
'use client'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Group } from 'three'
import { idleBob } from '@/lib/movement'

export default function PokemonModel({ dexId, scale = 1 }: { dexId: number; scale?: number }) {
  const { scene } = useGLTF(`/assets/glb/regular/${dexId}.glb`)
  const group = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (group.current) group.current.position.y = idleBob(clock.elapsedTime, 0, 0.08)
  })
  return <group ref={group}><primitive object={scene} scale={scale} /></group>
}
```

- [ ] **Step 2: Player（rapier 膠囊體 + 鍵盤速度 + 鏡頭跟隨 + 面向移動方向）**

```tsx
// components/three/Player.tsx
'use client'
import { useKeyboardControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CapsuleCollider, type RapierRigidBody } from '@react-three/rapier'
import { useRef } from 'react'
import { Group, Vector3 } from 'three'
import { dirFromKeys, type KeyState } from '@/lib/movement'
import PokemonModel from './PokemonModel'

const SPEED = 6
const camTarget = new Vector3()

export default function Player({ dexId }: { dexId: number }) {
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<Group>(null)
  const [, getKeys] = useKeyboardControls()

  useFrame(({ camera }) => {
    if (!body.current) return
    const [x, z] = dirFromKeys(getKeys() as unknown as KeyState)
    const vel = body.current.linvel()
    body.current.setLinvel({ x: x * SPEED, y: vel.y, z: z * SPEED }, true)
    // 面向移動方向
    if ((x !== 0 || z !== 0) && visual.current) {
      visual.current.rotation.y = Math.atan2(x, z)
    }
    // 鏡頭跟隨
    const p = body.current.translation()
    camTarget.set(p.x, p.y + 5, p.z + 10)
    camera.position.lerp(camTarget, 0.08)
    camera.lookAt(p.x, p.y + 1, p.z)
  })

  return (
    <RigidBody ref={body} colliders={false} lockRotations position={[0, 1, 6]}>
      <CapsuleCollider args={[0.5, 0.5]} />
      <group ref={visual}>
        <PokemonModel dexId={dexId} scale={1} />
      </group>
    </RigidBody>
  )
}
```

- [ ] **Step 3: 驗證（手動 + preview）**

開 `/battle`：皮卡丘（25.glb）站在場中、輕微上下浮動；方向鍵四向移動且模型轉向移動方向；鏡頭平滑跟隨；斜向速度不快於直向（Task 2 已測 normalize）。
若模型全黑/破面：Pokemon-3D-api GLB 為 Draco 壓縮，drei 預設會從 CDN 抓 decoder —— 需網路；如需離線，將 draco decoder 複製到 `public/draco/` 並 `useGLTF(url, '/draco/')`。

- [ ] **Step 4: 跑全部測試**

Run: `bun test tests/`
Expected: PASS

- [ ] **Step 5: Commit（M1 完成）**

```bash
git add components/ && git commit -m "feat(m1): arrow-key player with glb pokemon + follow camera"
```

---

### Task 5: M2 — SQLite schema（TDD）

**Files:**
- Create: `lib/db/schema.ts`, `lib/db/index.ts`
- Test: `tests/db.test.ts`

- [ ] **Step 1: 失敗測試（in-memory DB 插入/查詢）**

```ts
// tests/db.test.ts
import { expect, test } from 'bun:test'
import { createDb } from '../lib/db'
import { cards, priceSnapshots } from '../lib/db/schema'

test('insert and read a card with price snapshot', () => {
  const db = createDb(':memory:')
  db.insert(cards).values({
    tcgCardId: 'base1-58', name: 'Pikachu', setId: 'base1', number: '58',
    rarity: 'Common', imageSmall: 'https://x/s.png', imageLarge: 'https://x/l.png',
    photoPath: 'data/photos/1.jpg', pokedexNumbers: '[25]',
  }).run()
  const row = db.select().from(cards).all()[0]
  expect(row.name).toBe('Pikachu')
  db.insert(priceSnapshots).values({ cardId: row.id, market: 1.25, low: 0.5, mid: 1.5, high: 5, currency: 'USD' }).run()
  expect(db.select().from(priceSnapshots).all()).toHaveLength(1)
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `bun test tests/db.test.ts`
Expected: FAIL

- [ ] **Step 3: 實作 schema 與 createDb**

```ts
// lib/db/schema.ts
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const cards = sqliteTable('cards', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tcgCardId: text('tcg_card_id').notNull().unique(),
  name: text('name').notNull(),
  setId: text('set_id').notNull(),
  number: text('number').notNull(),
  rarity: text('rarity'),
  imageSmall: text('image_small').notNull(),
  imageLarge: text('image_large').notNull(),
  photoPath: text('photo_path'),
  pokedexNumbers: text('pokedex_numbers').notNull().default('[]'), // JSON array
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const priceSnapshots = sqliteTable('price_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cardId: integer('card_id').notNull().references(() => cards.id),
  market: real('market'), low: real('low'), mid: real('mid'), high: real('high'),
  currency: text('currency').notNull().default('USD'),
  fetchedAt: text('fetched_at').notNull().default(sql`(datetime('now'))`),
})

export const pokemonCache = sqliteTable('pokemon_cache', {
  dexId: integer('dex_id').primaryKey(),
  name: text('name').notNull(),
  statsJson: text('stats_json').notNull(),
  movesJson: text('moves_json').notNull(),
  cryUrl: text('cry_url'),
})
```

```ts
// lib/db/index.ts
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
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
);`

export function createDb(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const sqlite = new Database(path)
  sqlite.pragma('journal_mode = WAL')
  sqlite.exec(BOOTSTRAP)
  return drizzle(sqlite, { schema })
}

let _db: ReturnType<typeof createDb> | null = null
/** App 單例（route handlers 用） */
export function getDb() {
  if (!_db) _db = createDb('data/collection.db')
  return _db
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `bun test tests/db.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/db tests/db.test.ts && git commit -m "feat(m2): sqlite schema + bootstrap (TDD)"
```

---

### Task 6: M2 — TCG API 查詢層（TDD）

**Files:**
- Create: `lib/tcg.ts`
- Test: `tests/tcg.test.ts`

- [ ] **Step 1: 失敗測試**

```ts
// tests/tcg.test.ts
import { expect, test } from 'bun:test'
import { buildCardQuery, pickPrice, searchCards, type TcgCard } from '../lib/tcg'

test('buildCardQuery composes name/number/printedTotal, strips leading zeros', () => {
  expect(buildCardQuery({ name: 'Pikachu', number: '025', printedTotal: '193' }))
    .toBe('name:"Pikachu" number:25 set.printedTotal:193')
  expect(buildCardQuery({ name: 'Mew ex', number: null, printedTotal: null })).toBe('name:"Mew ex"')
})

test('pickPrice prefers holofoil market, falls back to any variant', () => {
  expect(pickPrice({ holofoil: { market: 12.3, low: 8, mid: 11, high: 20 } }))
    .toEqual({ market: 12.3, low: 8, mid: 11, high: 20, variant: 'holofoil' })
  expect(pickPrice({ normal: { market: 0.2, low: 0.1, mid: 0.3, high: 1 } })?.variant).toBe('normal')
  expect(pickPrice(undefined)).toBeNull()
})

test('searchCards calls v2 endpoint with encoded q and maps cards', async () => {
  let calledUrl = ''
  const fakeFetch = (async (url: string) => {
    calledUrl = url
    return new Response(JSON.stringify({ data: [{
      id: 'base1-58', name: 'Pikachu', number: '58', rarity: 'Common',
      set: { id: 'base1', name: 'Base', printedTotal: 102 },
      images: { small: 's.png', large: 'l.png' },
      nationalPokedexNumbers: [25],
      tcgplayer: { updatedAt: '2026/07/12', prices: { normal: { market: 1.2, low: 0.5, mid: 1, high: 3 } } },
    }] }))
  }) as unknown as typeof fetch
  const cards: TcgCard[] = await searchCards('name:"Pikachu"', { fetcher: fakeFetch, apiKey: 'k' })
  expect(calledUrl).toContain('https://api.pokemontcg.io/v2/cards?q=name%3A%22Pikachu%22')
  expect(cards[0].name).toBe('Pikachu')
  expect(cards[0].pokedexNumbers).toEqual([25])
  expect(cards[0].price?.market).toBe(1.2)
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `bun test tests/tcg.test.ts`
Expected: FAIL

- [ ] **Step 3: 實作**

```ts
// lib/tcg.ts
import { z } from 'zod'

export interface CardHint { name: string; number: string | null; printedTotal: string | null }

export function buildCardQuery(h: CardHint): string {
  const parts = [`name:"${h.name}"`]
  if (h.number) parts.push(`number:${parseInt(h.number, 10)}`)
  if (h.printedTotal) parts.push(`set.printedTotal:${parseInt(h.printedTotal, 10)}`)
  return parts.join(' ')
}

const VariantPrices = z.object({
  market: z.number().nullish(), low: z.number().nullish(),
  mid: z.number().nullish(), high: z.number().nullish(),
})
type Variant = z.infer<typeof VariantPrices>

export interface PickedPrice { market: number | null; low: number | null; mid: number | null; high: number | null; variant: string }

/** 優先 holofoil，其次任何有 market 的變體 */
export function pickPrice(prices: Record<string, Variant> | undefined): PickedPrice | null {
  if (!prices) return null
  const order = ['holofoil', 'reverseHolofoil', 'normal', ...Object.keys(prices)]
  for (const v of order) {
    const p = prices[v]
    if (p && p.market != null) {
      return { market: p.market ?? null, low: p.low ?? null, mid: p.mid ?? null, high: p.high ?? null, variant: v }
    }
  }
  return null
}

const ApiCard = z.object({
  id: z.string(), name: z.string(), number: z.string(),
  rarity: z.string().nullish(),
  set: z.object({ id: z.string(), name: z.string(), printedTotal: z.number() }),
  images: z.object({ small: z.string(), large: z.string() }),
  nationalPokedexNumbers: z.array(z.number()).nullish(),
  tcgplayer: z.object({ updatedAt: z.string(), prices: z.record(z.string(), VariantPrices) }).nullish(),
})

export interface TcgCard {
  id: string; name: string; number: string; rarity: string | null
  setId: string; setName: string; printedTotal: number
  imageSmall: string; imageLarge: string
  pokedexNumbers: number[]
  price: PickedPrice | null
  priceUpdatedAt: string | null
}

export async function searchCards(
  q: string,
  opts: { fetcher?: typeof fetch; apiKey?: string } = {},
): Promise<TcgCard[]> {
  const fetcher = opts.fetcher ?? fetch
  const headers: Record<string, string> = {}
  if (opts.apiKey) headers['X-Api-Key'] = opts.apiKey
  const res = await fetcher(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=10`, { headers })
  if (!res.ok) throw new Error(`TCG API ${res.status}`)
  const json = await res.json()
  return z.array(ApiCard).parse(json.data).map((c) => ({
    id: c.id, name: c.name, number: c.number, rarity: c.rarity ?? null,
    setId: c.set.id, setName: c.set.name, printedTotal: c.set.printedTotal,
    imageSmall: c.images.small, imageLarge: c.images.large,
    pokedexNumbers: c.nationalPokedexNumbers ?? [],
    price: pickPrice(c.tcgplayer?.prices),
    priceUpdatedAt: c.tcgplayer?.updatedAt ?? null,
  }))
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `bun test tests/tcg.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/tcg.ts tests/tcg.test.ts && git commit -m "feat(m2): tcg api query layer (TDD)"
```

---

### Task 7: M2 — Claude Vision 讀卡（TDD 解析層）

**Files:**
- Create: `lib/vision.ts`
- Test: `tests/vision.test.ts`

- [ ] **Step 1: 失敗測試（只測純解析，不打真 API）**

```ts
// tests/vision.test.ts
import { expect, test } from 'bun:test'
import { parseVisionResponse } from '../lib/vision'

test('parses plain json', () => {
  expect(parseVisionResponse('{"name":"Pikachu","number":"025","printedTotal":"193"}'))
    .toEqual({ name: 'Pikachu', number: '025', printedTotal: '193' })
})
test('parses fenced json and null fields', () => {
  expect(parseVisionResponse('```json\n{"name":"Mew ex","number":null,"printedTotal":null}\n```'))
    .toEqual({ name: 'Mew ex', number: null, printedTotal: null })
})
test('throws on garbage', () => {
  expect(() => parseVisionResponse('I cannot read this card')).toThrow()
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `bun test tests/vision.test.ts`
Expected: FAIL

- [ ] **Step 3: 實作**

```ts
// lib/vision.ts
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { CardHint } from './tcg'

const VisionCard = z.object({
  name: z.string().min(1),
  number: z.string().regex(/^\d+$/).nullable(),
  printedTotal: z.string().regex(/^\d+$/).nullable(),
})

export function parseVisionResponse(text: string): CardHint {
  const stripped = text.replace(/```json\s*|```/g, '').trim()
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error(`vision response has no JSON: ${text.slice(0, 80)}`)
  return VisionCard.parse(JSON.parse(stripped.slice(start, end + 1)))
}

const PROMPT = `你看到的是一張寶可夢集換式卡牌的照片。請讀出：
1. name：卡片最上方的寶可夢/卡片英文名稱（保留 ex/V/VMAX 等後綴）
2. number 與 printedTotal：卡片底部角落的收藏編號，格式如 "025/193" → number="025", printedTotal="193"
只回覆 JSON（不要其他文字）：{"name": string, "number": string|null, "printedTotal": string|null}
讀不到編號就填 null。`

export async function extractCardInfo(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  client?: Anthropic,
): Promise<CardHint> {
  const anthropic = client ?? new Anthropic()
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        { type: 'text', text: PROMPT },
      ],
    }],
  })
  const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
  return parseVisionResponse(text)
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `bun test tests/vision.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/vision.ts tests/vision.test.ts && git commit -m "feat(m2): claude vision card extraction (TDD parse layer)"
```

---

### Task 8: M2 — 掃描組合流程與交叉驗證（TDD）

**Files:**
- Create: `lib/scan.ts`
- Test: `tests/scan.test.ts`

- [ ] **Step 1: 失敗測試**

```ts
// tests/scan.test.ts
import { expect, test } from 'bun:test'
import { crossValidate, scanCard } from '../lib/scan'
import type { TcgCard } from '../lib/tcg'

const card = (over: Partial<TcgCard>): TcgCard => ({
  id: 'x', name: 'Pikachu', number: '58', rarity: null, setId: 's', setName: 'S',
  printedTotal: 102, imageSmall: '', imageLarge: '', pokedexNumbers: [25],
  price: null, priceUpdatedAt: null, ...over,
})

test('crossValidate flags exact-name candidates', () => {
  const out = crossValidate('Pikachu', [card({}), card({ id: 'y', name: 'Pikachu ex' })])
  expect(out.find((c) => c.id === 'x')?.validated).toBe(true)
  expect(out.find((c) => c.id === 'y')?.validated).toBe(false)
})

test('scanCard wires vision hint into tcg search', async () => {
  const result = await scanCard({
    extract: async () => ({ name: 'Pikachu', number: '58', printedTotal: '102' }),
    search: async (q) => {
      expect(q).toBe('name:"Pikachu" number:58 set.printedTotal:102')
      return [card({})]
    },
  })
  expect(result.hint.name).toBe('Pikachu')
  expect(result.candidates[0].validated).toBe(true)
})

test('scanCard retries name-only when strict query is empty', async () => {
  const queries: string[] = []
  const result = await scanCard({
    extract: async () => ({ name: 'Pikachu', number: '99', printedTotal: '102' }),
    search: async (q) => { queries.push(q); return q.includes('number') ? [] : [card({})] },
  })
  expect(queries).toHaveLength(2)
  expect(result.candidates).toHaveLength(1)
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `bun test tests/scan.test.ts`
Expected: FAIL

- [ ] **Step 3: 實作**

```ts
// lib/scan.ts
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
```

- [ ] **Step 4: 跑測試確認通過**

Run: `bun test tests/scan.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/scan.ts tests/scan.test.ts && git commit -m "feat(m2): scan pipeline with cross-validation + fallback (TDD)"
```

---

### Task 9: M2 — PokéAPI 快取層與入庫（TDD）

**Files:**
- Create: `lib/pokeapi.ts`, `lib/collection.ts`
- Test: `tests/collection.test.ts`

- [ ] **Step 1: 失敗測試**

```ts
// tests/collection.test.ts
import { expect, test } from 'bun:test'
import { createDb } from '../lib/db'
import { cards, pokemonCache, priceSnapshots } from '../lib/db/schema'
import { addCard, listCards } from '../lib/collection'
import type { TcgCard } from '../lib/tcg'

const tcgCard: TcgCard = {
  id: 'base1-58', name: 'Pikachu', number: '58', rarity: 'Common',
  setId: 'base1', setName: 'Base', printedTotal: 102,
  imageSmall: 's.png', imageLarge: 'l.png', pokedexNumbers: [25],
  price: { market: 1.2, low: 0.5, mid: 1, high: 3, variant: 'normal' },
  priceUpdatedAt: '2026/07/12',
}
const fakePokemon = async (dexId: number) => ({
  dexId, name: 'pikachu',
  stats: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 },
  moves: ['thunderbolt', 'quick-attack'],
  cryUrl: '/assets/cries/latest/25.ogg',
})

test('addCard inserts card + snapshot + pokemon cache; duplicate tcg id rejected', async () => {
  const db = createDb(':memory:')
  await addCard(db, tcgCard, 'data/photos/a.jpg', fakePokemon)
  expect(db.select().from(cards).all()).toHaveLength(1)
  expect(db.select().from(priceSnapshots).all()[0].market).toBe(1.2)
  expect(db.select().from(pokemonCache).all()[0].dexId).toBe(25)
  await expect(addCard(db, tcgCard, 'b.jpg', fakePokemon)).rejects.toThrow()
})

test('listCards returns latest price per card', async () => {
  const db = createDb(':memory:')
  await addCard(db, tcgCard, null, fakePokemon)
  const list = listCards(db)
  expect(list[0].name).toBe('Pikachu')
  expect(list[0].latestPrice).toBe(1.2)
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `bun test tests/collection.test.ts`
Expected: FAIL

- [ ] **Step 3: 實作 pokeapi.ts**

```ts
// lib/pokeapi.ts
export interface CachedPokemon {
  dexId: number; name: string
  stats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }
  moves: string[]
  cryUrl: string | null
}

const STAT_KEYS: Record<string, keyof CachedPokemon['stats']> = {
  hp: 'hp', attack: 'atk', defense: 'def',
  'special-attack': 'spa', 'special-defense': 'spd', speed: 'spe',
}

export async function getPokemon(dexId: number, fetcher: typeof fetch = fetch): Promise<CachedPokemon> {
  const res = await fetcher(`https://pokeapi.co/api/v2/pokemon/${dexId}`)
  if (!res.ok) throw new Error(`PokeAPI ${res.status} for #${dexId}`)
  const p = await res.json()
  const stats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
  for (const s of p.stats) {
    const k = STAT_KEYS[s.stat.name]
    if (k) stats[k] = s.base_stat
  }
  return {
    dexId, name: p.name, stats,
    moves: p.moves.slice(0, 40).map((m: { move: { name: string } }) => m.move.name),
    cryUrl: `/assets/cries/latest/${dexId}.ogg`, // 已下載到本地
  }
}
```

- [ ] **Step 4: 實作 collection.ts**

```ts
// lib/collection.ts
import { desc, eq } from 'drizzle-orm'
import type { createDb } from './db'
import { cards, pokemonCache, priceSnapshots } from './db/schema'
import type { TcgCard } from './tcg'
import type { CachedPokemon } from './pokeapi'

type Db = ReturnType<typeof createDb>
type PokemonFetcher = (dexId: number) => Promise<CachedPokemon>

export async function addCard(db: Db, card: TcgCard, photoPath: string | null, getPokemon: PokemonFetcher) {
  const inserted = db.insert(cards).values({
    tcgCardId: card.id, name: card.name, setId: card.setId, number: card.number,
    rarity: card.rarity, imageSmall: card.imageSmall, imageLarge: card.imageLarge,
    photoPath, pokedexNumbers: JSON.stringify(card.pokedexNumbers),
  }).returning().get()

  if (card.price) {
    db.insert(priceSnapshots).values({
      cardId: inserted.id, market: card.price.market, low: card.price.low,
      mid: card.price.mid, high: card.price.high, currency: 'USD',
    }).run()
  }

  for (const dexId of card.pokedexNumbers) {
    const exists = db.select().from(pokemonCache).where(eq(pokemonCache.dexId, dexId)).all()
    if (exists.length > 0) continue
    try {
      const p = await getPokemon(dexId)
      db.insert(pokemonCache).values({
        dexId, name: p.name, statsJson: JSON.stringify(p.stats),
        movesJson: JSON.stringify(p.moves), cryUrl: p.cryUrl,
      }).run()
    } catch {
      // PokéAPI 掛了不擋入庫，之後可重補
    }
  }
  return inserted
}

export function listCards(db: Db) {
  return db.select().from(cards).orderBy(desc(cards.createdAt)).all().map((c) => {
    const snap = db.select().from(priceSnapshots)
      .where(eq(priceSnapshots.cardId, c.id))
      .orderBy(desc(priceSnapshots.fetchedAt)).all()[0]
    return { ...c, pokedexNumbers: JSON.parse(c.pokedexNumbers) as number[], latestPrice: snap?.market ?? null }
  })
}
```

- [ ] **Step 5: 跑測試確認通過**

Run: `bun test tests/`
Expected: 全部 PASS

- [ ] **Step 6: Commit**

```bash
git add lib/ tests/ && git commit -m "feat(m2): pokeapi cache + collection add/list (TDD)"
```

---

### Task 10: M2 — API Routes（/api/scan、/api/collection）

**Files:**
- Create: `app/api/scan/route.ts`, `app/api/collection/route.ts`

- [ ] **Step 1: /api/scan（收照片 → 存檔 → vision → tcg → 候選）**

```ts
// app/api/scan/route.ts
import { NextResponse } from 'next/server'
import { mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { extractCardInfo } from '@/lib/vision'
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

  try {
    const result = await scanCard({
      extract: () => extractCardInfo(buf.toString('base64'), mediaType),
      search: (q) => searchCards(q, { apiKey: process.env.POKEMONTCG_API_KEY }),
    })
    return NextResponse.json({ ...result, photoPath })
  } catch (e) {
    return NextResponse.json({ error: String(e), photoPath }, { status: 502 })
  }
}
```

- [ ] **Step 2: /api/collection（GET 列表 / POST 入庫）**

```ts
// app/api/collection/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { addCard, listCards } from '@/lib/collection'
import { getPokemon } from '@/lib/pokeapi'
import type { TcgCard } from '@/lib/tcg'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({ cards: listCards(getDb()) })
}

export async function POST(req: Request) {
  const body = (await req.json()) as { card: TcgCard; photoPath: string | null }
  if (!body?.card?.id) return NextResponse.json({ error: 'card required' }, { status: 400 })
  try {
    const inserted = await addCard(getDb(), body.card, body.photoPath, getPokemon)
    return NextResponse.json({ ok: true, id: inserted.id })
  } catch (e) {
    const msg = String(e)
    const status = msg.includes('UNIQUE') ? 409 : 500
    return NextResponse.json({ error: status === 409 ? '這張卡已在收藏中' : msg }, { status })
  }
}
```

- [ ] **Step 3: 煙霧測試（curl，需 .env.local 有 ANTHROPIC_API_KEY）**

```bash
curl -s http://localhost:3000/api/collection   # → {"cards":[]}
# 用任一張卡片照片：
curl -s -F "photo=@/path/to/card.jpg" http://localhost:3000/api/scan | head -c 400
```

Expected: scan 回傳 `{hint, candidates[], photoPath}`；collection GET 回傳空陣列。

- [ ] **Step 4: Commit**

```bash
git add app/api && git commit -m "feat(m2): scan + collection api routes"
```

---

### Task 11: M2 — 掃卡 UI（/scan）

**Files:**
- Create: `app/scan/page.tsx`
- Modify: `app/page.tsx`（顯示收藏數）

- [ ] **Step 1: 掃卡頁**

```tsx
// app/scan/page.tsx
'use client'
import { useState } from 'react'
import type { Candidate } from '@/lib/scan'
import type { CardHint } from '@/lib/tcg'

type ScanResult = { hint: CardHint; candidates: Candidate[]; photoPath: string }

export default function ScanPage() {
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [message, setMessage] = useState('')

  async function onFile(file: File) {
    setPreview(URL.createObjectURL(file))
    setResult(null); setMessage(''); setBusy(true)
    const fd = new FormData()
    fd.append('photo', file)
    try {
      const res = await fetch('/api/scan', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setResult(json)
      if (json.candidates.length === 0) setMessage(`辨識為「${json.hint.name}」但查無此卡，請重拍或換角度`)
    } catch (e) {
      setMessage(`掃描失敗：${e}`)
    } finally { setBusy(false) }
  }

  async function save(c: Candidate) {
    const res = await fetch('/api/collection', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card: c, photoPath: result?.photoPath ?? null }),
    })
    const json = await res.json()
    setMessage(res.ok ? `✅ 已加入收藏：${c.name}` : `⚠️ ${json.error}`)
  }

  return (
    <main style={{ padding: 40, maxWidth: 900 }}>
      <h1>📷 拍卡入庫</h1>
      <p style={{ margin: '12px 0' }}>
        <input type="file" accept="image/*" capture="environment"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </p>
      {preview && <img src={preview} alt="preview" style={{ maxWidth: 260, borderRadius: 8 }} />}
      {busy && <p>🔍 辨識中…</p>}
      {message && <p style={{ margin: '12px 0' }}>{message}</p>}
      {result && result.candidates.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16 }}>
          {result.candidates.map((c) => (
            <div key={c.id} style={{ border: c.validated ? '2px solid #4caf50' : '1px solid #555', borderRadius: 8, padding: 12, width: 220 }}>
              <img src={c.imageSmall} alt={c.name} style={{ width: '100%' }} />
              <p><b>{c.name}</b> {c.validated && '✓'}</p>
              <p>{c.setName} · {c.number}/{c.printedTotal}</p>
              <p>{c.price?.market != null ? `市價 US$${c.price.market}` : '無市價資料'}</p>
              <button onClick={() => save(c)} style={{ marginTop: 8, padding: '6px 12px' }}>加入收藏</button>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 2: 主選單顯示收藏數**

```tsx
// app/page.tsx（覆寫）
async function getCount() {
  try {
    const { getDb } = await import('@/lib/db')
    const { listCards } = await import('@/lib/collection')
    return listCards(getDb()).length
  } catch { return 0 }
}

export default async function Home() {
  const count = await getCount()
  return (
    <main style={{ padding: 40 }}>
      <h1>Pokémon 3D Arena</h1>
      <p style={{ marginTop: 8, color: '#9aa' }}>收藏：{count} 張卡</p>
      <ul style={{ marginTop: 20, lineHeight: 2 }}>
        <li><a href="/scan">📷 拍卡入庫</a></li>
        <li><a href="/battle">⚔️ 對戰（M1 場景）</a></li>
      </ul>
    </main>
  )
}
```

- [ ] **Step 3: 端到端驗證（真卡照片）**

dev server 開 `/scan` → 上傳一張實體卡照片 → 看到候選卡（綠框 = 名稱交叉驗證通過）與美金市價 → 加入收藏 → 回首頁看到「收藏：1 張卡」→ 重複加同一張 → 看到「這張卡已在收藏中」。

- [ ] **Step 4: 跑全部測試 + Commit（M2 完成）**

```bash
bun test tests/
git add -A && git commit -m "feat(m2): scan ui + collection count"
```

---

## Self-Review 紀錄

1. **Spec coverage**：M1（骨架/Canvas/移動/GLB）→ Task 1–4；M2（辨識/查價/入庫/UI）→ Task 5–11；PRD F1 容錯（編號誤讀退回卡名查、重複卡 409、查無市價顯示）分別落在 Task 8/10/11。P0 缺口無。
2. **Placeholder scan**：無 TBD/TODO；所有步驟含完整程式碼。
3. **Type consistency**：`CardHint`（tcg.ts 定義、vision/scan 引用）、`TcgCard`（tcg → scan/collection/route）、`Candidate`（scan → UI）、`CachedPokemon`（pokeapi → collection）已對齊；`createDb(':memory:')` 供測試、`getDb()` 供 routes。

## 後續計畫（不在本文件）

- **Plan 2（M3）**：對戰系統 — AI 狀態機、@smogon/calc 傷害層、招式 hitbox、HUD、Gen 8 宮門體育場
- **Plan 3（M4+M5）**：寶可夢中心收藏館、畫風切換（pixel ↔ modern）、Gen 1 石英高原

## 執行期核准的計畫偏差（審查追認紀錄）

- Task 1：typescript 鎖 5.x（TS 7 與 Next 15 不相容）
- Task 3/4 修復：ArenaFloor 顯式 CuboidCollider、陰影視錐 ±22/±19、光源 [16,24,12]、GLB SkeletonUtils.clone + Box3 自動歸一化（取代固定 scale/offset）
- Task 5：雙 driver createDb（Bun 測試走 bun:sqlite、Next/Node 走 better-sqlite3，createRequire 繞過 bundler）
- Task 6 修復：searchCards 逐筆 safeParse、buildCardQuery 去除雙引號、錯誤含 statusText
- Task 7/8 修復：vision max_tokens 300→500、refusal/空回應明確拋錯、JSON.parse 錯誤含前 80 字元上下文；tsconfig 補 @types/bun

## M3 前置待辦（M1 code review 累積，刻意延後）

來自 Task 4 品質審查（詳見審查紀錄），開 M3 時優先處理：
1. 相機邏輯從 Player.useFrame 抽成 `useFollowCamera` hook（M3 戰鬥鏡頭會改寫）
2. 對手 dexId 動態化時加 `useGLTF.preload`，避免 Suspense pop-in
3. `camTarget` 模組級 Vector3 改 useRef（雙實例安全）
4. SPEED/lerp/鏡頭偏移等 magic numbers 收斂成 tunables 物件
5. 視覺高度 1.2 vs 膠囊高度 2.0 不一致 — M3 調 hitbox 時對齊
6. lib/showdown-name.ts 的 combining-mark regex 改 `̀-ͯ` 寫法（防編輯器 renormalize）
7. **moves.slice(0,40) 資料品質風險**：PokéAPI 招式表無排序，前 40 筆可能漏掉本系招、留下墊招 —— M3 選招邏輯（挑 2 招對應原型）要改成從完整招式表按威力/屬性篩選，或入庫時就篩
8. 資產路徑散落硬編碼（glb/cries）→ 收斂成 `assetPath(kind, dexId)` helper（做 M5 畫風切換時一併處理）
