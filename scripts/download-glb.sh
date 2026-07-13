#!/bin/bash
# GLB 3D models from Pokemon-3D-api/assets (sparse: regular/mega/gmax/alolan/galar, no shiny/fusion)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/public/assets/glb"
TMP="$ROOT/.tmp-glb"
rm -rf "$TMP"
git clone --depth 1 --filter=blob:none --sparse https://github.com/Pokemon-3D-api/assets.git "$TMP"
cd "$TMP"
git sparse-checkout set models/opt/regular models/opt/mega models/opt/gmax models/opt/alolan models/opt/galar
mkdir -p "$DEST"
for d in regular mega gmax alolan galar; do
  [ -d "models/opt/$d" ] && mv "models/opt/$d" "$DEST/$d"
done
cd "$ROOT"
rm -rf "$TMP"
echo "GLB done:"
du -sh "$DEST"/* 2>/dev/null
find "$DEST" -name '*.glb' | wc -l
