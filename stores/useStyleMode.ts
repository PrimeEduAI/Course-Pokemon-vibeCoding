import { create } from 'zustand'

/**
 * 畫風切換（F4 旗艦）：現代 3D GLB ↔ 動畫 GIF（B/W 世代）↔ 靜態點陣。
 * 預設 'modern'；為避免 SSR/hydration 不一致，localStorage 只在 hydrate() 時讀
 * （頁面 mount 後呼叫），寫入則於每次 set/cycle。
 */
export type StyleMode = 'modern' | 'animated' | 'pixel'

export const STYLE_MODES: StyleMode[] = ['modern', 'animated', 'pixel']

const STORAGE_KEY = 'pokemon-arena-style-mode'

function isStyleMode(v: unknown): v is StyleMode {
  return v === 'modern' || v === 'animated' || v === 'pixel'
}

interface StyleModeState {
  mode: StyleMode
  /** 讀回上次選擇（僅 client；SSR 安全） */
  hydrate: () => void
  set: (mode: StyleMode) => void
  cycle: () => void
}

function persist(mode: StyleMode) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    /* Safari 私密模式等：忽略 */
  }
}

export const useStyleMode = create<StyleModeState>((set, get) => ({
  mode: 'modern',
  hydrate: () => {
    if (typeof window === 'undefined') return
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (isStyleMode(saved) && saved !== get().mode) set({ mode: saved })
    } catch {
      /* ignore */
    }
  },
  set: (mode) => {
    set({ mode })
    persist(mode)
  },
  cycle: () => {
    const cur = get().mode
    const next = STYLE_MODES[(STYLE_MODES.indexOf(cur) + 1) % STYLE_MODES.length]
    set({ mode: next })
    persist(next)
  },
}))
