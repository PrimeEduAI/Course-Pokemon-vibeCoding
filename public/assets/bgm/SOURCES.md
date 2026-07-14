# BGM 來源清單（KHInsider · 個人使用）

> ⚠️ 版權：全部為任天堂/GAME FREAK 的寶可夢配樂，僅供本專案**本機個人使用**，不公開部署、不進 public repo（`public/assets/` 已 gitignore）。
> 下載腳本：[`scripts/download-bgm.sh`](../../../scripts/download-bgm.sh)（冪等，缺檔或 <500KB 才重抓）。
> 抓法：KHInsider 兩段式 — 曲目頁 (`downloads.khinsider.com/game-soundtracks/album/<專輯>/<曲名>.mp3`) 內含播放器的直連 CDN mp3，解析後下載。

每代選一首聯盟／冠軍戰主題，另加一首標題曲備用。檔名對應 `arenaId`（gen1…gen8），戰鬥掛載時播 `/assets/bgm/{arenaId}.mp3`。

| 檔案 | 世代／戰場 | 遊戲來源 | 曲目 | 位元率 | 大小 |
|---|---|---|---|---|---|
| gen1.mp3 | Gen 1 · 石英高原 | FireRed & LeafGreen (GBA gamerip) | Pokemon League Champion Battle（勁敵冠軍戰） | 128k | 2.5M |
| gen2.mp3 | Gen 2 · 白銀山麓 | HeartGold & SoulSilver | Battle! (Champion)（電擊冠軍．蘭斯） | 64k | 5.0M |
| gen3.mp3 | Gen 3 · 彩幽大會 | Ruby/Sapphire/Emerald (GBA remastered gamerip) | Pokemon League Master-Champion Battle（豐緣冠軍戰） | 128k | 2.2M |
| gen4.mp3 | Gen 4 · 鈴蘭大會 | Diamond & Pearl (Super Music Collection) | Battle! (Champion)（冠軍竹蘭戰） | 64k | 5.2M |
| gen5.mp3 | Gen 5 · 因幡大會 | Black & White | Battle! Champion（冠軍阿戴克戰） | 320k | 5.5M |
| gen6.mp3 | Gen 6 · 密阿雷大會 | X & Y | Battle! (Champion)（冠軍卡露妮戰） | 64k | 6.7M |
| gen7.mp3 | Gen 7 · 瑪納羅大會 | Ultra Sun & Ultra Moon (Battle Music Selection) | Battle! (Champion)（冠軍戰） | 128k | 6.7M |
| gen8.mp3 | Gen 8 · 宮門體育場 | Sword & Shield (Switch gamerip) | Battle! (Champion Leon)（冠軍丹帝戰） | 64k | 12M |
| title.mp3 | （備用，未接線） | Sun & Moon (Super Music Collection) | Title Screen（標題畫面） | 64k | 4.2M |

## 曲目頁 URL（兩段式抓取的第一段）

- gen1 — `https://downloads.khinsider.com/game-soundtracks/album/pokemon-firered-and-leafgreen-remastered-soundtrack-gba-gamerip-2004/39.%20Pokemon%20League%20Champion%20Battle.mp3`
- gen2 — `https://downloads.khinsider.com/game-soundtracks/album/pokemon-heartgold-and-soulsilver/152.%20Battle%21%20%28Champion%29.mp3`
- gen3 — `https://downloads.khinsider.com/game-soundtracks/album/pokemon-ruby-sapphire-and-emerald-remastered-soundtrack-gba-gamerip-2002-2005/49.%20Pokemon%20League%20Master-Champion%20Battle.mp3`
- gen4 — `https://downloads.khinsider.com/game-soundtracks/album/pok-mon-diamond-pok-mon-pearl-super-music-collection-2006/168.%20Battle%21%20%28Champion%29.mp3`
- gen5 — `https://downloads.khinsider.com/game-soundtracks/album/pokemon-black-and-white/4-12.%20Battle%21%20Champion.mp3`
- gen6 — `https://downloads.khinsider.com/game-soundtracks/album/pokemon-x-y/3-26.%20Battle%21%20%28Champion%29.mp3`
- gen7 — `https://downloads.khinsider.com/game-soundtracks/album/pokemon-ultra-sun-and-pokemon-ultra-moon-battle-music-selection/15.%20Battle%21%20%28Champion%29.mp3`
- gen8 — `https://downloads.khinsider.com/game-soundtracks/album/pokemon-sword-shield-definitive-soundtrack-switch-gamerip-2020/108.%20Battle%21%20%28Champion%20Leon%29.mp3`
- title — `https://downloads.khinsider.com/game-soundtracks/album/pokemon-sun-moon-super-music-collection/1-01.%20Title%20Screen.mp3`

實際 CDN 直連 mp3 由曲目頁 HTML 解析取得（`jetta.vgmtreasurechest.com` / `*.khinsider` 等網域，會隨時間變動，故腳本每次重解析而非寫死）。
