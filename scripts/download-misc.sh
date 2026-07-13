#!/bin/bash
# cries (PokeAPI), official artwork (PokeAPI sparse), type icons, fonts
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS="$ROOT/public/assets"

echo "=== 1. cries (PokeAPI/cries tarball) ==="
mkdir -p "$ASSETS/cries"
curl -sL https://codeload.github.com/PokeAPI/cries/tar.gz/refs/heads/main -o "$ROOT/.tmp-cries.tgz"
tar xzf "$ROOT/.tmp-cries.tgz" -C "$ROOT"
if [ -d "$ROOT/cries-main/cries/pokemon/latest" ]; then
  mv "$ROOT/cries-main/cries/pokemon/latest" "$ASSETS/cries/latest"
  [ -d "$ROOT/cries-main/cries/pokemon/legacy" ] && mv "$ROOT/cries-main/cries/pokemon/legacy" "$ASSETS/cries/legacy"
fi
rm -rf "$ROOT/cries-main" "$ROOT/.tmp-cries.tgz"
echo "cries: $(ls $ASSETS/cries/latest 2>/dev/null | wc -l) files"

echo "=== 2. official artwork (PokeAPI/sprites sparse) ==="
TMP="$ROOT/.tmp-art"
rm -rf "$TMP"
git clone --depth 1 --filter=blob:none --sparse https://github.com/PokeAPI/sprites.git "$TMP"
(cd "$TMP" && git sparse-checkout set sprites/pokemon/other/official-artwork)
mkdir -p "$ASSETS/artwork"
mv "$TMP/sprites/pokemon/other/official-artwork/"*.png "$ASSETS/artwork/" 2>/dev/null
rm -rf "$TMP"
echo "artwork: $(ls $ASSETS/artwork | wc -l) files"

echo "=== 3. type icons ==="
mkdir -p "$ASSETS/icons"
curl -sL https://codeload.github.com/duiker101/pokemon-type-svg-icons/tar.gz/refs/heads/master -o "$ROOT/.tmp-icons.tgz"
tar xzf "$ROOT/.tmp-icons.tgz" -C "$ROOT"
ICONDIR=$(find "$ROOT" -maxdepth 1 -type d -name 'pokemon-type-svg-icons-*' | head -1)
if [ -n "$ICONDIR" ]; then
  find "$ICONDIR" -name '*.svg' -exec cp {} "$ASSETS/icons/" \;
  rm -rf "$ICONDIR"
fi
rm -f "$ROOT/.tmp-icons.tgz"
echo "icons: $(ls $ASSETS/icons | wc -l) svgs"

echo "=== 4. fonts ==="
mkdir -p "$ASSETS/fonts"
curl -sfL "https://raw.githubusercontent.com/google/fonts/main/ofl/pressstart2p/PressStart2P-Regular.ttf" -o "$ASSETS/fonts/PressStart2P-Regular.ttf"
curl -sfL "https://raw.githubusercontent.com/google/fonts/main/ofl/dotgothic16/DotGothic16-Regular.ttf" -o "$ASSETS/fonts/DotGothic16-Regular.ttf"
ls -la "$ASSETS/fonts"
echo "misc done"
