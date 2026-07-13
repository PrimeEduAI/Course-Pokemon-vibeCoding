#!/bin/bash
# Real Pokémon battle BGM from KHInsider (downloads.khinsider.com) — PERSONAL USE ONLY.
# One league/champion battle theme per generation + a title theme, saved as gen1..gen8.mp3 / title.mp3.
# Two-step fetch: album track page → parse the direct CDN .mp3 in the audio player → download.
# Idempotent: re-downloads only files missing or <500KB. Source URLs pinned in the TRACKS table below
# (see also public/assets/bgm/SOURCES.md). Same style as scripts/download-*.sh.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
BASE="https://downloads.khinsider.com/game-soundtracks/album"
DEST="$ROOT/public/assets/bgm"
mkdir -p "$DEST"

# out|album-slug|track-file (single URL-encoded segment as it appears in the album page href)
TRACKS='
gen1|pokemon-firered-and-leafgreen-remastered-soundtrack-gba-gamerip-2004|39.%20Pokemon%20League%20Champion%20Battle.mp3
gen2|pokemon-heartgold-and-soulsilver|152.%20Battle%21%20%28Champion%29.mp3
gen3|pokemon-ruby-sapphire-and-emerald-remastered-soundtrack-gba-gamerip-2002-2005|49.%20Pokemon%20League%20Master-Champion%20Battle.mp3
gen4|pok-mon-diamond-pok-mon-pearl-super-music-collection-2006|168.%20Battle%21%20%28Champion%29.mp3
gen5|pokemon-black-and-white|4-12.%20Battle%21%20Champion.mp3
gen6|pokemon-x-y|3-26.%20Battle%21%20%28Champion%29.mp3
gen7|pokemon-ultra-sun-and-pokemon-ultra-moon-battle-music-selection|15.%20Battle%21%20%28Champion%29.mp3
gen8|pokemon-sword-shield-definitive-soundtrack-switch-gamerip-2020|108.%20Battle%21%20%28Champion%20Leon%29.mp3
title|pokemon-sun-moon-super-music-collection|1-01.%20Title%20Screen.mp3
'

MIN=512000  # 500KB floor
ok=0; fail=0
while IFS='|' read -r out slug file; do
  [ -z "${out:-}" ] && continue
  dest="$DEST/$out.mp3"
  # idempotent: keep existing files that already pass the size floor
  if [ -f "$dest" ] && [ "$(stat -f%z "$dest" 2>/dev/null || echo 0)" -ge "$MIN" ]; then
    echo "KEEP $out.mp3 ($(du -h "$dest" | cut -f1)) — already downloaded"
    ok=$((ok+1)); continue
  fi
  trackpage="$BASE/$slug/$file"
  # step 1: track page holds the direct CDN mp3 in the <audio>/download link
  mp3=$(curl -s -A "$UA" "$trackpage" | grep -oiE 'https?://[^"'"'"' ]+\.mp3' | head -1)
  if [ -z "$mp3" ]; then
    echo "FAIL $out — no mp3 link on track page: $trackpage"; fail=$((fail+1)); continue
  fi
  # step 2: download the actual audio
  if curl -sfL -A "$UA" "$mp3" -o "$dest"; then
    sz=$(stat -f%z "$dest" 2>/dev/null || echo 0)
    if [ "$sz" -ge "$MIN" ]; then
      echo "OK   $out.mp3 ($(du -h "$dest" | cut -f1)) ← $file"
      ok=$((ok+1))
    else
      echo "FAIL $out — downloaded only $sz bytes (<500KB)"; rm -f "$dest"; fail=$((fail+1))
    fi
  else
    echo "FAIL $out — download error from $mp3"; rm -f "$dest"; fail=$((fail+1))
  fi
done <<< "$TRACKS"

echo "=== BGM totals ($ok ok, $fail failed) ==="
ls -la "$DEST"/*.mp3 2>/dev/null
du -sh "$DEST" 2>/dev/null
