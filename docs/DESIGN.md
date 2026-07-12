# DESIGN — Pokémon 3D Arena 技術與視覺設計

> 版本：v1.0 ｜ 日期：2026-07-13 ｜ 搭配 PRD.md 閱讀
> 技術棧已於 2026-07 逐項驗證版本相容性（見 RESOURCES.md）。

---

## 1. 技術棧

| 層 | 選擇 | 版本（2026-07 驗證） | 理由 |
|---|---|---|---|
| 框架 | **Next.js**（App Router） | 15.x + React 19 | API Routes 保護金鑰（Claude API、TCG API key）；一個 repo 搞定前後端 |
| 3D | three + **@react-three/fiber** | three 0.185 / fiber 9.6 | R3F 9 專為 React 19 設計，與 Next 15 相容 |
| 3D 工具 | @react-three/drei | 10.7 | Environment、KeyboardControls、useGLTF、Html 等現成件 |
| 物理 | @react-three/rapier | 2.2 | 對戰碰撞、hitbox；WASM，client-only |
| 角色控制 | ecctrl | 2.0 | pmndrs 官方方向鍵角色控制器，建於 rapier 之上 |
| 後製 | @react-three/postprocessing | 3.0 | Bloom（聖火/燈光秀）、像素化 pass（點陣模式） |
| 傷害計算 | @smogon/calc | 0.11（鎖版本） | Showdown 官方傷害引擎，MIT，免手刻公式 |
| 狀態 | zustand | latest | R3F 生態標配，遊戲迴圈外狀態 |
| DB | SQLite（better-sqlite3 + Drizzle） | latest | 單用戶本機，零運維；照片存本地資料夾 |
| AI 辨識 | Claude API（vision） | claude-sonnet-5 | 讀卡名+編號夠用且便宜；claude-fable-5 留給疑難卡 |
| Runtime | **Bun**（dev/package manager） | latest | 用戶慣用 |

**Next.js 的 3D 注意事項**：所有 Canvas 元件標 `'use client'`；rapier（WASM）用 `dynamic(() => import(...), { ssr: false })` 載入；模型/貼圖走 `public/assets/` 本地化，不依賴外部 CDN 上線。

### 落選方案（記錄決策）
- **Vite + React**：3D DX 稍好，但查價/辨識需要另架後端，個人專案多一份運維成本。→ 落選。
- **Vite 前端 + Bun 後端**：彈性最大但兩個服務。→ 落選。
- **手刻傷害公式**：@smogon/calc 已涵蓋世代差異與相剋表。→ 不重造輪子。

## 2. 系統架構

```
┌─ Next.js App ──────────────────────────────────────────────┐
│                                                            │
│  app/(pages)                     app/api（server only）     │
│  ├─ /            主畫面（出戰+選場地）  ├─ /api/scan            │
│  ├─ /battle      對戰場景             │    Claude Vision 讀卡 │
│  ├─ /center      寶可夢中心收藏        ├─ /api/cards/search    │
│  └─ /scan        拍卡入庫             │    pokemontcg.io 代理  │
│                                     ├─ /api/collection      │
│  components/three/                  │    CRUD + 價格快取      │
│  ├─ renderables/  ← 畫風切換核心      └─ /api/prices/refresh  │
│  ├─ arenas/       ← 8 個世代戰場                              │
│  ├─ center/       ← 寶可夢中心場景     lib/                    │
│  └─ battle/       ← 戰鬥系統          ├─ db（Drizzle+SQLite）  │
│                                     ├─ tcg.ts / pokeapi.ts  │
│  stores/（zustand）                  └─ battle-engine/        │
│  ├─ useCollection  useBattle                                │
│  └─ useStyleMode（點陣/動畫/3D）                               │
└────────────────────────────────────────────────────────────┘
外部：Claude API ─ pokemontcg.io ─ PokéAPI ─ 本地素材（預下載）
```

### 資料流：拍卡入庫
```
照片 → POST /api/scan
  → Claude Vision：{ name: "Pikachu", number: "025", printedTotal: "193", setHint }
  → GET pokemontcg.io /v2/cards?q=name:pikachu number:25 set.printedTotal:193
  → 交叉驗證（API 回傳卡名 ≈ Vision 卡名，否則回候選清單讓我挑）
  → 寫入 SQLite：卡片資料 + tcgplayer 價格快照 + 原始照片路徑 + nationalPokedexNumbers
```
`nationalPokedexNumbers` 是卡片 → 對戰寶可夢的橋樑：入庫時順手抓 PokéAPI 的種族值/招式/叫聲存起來。

### 資料模型（核心表）
```sql
cards( id, tcg_card_id, name, set_id, number, rarity, image_small, image_large,
       photo_path, pokedex_numbers, created_at )
price_snapshots( id, card_id, market, low, mid, high, currency, fetched_at )
pokemon_cache( dex_id, name, stats_json, moves_json, sprite_urls_json, cry_url )
battles( id, arena_gen, my_team, result, style_mode, fought_at )
```

## 3. 畫風切換系統（核心抽象）

三種畫風共用一個介面，對戰引擎與場景完全不知道目前是哪種畫風：

```tsx
// 每隻場上的寶可夢都透過這個元件呈現
<PokemonRenderable dexId={25} mode={styleMode} state={battleState} />
// mode: 'pixel' | 'animated' | 'modern'
```

| mode | 實作 | 細節 |
|---|---|---|
| `pixel` | `<SpriteBillboard>` | Showdown gen1–gen5 PNG 貼 plane，`NearestFilter` 保持像素感，永遠面向鏡頭（Y 軸 billboard）；全畫面加輕度 pixelation pass + 可選 scanline |
| `animated` | `<AnimatedBillboard>` | Showdown ani GIF → **gifuct-js 解碼幀 → CanvasTexture 逐幀更新**（three 不能原生播 GIF）；背面用 ani-back 系列 |
| `modern` | `<GLBModel>` | Pokemon-3D-api 預轉換 GLB（Draco+WebP 已優化），`useGLTF` 載入；多數無骨架動畫 → 用程式化動畫補（見 §5） |

- 素材以 `dexId` 為 key 預先下載到 `public/assets/{pixel,ani,glb}/`，開發期可先熱鏈接。
- **缺料 fallback 鏈**：modern 缺模型 → 降到 animated → 降到 pixel → 官方立繪（PokéAPI official-artwork）。
- 切換時三套素材對當前隊伍 prefetch，達成 < 1s 切換。
- UI 主題跟隨：`pixel/animated` → 像素字體（Press Start 2P / DotGothic16）+ 硬邊框 UI；`modern` → 現代 UI。

## 4. 八個世代戰場（Arena 規格）

所有戰場共用底座：`<Arena>` = 戰鬥地板（40×24m 標準場 + Poké Ball 中圈）+ 觀眾席殼 + 天空/HDRI + 世代專屬布景。以下是每代的視覺 brief（依據遊戲版 + 動畫版聯盟賽研究，參考連結見 RESOURCES.md §10）：

| Gen | 場地 | 3D 場景關鍵元素 | 招牌機制/彩蛋 |
|---|---|---|---|
| 1 | 石英高原・石英大會 | 奧運村式白色體育場、石造+靛藍配色、火焰鳥聖火在場館頂端燃燒（粒子火焰+Bloom）、三角旗、日間光 | **四種場地材質可換**：草/岩/水/冰（同一場地換模組），低多邊形石像致敬初代 |
| 2 | 白銀大會（白銀山麓） | 雪頂白銀山背景、露天場館、鳳王聖火（彩虹色調火焰）、神社風火盆 | **機械旋轉換場**：地板旋轉滑動置換草/岩/水/冰模組的動畫演出 |
| 3 | 彩幽大會（豐緣） | 海島天堂：瀑布懸崖、花田、海平線；橘色高塔地標；大會用多球場 | **戰鬥中換場**：一方倒下後地板裂開旋轉換新地形；ORAS 和風城樓（熔岩/雪橋）可作變體 |
| 4 | 鈴蘭大會（神奧） | 哥德教堂剪影（玫瑰窗+雙塔尖）座落瀑布島上、夜間煙火、型態各異的發光屬性房 | 隨機場地輪盤（土/岩/草）；夜空煙火粒子秀 |
| 5 | 合眾聯盟（因幡大會） | 夜間山頂：中央高台+四座主題發光塔（鬼火圖書館/鐵籠擂台）、巨階梯通往山頂神殿、聚光燈束 | 最劇場化的燈光（strobe、月光、燭光各房個性）；彩蛋：N 的城堡從地面升起的演出 |
| 6 | 密阿雷大會（卡洛斯） | 蘭斯主教座堂式城堡、**六邊形母題**滿場（地板紋、體育場殼）、彩繪玻璃光束 | 元素機關房：火柱噴發、水淹房、旋轉鋼刃、龍翼展開（絕佳的 3D 動態布景）；隨機場地含「都市瓦礫」 |
| 7 | 瑪納羅大會（阿羅拉） | **海上露天球場**：四面環海、白色場館殼、黃金日光、節慶旗幟、美食攤位長廊 | 守護神剪影盤旋上空；替代版：拉納基拉山雪頂聯盟＋四道光束匯聚傳送台 |
| 8 | 宮門體育場（伽勒爾） | **足球場式巨蛋**：層疊看台+滿場觀眾、泛光燈塔、大螢幕、球員通道、LED 廣告板、倫敦夜景天際線（薔薇塔+摩天輪+大鐘樓）、雨夜氛圍 | 開場雷射燈光秀+煙火；**極巨化演出**：紅黑能量雲+寶可夢放大 20 倍+鏡頭拉遠（Phase 3） |

**觀眾實作**：instanced billboard 群（幾千個平面貼觀眾 sprite + 隨機揮手動畫），聲音用 crowd loop。
**性能預算**：每個戰場 ≤ 150k 三角形、≤ 30 draw calls（instancing 後）、貼圖 ≤ 64MB；HDRI 用 1k–2k。

## 5. 實時對戰系統

### 迴圈與操作
```
ecctrl（方向鍵移動，rapier 膠囊碰撞體）
  ├─ Z/Space：招式1（短CD 1.5s）  ├─ X：招式2（長CD 6s）
  ├─ C：衝刺/閃避（i-frame 0.3s） └─ V：換寶可夢（3s 動畫）
鏡頭：第三人稱跟隨（drei CameraControls），鎖定對手時肩後視角
```

### 傷害：官方公式 × 即時制
- 招式命中（rapier sensor 碰撞判定）時呼叫 `@smogon/calc` 的 `calculate(gen, attacker, defender, move)` 取傷害區間 → 取隨機值套用。
- 保留：屬性相剋、本系加成（STAB）、種族值/等級（統一 Lv.50）。
- 移除：命中率擲骰（即時制中「打不打得到」由玩家操作決定）、速度值（改為影響移動速度與冷卻 −10%~+10%）。
- 招式子彈類型三種原型：**近戰揮擊**（扇形 hitbox）、**投射物**（火球/水彈，直線飛行）、**範圍**（地震，圓形衝擊波）。每隻寶可夢從 PokéAPI 招式表選 2 個對應原型的招式。
- `@smogon/calc` 的世代資料 1–2MB → `dynamic import`，只載當前世代。

### AI 對手（狀態機）
```
IDLE → APPROACH（距離>攻擊圈）→ ATTACK（進圈+CD好）→ RETREAT（血量<30%或剛出招）
難度：Easy 反應 800ms / Normal 400ms / Hard 200ms + 會預判閃避
```

### 程式化動畫（補 GLB 無骨架動畫的缺）
待機：sin 浮動+呼吸縮放；移動：朝向插值+彈跳；攻擊：快速前傾 squash；受擊：材質閃白 0.1s + 击退；倒下：傾倒+下沉+粒子。點陣/動畫模式天然有 sprite 動態，僅需位移。

## 6. 寶可夢中心場景（收藏頁）

- 場景：經典紅頂大廳一室（自建低多邊形場景，Blender 或程式化幾何）：櫃台、治療機（可互動彩蛋：把隊伍放上去播放治療音效）、電腦區、卡片展示牆。
- 移動：與對戰同一套 ecctrl 方向鍵走動（操作一致性），或切「展示模式」自動環繞。
- 卡片牆：instanced 卡片平面（官方卡圖貼圖），走近後 hover 高亮 → 點擊進入檢視。
- 卡片檢視：3D 卡片翻轉（正面官方圖/背面我拍的照片），閃卡用視角相關的 iridescence shader（Phase 2）；側欄顯示市價、價格歷史 sparkline、入庫日期。
- 召喚：檢視卡片時按「召喚」→ 對應寶可夢（當前畫風模式）出現在大廳地板，播放叫聲（PokéAPI cries .ogg）。

## 7. 錯誤處理

| 情境 | 行為 |
|---|---|
| Vision 辨識不到/低信心 | 回傳候選清單 + 手動搜尋框；照片保留可重試 |
| TCG API 逾時/限流（20k/day 有 key） | 指數退避重試 ×3 → 使用上次快照價格並標註「快取價」 |
| 卡片查無價格（老卡/促銷卡） | 顯示「無市價資料」，允許手動填參考價 |
| 模型/素材 404 | fallback 鏈（§3）；console 記錄缺料清單方便補抓 |
| WebGL context lost | 全螢幕提示 + 重載 Canvas；battle state 在 zustand，可原地復活 |
| SQLite 寫入失敗 | 寫入前 WAL 模式；照片先落盤再寫 DB，孤兒照片可重掃 |

## 8. 測試策略

- **單元**（bun test）：TCG 查詢字串組裝、Vision 回應解析與交叉驗證、傷害轉換層（@smogon/calc 包裝）、fallback 鏈選擇邏輯。
- **整合**：/api/scan 用固定測試卡照片（3 張正常 + 1 張反光 + 1 張日文卡預期失敗）打真 API 的煙霧測試腳本。
- **3D/手動**：每個 arena 一個 Storybook-style 獨立預覽路由（`/dev/arena/3`），fps meter 常駐；對戰手感靠玩（個人專案，不自動化 e2e 3D）。
- **性能守門**：`r3f-perf` 開發面板；預算超標（§4)即優化再合併。

## 9. 里程碑（對應 PRD Phase）

1. **M1 骨架**：Next.js + R3F 跑起來，一個空戰場 + ecctrl 走動 + 一隻 GLB 皮卡丘
2. **M2 掃卡**：/api/scan 全流程通（拍照→辨識→查價→入庫）
3. **M3 對戰 MVP**：1v1 vs AI、傷害計算、Gen 8 宮門體育場
4. **M4 收藏館**：寶可夢中心場景 + 卡片牆 + 檢視
5. **M5 畫風切換**：pixel ↔ modern 兩檔 + Gen 1 石英高原
6. **M6+**：其餘戰場、animated 檔、音效音樂、3v3、閃卡 shader
