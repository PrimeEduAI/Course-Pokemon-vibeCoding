# RESOURCES — 資源庫（全部於 2026-07-13 逐項驗證可用）

> ✅ **素材已全數下載到本地** `public/assets/`（1.0GB / 13,265 檔），清單與命名規則見 [public/assets/MANIFEST.md](../public/assets/MANIFEST.md)，下載腳本在 `scripts/`。GLB/立繪/叫聲以**圖鑑編號**命名，sprites 以**小寫英文名**命名。

> ⚠️ 版權提醒：寶可夢模型/sprite/音樂皆為任天堂 IP。本專案**限個人本機使用**，不公開部署、不放 public repo。CC0 類（Poly Haven、ambientCG）無此限制。

---

## 1. 卡片資料 + 查價

### Pokémon TCG API（主力）✅ 已驗證存活，價格每日更新
- **Endpoint**：`https://api.pokemontcg.io/v2/cards` ｜ 文件：https://docs.pokemontcg.io/
- **金鑰**：免費申請 https://dev.pokemontcg.io/ → header `X-Api-Key`
- **限流**：無鑰 1,000/day（30/min）；有鑰 **20,000/day**
- **價格**：卡片物件內建 `tcgplayer.prices`（low/mid/high/market，依卡種 normal/holofoil 分列）+ `updatedAt`（驗證時為前一日，近每日更新）；另有 `cardmarket`（歐元，月更）
- **卡圖**：`images.pokemontcg.io` 可直連（small/large/hires PNG）
- **查詢範例**：`?q=name:pikachu number:25 set.printedTotal:193`
- **⚠️ 注意**：團隊已轉向商業產品 Scrydex（pokemontcg.io 顯示 "Now part of Scrydex"），v2 免費 API 仍運作但視為維護模式 → **入庫時全量快取卡片資料與價格**
- **備援**：TCGdex https://tcgdex.dev（免費開源、免金鑰、多語言，**無市價**）；Scrydex https://scrydex.com（免費層含價格）

### 卡片辨識
- **主方案**：Claude Vision（`claude-sonnet-5`）讀「卡名 + 右下角編號（025/193 格式）」→ 查 TCG API 交叉驗證。社群同款管線參考：https://github.com/xavidop/cardex
- **商用替代**（若要更高精度/日文卡）：Ximilar TCG Identifier（付費 API，支援日/中/韓文卡）、CardGrader.ai
- **坑**：閃卡反光與日文卡會干擾辨識 → 先裁切卡片區域、明確要求讀左下/右下角文字；Vision 可能幻覺編號 → 一律用 API 回傳卡名反驗

## 2. 寶可夢遊戲資料

### PokéAPI ✅ 活躍維護
- `https://pokeapi.co/api/v2/pokemon/{id}` — 種族值、屬性、招式表；免金鑰，fair-use（**務必本地快取**）
- 招式細節：`/api/v2/move/{id}`（威力/PP/屬性/物特分類）
- **叫聲（2024 起內建）**：`cries.latest` / `cries.legacy` → `.ogg`（repo: https://github.com/PokeAPI/cries）；⚠️ 舊 Safari 不吃 ogg，需要就轉 mp3

### 傷害計算：@smogon/calc ✅ v0.11.0（2026 初仍在發版）
- `bun add @smogon/calc` ｜ repo: https://github.com/smogon/damage-calc ｜ MIT
- `calculate(gen, attacker, defender, move)` → 傷害區間 + KO 率
- **坑**：0.x 有 breaking change 風險 → **鎖版本**；世代資料每份 1–2MB → dynamic import

## 3. 2D Sprites（點陣 + 動畫模式）

### Pokémon Showdown CDN ✅ 可直連（2026-06 仍在更新）
- 根目錄：https://play.pokemonshowdown.com/sprites/
- `gen1/`–`gen5/`：各世代靜態像素圖（點陣模式，`gen5/pikachu.png`）
- `gen5ani/`、`gen5ani-back/`、`ani/`、`ani-back/`（+`-shiny` 變體）：動態 GIF（動畫模式，正/背面）
- 命名：小寫去標點（`mr. mime` → `mrmime`）
- **坑**：遊戲 CDN 無 SLA → 開發期熱鏈，完成後**整包下載到 `public/assets/`**（打包版 repo: https://github.com/smogon/sprites）

### PokéAPI sprites（fallback 官方立繪）
- 官方立繪 475×475：`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{id}.png`
- Gen 5 動態 gif 也有鏡像：`sprites.versions["generation-v"]["black-white"].animated`
- 整包下載：https://github.com/PokeAPI/sprites

### GIF → Three.js 播放
- **gifuct-js**（https://github.com/matt-way/gifuct-js）解碼幀 → `CanvasTexture` 逐幀更新（three 不原生播 GIF）

## 4. 3D 模型（現代模式）

### Pokemon-3D-api GLB 合集（首選，免 Blender）✅
- Org：https://github.com/Pokemon-3D-api ｜ 素材 repo：https://github.com/Pokemon-3D-api/assets
- **1,300+ 已優化 .glb**（Draco + WebP 壓縮），涵蓋 Gen 1–9、色違、Mega、超極巨、地區形態，按世代分資料夾，另有回傳模型 URL 的 REST API
- 直接餵 drei `useGLTF`；⚠️ 原始 repo（Sudhanshu-Ambastha/Pokemon-3D-api）2026-06 已封存 → 用 org 版
- **坑**：多數模型**無骨架動畫**（bind pose）→ 用程式化動畫補（見 DESIGN §5）

### The Models Resource（備用/要特定模型時）
- X/Y（3DS，低模適合網頁）：https://models.spriters-resource.com/3ds/pokemonxy/
- 劍盾（Switch，Gen 1–8）：https://models.spriters-resource.com/nintendo_switch/pokemonswordshield/
- 格式多為 .dae + 貼圖 → **Blender 匯入 → 修材質/alpha → 匯出 .glb** → `gltf-transform` / `gltfpack` 壓縮
- **坑**：rip 模型常見法線反轉、透明貼圖問題（Pokemon-3D-api 的 GLB 已修好這些）

### 場景自建素材
- 寶可夢中心、競技場結構：Blender 自建低模 or 程式化幾何（見 DESIGN §4/§6 規格）

## 5. 音訊

| 用途 | 來源 | 備註 |
|---|---|---|
| 寶可夢叫聲 | PokéAPI `cries.latest`（.ogg） | 免費、按 dexId，零工作量 |
| 戰鬥 BGM（各世代聯盟曲） | KHInsider https://downloads.khinsider.com/ | MP3/FLAC 整專輯；個人使用 |
| 原始音源格式 | Zophar's Domain https://www.zophar.net/music | 2SF/GSF 等 + MP3 |
| 音效播放 | howler.js 或 drei `<PositionalAudio>` | 3D 空間音效（觀眾聲、腳步） |

## 6. 環境素材（CC0，無版權疑慮）

- **Poly Haven** https://polyhaven.com/hdris — HDRI 全 CC0；網頁用 1k–2k（4k 的 .hdr 要 20–50MB）；drei `<Environment>` 可直接吃
- **ambientCG** https://ambientcg.com — PBR 材質（草地/岩石/冰面/水面 → 四種場地模組的材質來源）

## 7. npm 套件版本表（2026-07-13 於 npm registry 驗證）

```jsonc
{
  "three": "0.185.1",
  "@react-three/fiber": "9.6.1",        // 需 React 19；Next 15 相容
  "@react-three/drei": "10.7.7",        // v10 配 fiber v9
  "@react-three/postprocessing": "3.0.4",
  "@react-three/rapier": "2.2.0",       // v2 = fiber9+React19；WASM，client-only
  "ecctrl": "2.0.0",                    // ⚠️ v2 API 與 v1 大改，照 v2 README
  "@smogon/calc": "0.11.0",             // 鎖版本
  "zustand": "latest",
  "gifuct-js": "latest",
  "better-sqlite3": "latest",
  "drizzle-orm": "latest",
  "howler": "latest"
}
```
開發工具：`r3f-perf`（fps 面板）、`gltf-transform`（模型壓縮）、`leva`（3D 場景調參）。

## 8. AI / 後端服務

- **Claude API**：vision 讀卡。`claude-sonnet-5` 為主（便宜夠用）；金鑰放 `.env.local`，只在 API Route 使用
- 照片儲存：本地 `data/photos/`（不進 public，經 API route 供圖）
- DB：本地 SQLite 檔 `data/collection.db`

## 9. 字體 / UI

- 像素模式：Press Start 2P（英數）、DotGothic16（日文/假名）— Google Fonts，下載自託管
- 現代模式：系統字體堆疊或 Inter
- 屬性圖示/球種圖示：https://github.com/duiker101/pokemon-type-svg-icons（社群 SVG）或自繪

## 10. 世代戰場視覺參考（Bulbapedia）

| Gen | 遊戲版場地 | 動畫版大會 |
|---|---|---|
| 1 | [Indigo Plateau](https://bulbapedia.bulbagarden.net/wiki/Indigo_Plateau) | [Indigo Plateau Conference](https://bulbapedia.bulbagarden.net/wiki/Indigo_Plateau_Conference) |
| 2 | 同石英高原（HGSS 版） | [Silver Conference](https://bulbapedia.bulbagarden.net/wiki/Silver_Conference)、[Mt. Silver](https://bulbapedia.bulbagarden.net/wiki/Mt._Silver) |
| 3 | [Hoenn League](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_League_(Hoenn)) | [Ever Grande Conference](https://bulbapedia.bulbagarden.net/wiki/Ever_Grande_Conference) |
| 4 | [Sinnoh League](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_League_(Sinnoh)) | [Lily of the Valley Conference](https://bulbapedia.bulbagarden.net/wiki/Lily_of_the_Valley_Conference) |
| 5 | [Unova League](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_League_(Unova)) | [Vertress Conference](https://bulbapedia.bulbagarden.net/wiki/Vertress_Conference) |
| 6 | [Kalos League](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_League_(Kalos)) | [Lumiose Conference](https://bulbapedia.bulbagarden.net/wiki/Lumiose_Conference) |
| 7 | [Alola League](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_League_(Alola)) | [Manalo Conference](https://bulbapedia.bulbagarden.net/wiki/Manalo_Conference)、[Manalo Stadium](https://bulbapedia.bulbagarden.net/wiki/Manalo_Stadium) |
| 8 | [Wyndon Stadium](https://bulbapedia.bulbagarden.net/wiki/Wyndon_Stadium)、[Wyndon](https://bulbapedia.bulbagarden.net/wiki/Wyndon) | [Masters Eight](https://bulbapedia.bulbagarden.net/wiki/Masters_Eight_Tournament)、[World Coronation Series](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_World_Coronation_Series) |

各代場地輪替機制速查（做為對戰場地模組的依據）：

| Gen | 場地系統 |
|---|---|
| 1 | 四個固定衛星場地：草/岩/水/冰；決賽在主場館素場 |
| 2 | 單一場館**機械旋轉**換草/岩/水/冰 |
| 3 | 隨機草/岩/水/冰，**戰鬥中段換場**（一方倒 3 隻後） |
| 4 | 隨機主題場地：土/岩/草 |
| 5 | **無主題場地**（純素場，靠燈光劇場感） |
| 6 | 隨機生成：水岩/草原/都市/荒地/森林 |
| 7 | 標準素場，海上露天球場（重氛圍不重地形） |
| 8 | 足球場草皮（遊戲）/素場（動畫）；重點是極巨化與燈光秀 |
