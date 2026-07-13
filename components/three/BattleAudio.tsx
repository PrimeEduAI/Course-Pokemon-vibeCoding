'use client'
import { useEffect, useRef, useState } from 'react'
import { useBattle } from '@/stores/useBattle'
import { useArena } from '@/stores/useArena'
import { playArena, duckForResult, fadeOutAndPause, toggleMuted, getMuted } from '@/lib/bgm'
import styles from '@/app/battle/battle.module.css'

const cryUrl = (dex: number) => `/assets/cries/latest/${dex}.ogg`

function playCry(dex: number, volume = 0.5) {
  try {
    const a = new Audio(cryUrl(dex))
    a.volume = volume
    void a.play().catch(() => { /* autoplay 政策：忽略 */ })
  } catch { /* SSR / 無音訊裝置 */ }
}

/**
 * 戰鬥音效與 BGM：
 *  - 開場雙方鳴叫（含 autoplay 解鎖重試）、KO 時敗方鳴叫；dex 跟著出戰組合走
 *  - 各世代真實聯盟／冠軍戰 BGM（/assets/bgm/{arenaId}.mp3）：掛載淡入、結算轉輕、卸載淡出
 *  - 右上角 🔊/🔇 只控 BGM（不影響鳴叫/音效），偏好存 localStorage
 */
export default function BattleAudio() {
  const phase = useBattle((s) => s.phase)
  const resetNonce = useBattle((s) => s.resetNonce)
  const arenaId = useArena((s) => s.arenaId)
  const openingPlayed = useRef(false)

  // BGM 靜音狀態（UI 用；真實來源在 lib/bgm）
  const [muted, setMuted] = useState(false)
  useEffect(() => { setMuted(getMuted()) }, [])

  // 戰場 BGM：掛載（已選戰場）即播；換戰場換軌；卸載淡出暫停
  useEffect(() => {
    if (!arenaId) return
    playArena(arenaId)
    return () => { fadeOutAndPause() }
  }, [arenaId])

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

  // KO：敗方鳴叫 + BGM 轉輕音量
  useEffect(() => {
    const { playerFighter, enemyFighter } = useBattle.getState()
    if (phase === 'victory') { playCry(enemyFighter.dexId, 0.55); duckForResult() }
    else if (phase === 'defeat') { playCry(playerFighter.dexId, 0.55); duckForResult() }
  }, [phase])

  const onToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    setMuted(toggleMuted())
    e.currentTarget.blur() // 免得之後按 Enter/空白鍵誤觸
  }

  return (
    <button
      type="button"
      className={`${styles.bgmToggle} ${muted ? styles.bgmToggleOff : ''}`}
      aria-label={muted ? '開啟戰鬥音樂' : '關閉戰鬥音樂'}
      aria-pressed={!muted}
      title={muted ? 'BGM 已關閉' : 'BGM 播放中'}
      data-bgm-muted={muted ? '1' : '0'}
      onClick={onToggle}
    >
      <span className={styles.bgmToggleIcon}>{muted ? '🔇' : '🔊'}</span>
      <span className={styles.bgmToggleLabel}>BGM</span>
    </button>
  )
}
