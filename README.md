# Pokémon 3D Arena

個人版寶可夢卡片收藏 × 3D 對戰網站：拍實體卡 AI 辨識入庫查價（免 API key，走本機 Claude Code）、寶可夢中心 3D 收藏館、八世代聯盟賽戰場即時動作對戰（跳躍/控制技/世代招牌能力 Mega·Z 招式·極巨化）、點陣/動畫/現代 3D 三種畫風即時切換、真實冠軍戰 BGM。

> ⚠️ **版權聲明**：本 repo 只含程式碼。寶可夢模型、sprites、立繪、叫聲、音樂皆為任天堂/株式会社ポケモン版權物，repo 內建之輕量素材包**僅供課程教學與個人學習研究使用**，請勿公開部署、再散布或作商業用途。

## 安裝

```bash
bun install    # 依賴
bun run dev    # http://localhost:3000 — 素材已內建，clone 即玩！
```

repo 內建**輕量素材包**（107 隻精選寶可夢 + 全部戰場/BGM/字體，約 200MB）。想要完整 1025 隻：`bash scripts/setup-assets.sh`（約 1.1GB，會覆蓋 public/assets，git 會顯示大量變更——課程機不建議）。

- **拍卡辨識**：預設使用本機已登入的 Claude Code（免設定）；或在 `.env.local` 填 `ANTHROPIC_API_KEY` 走直連 API（較快）。`POKEMONTCG_API_KEY` 選填（免費申請，額度較高）。
- **手機掃卡**：`bun run dev` 會顯示 Network 網址，同 Wi-Fi 手機開 `/scan` 即可用相機拍卡。
- 測試：`bun test` ｜ 正式建置：`bun run build && bun run start`

## 操作

WASD 移動 · Space 跳躍 · J 近戰 / K 投射 / U 控制技 · L 疾走 · R 世代招牌能力（計量滿）· Tab 切換畫風 · 鏡頭自動鎖定對手

## 好友對戰（區網連線）

兩位玩家即時 1v1：位置/招式/招牌能力全同步，傷害由被打的一方權威結算（疾走 i-frames 照樣能閃掉對方的招）。

```bash
bun run pvp    # 任一台電腦（教室 = 老師機）啟動配對伺服器，port 3412
```

1. 兩位玩家各自 `bun run dev` 開自己的遊戲，進「對戰」→「🔗 好友對戰」
2. 伺服器欄輸入跑 `bun run pvp` 那台電腦的 IP（同一台就用 localhost）
3. 一人「建立房間」拿 4 碼房號 → 另一人輸入房號「加入房間」
4. 房主選戰場 → 各自選出戰寶可夢 → 自動開打；結束後可一鍵「再戰一場」

伺服器只做房號配對與訊息轉發（不跑遊戲邏輯），區網延遲 <5ms，教室即開即用。

覺得卡？網址加 `?lite`（如 `localhost:3000/battle?lite`）開低效能模式：關陰影/後處理、降解析度 —— 弱機或同一台電腦開兩個視窗測試時特別有感。正式對戰建議 `bun run build && bun run start`（production 比 dev 順很多）。

## 文件

| 文件 | 內容 |
|---|---|
| [docs/PRD.md](docs/PRD.md) | 產品需求：願景、四大功能、MVP 分期、驗收標準、風險 |
| [docs/DESIGN.md](docs/DESIGN.md) | 技術設計：Next.js + R3F 架構、畫風切換抽象、8 個世代戰場規格、即時對戰系統 |
| [docs/RESOURCES.md](docs/RESOURCES.md) | 資源庫：API / sprites / 3D 模型 / 音訊來源與驗證紀錄 |
| [docs/ASSETS-MANIFEST.md](docs/ASSETS-MANIFEST.md) | 素材清單與命名規則（glb/立繪/叫聲 = 圖鑑編號、sprites = 英文名） |

## 技術棧

Next.js 15 · React 19 · Three.js 0.185 · @react-three/fiber 9 · drei 10 · rapier 2 · zustand · SQLite（bun:sqlite / better-sqlite3 雙 driver）· Claude Agent SDK · Bun
