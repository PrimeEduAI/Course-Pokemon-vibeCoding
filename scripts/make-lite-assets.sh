#!/bin/bash
# 輕量素材包：從完整素材（public/assets）抽出課程用 ~107 隻寶可夢到指定目錄
# 用法：bash scripts/make-lite-assets.sh <輸出目錄>（預設 .lite-assets）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/public/assets"
DEST="${1:-$ROOT/.lite-assets}"

# dexId:showdown名（sprites 用名字，glb/立繪/叫聲用編號）
MONS="
1:bulbasaur 3:venusaur 4:charmander 6:charizard 7:squirtle 9:blastoise 12:butterfree
25:pikachu 26:raichu 39:jigglypuff 52:meowth 54:psyduck 59:arcanine 65:alakazam 68:machamp
94:gengar 104:cubone 113:chansey 129:magikarp 130:gyarados 131:lapras
133:eevee 134:vaporeon 135:jolteon 136:flareon 143:snorlax 147:dratini 149:dragonite 150:mewtwo 151:mew
152:chikorita 155:cyndaquil 158:totodile 172:pichu 175:togepi 196:espeon 197:umbreon
212:scizor 214:heracross 229:houndoom 230:kingdra 245:suicune 248:tyranitar 249:lugia 250:hooh 251:celebi
252:treecko 254:sceptile 255:torchic 257:blaziken 258:mudkip 260:swampert 282:gardevoir 302:sableye
334:altaria 350:milotic 359:absol 373:salamence 376:metagross 380:latias 381:latios 384:rayquaza
387:turtwig 390:chimchar 393:piplup 445:garchomp 448:lucario 470:leafeon 471:glaceon
483:dialga 484:palkia 487:giratina 491:darkrai
495:snivy 498:tepig 501:oshawott 571:zoroark 609:chandelure 635:hydreigon 643:reshiram 644:zekrom
650:chespin 653:fennekin 656:froakie 658:greninja 663:talonflame 700:sylveon 715:noivern 716:xerneas 717:yveltal
722:rowlet 725:litten 728:popplio 745:lycanroc 778:mimikyu 791:solgaleo 792:lunala
810:grookey 813:scorbunny 815:cinderace 816:sobble 842:appletun 849:toxtricity 870:falinks 887:dragapult 888:zacian 889:zamazenta
"

rm -rf "$DEST"
# 共用素材整包帶走：HDRI（CC0）、字體、屬性圖示、BGM
for d in hdri fonts icons bgm; do
  [ -d "$SRC/$d" ] && mkdir -p "$DEST/$d" && cp -R "$SRC/$d/." "$DEST/$d/"
done
mkdir -p "$DEST"/glb/{regular,mega,gmax,alolan,galar} "$DEST"/artwork "$DEST"/cries/latest
for s in gen1 gen2 gen3 gen4 gen5 gen5ani gen5ani-back ani ani-back; do mkdir -p "$DEST/sprites/$s"; done

count=0
for pair in $MONS; do
  id="${pair%%:*}"; name="${pair##*:}"
  cp "$SRC/glb/regular/$id.glb" "$DEST/glb/regular/" 2>/dev/null || echo "⚠️ 缺 regular glb: $id"
  for form in mega gmax alolan galar; do
    [ -f "$SRC/glb/$form/$id.glb" ] && cp "$SRC/glb/$form/$id.glb" "$DEST/glb/$form/"
  done
  cp "$SRC/artwork/$id.png" "$DEST/artwork/" 2>/dev/null || echo "⚠️ 缺立繪: $id"
  cp "$SRC/cries/latest/$id.ogg" "$DEST/cries/latest/" 2>/dev/null || echo "⚠️ 缺叫聲: $id"
  for s in gen1 gen2 gen3 gen4 gen5; do
    [ -f "$SRC/sprites/$s/$name.png" ] && cp "$SRC/sprites/$s/$name.png" "$DEST/sprites/$s/"
  done
  for s in gen5ani gen5ani-back ani ani-back; do
    [ -f "$SRC/sprites/$s/$name.gif" ] && cp "$SRC/sprites/$s/$name.gif" "$DEST/sprites/$s/"
  done
  count=$((count+1))
done

cp "$SRC/MANIFEST.md" "$DEST/" 2>/dev/null || true
echo "=== 輕量包完成：$count 隻 ==="
du -sh "$DEST" && du -sh "$DEST"/* | sort -rh | head -12