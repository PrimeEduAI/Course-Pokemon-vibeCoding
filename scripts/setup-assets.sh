#!/bin/bash
# 一鍵重建 public/assets/（素材不進 git —— clone 後執行本腳本從原始來源下載）
# 總下載量約 1.1GB；全部腳本皆冪等，中斷可重跑。
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"

echo "🎮 Pokémon 3D Arena — 素材安裝（約 1.1GB，視網速 5–20 分鐘）"
echo
bash "$HERE/download-glb.sh"      # 3D 模型（Pokemon-3D-api，~412MB）
bash "$HERE/download-sprites.sh"  # 點陣/動態 sprites（Showdown CDN，~416MB）
bash "$HERE/download-misc.sh"     # 叫聲/官方立繪/屬性圖示/字體（~200MB）
bash "$HERE/download-hdri.sh"     # 環境 HDRI（Poly Haven CC0，~36MB）
bash "$HERE/download-bgm.sh"      # 戰鬥 BGM（KHInsider，~50MB，個人使用）
echo
echo "✅ 完成。執行 bun install && bun run dev 開始遊玩。"
