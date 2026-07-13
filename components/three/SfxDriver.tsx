'use client'
import { useEffect, useRef } from 'react'
import { playCryFile, resetCries, sfxFanfare, sfxKo, unlockAudio } from '@/lib/sfx'
import { useBattle, type Phase } from '@/stores/useBattle'

/**
 * 戰鬥合成音效駕駛：
 * - 第一次使用者手勢解鎖 AudioContext
 * - 再戰 / 換場清空鳴叫節流
 * - KO：三音下行；勝利再補號角 + 勝方鳴叫（敗方鳴叫由 BattleAudio 負責）
 * 命中 / 發射音效直接由 combat.ts 與 Player / EnemyFighter 觸發。
 */
export default function SfxDriver() {
  const phase = useBattle((s) => s.phase)
  const resetNonce = useBattle((s) => s.resetNonce)
  const prevPhase = useRef<Phase>('fighting')

  // AudioContext 解鎖：綁定首次手勢（之後為冪等 no-op）
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    resetCries()
    prevPhase.current = 'fighting'
  }, [resetNonce])

  useEffect(() => {
    if (prevPhase.current === phase) return
    prevPhase.current = phase
    if (phase === 'victory') {
      sfxKo()
      const t = setTimeout(() => {
        sfxFanfare()
        playCryFile(useBattle.getState().playerFighter.dexId, 0.55)
      }, 750)
      return () => clearTimeout(t)
    }
    if (phase === 'defeat') sfxKo()
  }, [phase])

  return null
}
