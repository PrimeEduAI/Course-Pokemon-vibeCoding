#!/bin/bash
# Showdown sprite sets mirrored from play.pokemonshowdown.com/sprites/
# pixel mode: gen1-gen5 static PNG; animated mode: gen5ani/ani GIF (front+back)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="https://play.pokemonshowdown.com/sprites"
DEST="$ROOT/public/assets/sprites"
DIRS="gen1 gen2 gen3 gen4 gen5 gen5ani gen5ani-back ani ani-back"
for dir in $DIRS; do
  mkdir -p "$DEST/$dir"
  echo "=== $dir ==="
  curl -s "$BASE/$dir/" \
    | grep -oE 'href="\./[^"]+\.(png|gif)"' \
    | sed -E 's/href="\.\///; s/"$//' \
    | sort -u > "$DEST/$dir/.filelist"
  count=$(wc -l < "$DEST/$dir/.filelist" | tr -d ' ')
  echo "$dir: $count files"
  (cd "$DEST/$dir" && xargs -P 16 -I{} curl -sfO "$BASE/$dir/{}" < .filelist)
  got=$(ls "$DEST/$dir" | grep -cE '\.(png|gif)$')
  echo "$dir: downloaded $got/$count"
done
echo "=== sprite totals ==="
du -sh "$DEST"/*
