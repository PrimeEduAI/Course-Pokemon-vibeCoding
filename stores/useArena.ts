import { create } from 'zustand'
import { FIELD_TYPES, type ArenaId, type FieldType } from '@/components/three/arenas/types'
import { useBattle } from './useBattle'

/**
 * 戰場選擇狀態：未選（null）時顯示「選擇聯盟戰場」；
 * 選定後才掛載 Canvas 與戰鬥（AI 開場緩衝 / 鳴叫都在掛載後才開始）。
 * Gen 1 的場地型別每場隨機（草/岩/水/冰）；dev 可用 ?field=rock 之類強制指定。
 */
interface ArenaState {
  arenaId: ArenaId | null
  fieldType: FieldType | null
  choose: (id: ArenaId) => void
  clear: () => void
}

function pickFieldType(): FieldType {
  // dev 後門：?field=grass|rock|water|ice
  if (typeof window !== 'undefined') {
    const q = new URLSearchParams(window.location.search).get('field')
    if (q && (FIELD_TYPES as string[]).includes(q)) return q as FieldType
  }
  return FIELD_TYPES[(Math.random() * FIELD_TYPES.length) | 0]
}

export const useArena = create<ArenaState>((set) => ({
  arenaId: null,
  fieldType: null,
  choose: (id) => {
    useBattle.getState().reset() // 換場即重開一場乾淨的戰鬥
    set({ arenaId: id, fieldType: id === 'gen1' ? pickFieldType() : null })
  },
  clear: () => set({ arenaId: null, fieldType: null }),
}))
