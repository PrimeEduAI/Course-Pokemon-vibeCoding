#!/bin/bash
# 教室還原：程式碼回到 classroom-base 標籤，素材/依賴/金鑰不動
# 用法：bash scripts/classroom-reset.sh
set -euo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)"
if ! git rev-parse classroom-base >/dev/null 2>&1; then
  echo "找不到 classroom-base 標籤。先建立還原點："
  echo "  git add -A && git commit -m base && git tag classroom-base"
  exit 1
fi
git reset --hard classroom-base
git clean -fd --exclude=public/assets --exclude=node_modules --exclude=.env.local --exclude=data
echo "✅ 已還原到 classroom-base。重新整理瀏覽器即可（dev server 不用重開）。"
