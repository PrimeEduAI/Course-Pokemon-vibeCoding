#!/bin/bash
# Poly Haven 2k HDRIs (CC0) for arena environments; skips slugs that 404
set -uo pipefail
DEST="/Users/somer/Desktop/CL/ai-camp-curriculum/pokemon-3d-arena/public/assets/hdri"
mkdir -p "$DEST"
# arena moods: day stadium/outdoor, night city (Gen8), snow (Gen2), ocean sunset (Gen7), night sky (Gen5)
CANDIDATES="venice_sunset moonless_golf snowy_forest snowy_park_01 potsdamer_platz shanghai_bund kiara_1_dawn table_mountain_1 autumn_field industrial_sunset_02"
ok=0
for slug in $CANDIDATES; do
  url="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/${slug}_2k.hdr"
  if curl -sfL "$url" -o "$DEST/${slug}_2k.hdr"; then
    echo "OK  $slug ($(du -h "$DEST/${slug}_2k.hdr" | cut -f1))"
    ok=$((ok+1))
  else
    rm -f "$DEST/${slug}_2k.hdr"; echo "SKIP $slug (not found)"
  fi
  [ "$ok" -ge 6 ] && break
done
du -sh "$DEST"
