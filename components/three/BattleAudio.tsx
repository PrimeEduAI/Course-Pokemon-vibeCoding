'use client'
import { useEffect, useRef } from 'react'
import { useBattle } from '@/stores/useBattle'

const cryUrl = (dex: number) => `/assets/cries/latest/${dex}.ogg`

function playCry(dex: number, volume = 0.5) {
  try {
    const a = new Audio(cryUrl(dex))
    a.volume = volume
    void a.play().catch(() => { /* autoplay 政策：忽略 */ })
  } catch { /* SSR / 無音訊裝置 */ }
}

/** 戰鬥音效：開場雙方鳴叫（含 autoplay 解鎖重試）、KO 時敗方鳴叫；dex 跟著出戰組合走 */
export default function BattleAudio() {
  const phase = useBattle((s) => s.phase)
  const resetNonce = useBattle((s) => s.resetNonce)
  const openingPlayed = useRef(false)

  // 開場鳴叫；若被 autoplay 政策擋下，等第一次按鍵再補
  useEffect(() => {
    openingPlayed.current = false
    const tryPlay = () => {
      if (openingPlayed.current) return
      const { playerFighter, enemyFighter } = useBattle.getState()
      try {
        const a = new Audio(cryUrl(playerFighter.dexId))
        a.volume = 0.5
        a.play().then(() => {
          openingPlayed.current = true
          setTimeout(() => playCry(enemyFighter.dexId, 0.5), 650)
        }).catch(() => { /* 尚未互動：留待 keydown 重試 */ })
      } catch { /* ignore */ }
    }
    // 直接嘗試（多數瀏覽器需先互動；catch 已吞掉）
    const t = setTimeout(tryPlay, 300)
    const onKey = () => {
      if (!openingPlayed.current) tryPlay()
      window.removeEventListener('keydown', onKey)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [resetNonce])

  // KO：敗方鳴叫
  useEffect(() => {
    const { playerFighter, enemyFighter } = useBattle.getState()
    if (phase === 'victory') playCry(enemyFighter.dexId, 0.55)
    else if (phase === 'defeat') playCry(playerFighter.dexId, 0.55)
  }, [phase])

  return null
}
