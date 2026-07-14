# 本地素材清單（2026-07-13 下載完成，總計 1.0GB / 13,265 檔）

| 資料夾 | 內容 | 數量 | 大小 | 命名規則 |
|---|---|---|---|---|
| `glb/regular/` | 3D 模型（Draco+WebP 壓縮 .glb） | 974 | 319MB | **全國圖鑑編號** `25.glb` |
| `glb/mega/` `gmax/` `alolan/` `galar/` | 特殊形態模型 | 89 | 93MB | 圖鑑編號 |
| `sprites/gen1/`–`gen5/` | 各世代靜態像素圖（點陣模式） | 3,174 | 13MB | **小寫英文名** `pikachu.png`（形態加後綴 `-mega`） |
| `sprites/ani/` `ani-back/` | 現代動態 GIF 正/背面（動畫模式） | 3,261 | 290MB | 小寫英文名 `.gif` |
| `sprites/gen5ani/` `gen5ani-back/` | B/W 風動態 GIF 正/背面 | 2,392 | 113MB | 小寫英文名 `.gif` |
| `artwork/` | 官方立繪 475×475（fallback） | 1,339 | 165MB | 圖鑑編號 `25.png` |
| `cries/latest/` `legacy/` | 叫聲 .ogg | 1,351 | 31MB | 圖鑑編號 `25.ogg` |
| `hdri/` | Poly Haven 2k HDRI（CC0） | 6 | 36MB | 場景名 `venice_sunset_2k.hdr` |
| `fonts/` | Press Start 2P + DotGothic16 | 2 | 2.1MB | — |
| `icons/` | 屬性 SVG 圖示 | 18 | 72KB | 屬性英文名 |

## Key 對照

- **dexId 為主鍵**：glb / artwork / cries 直接用圖鑑編號取檔。
- **sprites 用英文名**：由 PokéAPI 的 `name` 轉小寫去標點（`mr-mime` → `mrmime`）；程式裡建一個 `dexId → showdownName` 對照表。
- HDRI 用途：venice_sunset（Gen7 海上）、moonless_golf（Gen5 夜間）、snowy_forest / snowy_park_01（Gen2 雪山）、potsdamer_platz / shanghai_bund（Gen8 都市夜景）。

## 重新下載

`scripts/download-{glb,sprites,misc,hdri}.sh` 可重跑補檔（皆為冪等，已存在的檔案會被覆蓋）。

⚠️ 除 hdri/（CC0）與 fonts/（OFL）外，其餘為任天堂版權素材 —— **僅限個人本機使用，勿公開部署或上傳 public repo**。
