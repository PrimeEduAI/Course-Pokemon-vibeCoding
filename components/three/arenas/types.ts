/** 世代戰場註冊表：Gen 1–8。 */

export type ArenaId = 'gen1' | 'gen2' | 'gen3' | 'gen4' | 'gen5' | 'gen6' | 'gen7' | 'gen8'

export type FieldType = 'grass' | 'rock' | 'water' | 'ice'

export const FIELD_TYPES: FieldType[] = ['grass', 'rock', 'water', 'ice']

export const FIELD_LABEL: Record<FieldType, string> = {
  grass: '草場地',
  rock: '岩場地',
  water: '水場地',
  ice: '冰場地',
}

export interface ArenaDef {
  id: string
  gen: number
  nameZh: string
  nameEn: string
  /** HUD 主橫幅 */
  bannerZh: string
  /** HUD 小字（聯盟英文名） */
  bannerEn: string
  /** 選場卡片一句話 */
  flavor: string
  /** 卡片強調色 */
  accent: string
  playable: boolean
}

export const ARENAS: ArenaDef[] = [
  {
    id: 'gen1', gen: 1, nameZh: '石英高原', nameEn: 'INDIGO PLATEAU',
    bannerZh: '石英高原 · 石英大會決賽', bannerEn: 'INDIGO POKÉMON LEAGUE',
    flavor: '四場地與火焰鳥聖火', accent: '#8ea2ff', playable: true,
  },
  {
    id: 'gen2', gen: 2, nameZh: '白銀山麓', nameEn: 'MT. SILVER',
    bannerZh: '白銀大會', bannerEn: 'JOHTO POKÉMON LEAGUE',
    flavor: '白銀山·機械旋轉場地', accent: '#c9d6e8', playable: false,
  },
  {
    id: 'gen3', gen: 3, nameZh: '彩幽大會', nameEn: 'EVER GRANDE',
    bannerZh: '彩幽大會', bannerEn: 'HOENN POKÉMON LEAGUE',
    flavor: '海島瀑布·戰鬥中換場', accent: '#4fd0a0', playable: false,
  },
  {
    id: 'gen4', gen: 4, nameZh: '鈴蘭大會', nameEn: 'LILY OF THE VALLEY',
    bannerZh: '鈴蘭大會', bannerEn: 'SINNOH POKÉMON LEAGUE',
    flavor: '瀑布島教堂·夜間煙火', accent: '#b48ef0', playable: false,
  },
  {
    id: 'gen5', gen: 5, nameZh: '因幡大會', nameEn: 'VERTRESS',
    bannerZh: '因幡大會', bannerEn: 'UNOVA POKÉMON LEAGUE',
    flavor: '山頂神殿·劇場級燈光', accent: '#f0b45a', playable: false,
  },
  {
    id: 'gen6', gen: 6, nameZh: '密阿雷大會', nameEn: 'LUMIOSE',
    bannerZh: '密阿雷大會', bannerEn: 'KALOS POKÉMON LEAGUE',
    flavor: '六邊形母題·元素機關房', accent: '#ff7a9e', playable: false,
  },
  {
    id: 'gen7', gen: 7, nameZh: '瑪納羅大會', nameEn: 'MANALO STADIUM',
    bannerZh: '瑪納羅大會', bannerEn: 'ALOLA POKÉMON LEAGUE',
    flavor: '海上球場·黃金日光', accent: '#ffd166', playable: false,
  },
  {
    id: 'gen8', gen: 8, nameZh: '宮門體育場', nameEn: 'WYNDON STADIUM',
    bannerZh: 'WYNDON STADIUM · 冠軍盃決賽', bannerEn: 'GALAR POKÉMON LEAGUE',
    flavor: '極巨化燈光秀·雨夜決賽', accent: '#ff2d78', playable: true,
  },
]
