'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import styles from './battle.module.css'
import { useBattle, DASH_COOLDOWN_MS } from '@/stores/useBattle'
import { MOVES } from '@/lib/battle/moves'
import { cooldownProgress } from '@/lib/battle/cooldown'
import BattleAudio from '@/components/three/BattleAudio'

const BattleScene = dynamic(() => import('@/components/three/BattleScene'), {
  ssr: false,
  loading: () => <div className={styles.loading}>載入宮門體育場…</div>,
})

function hpClass(ratio: number) {
  if (ratio > 0.5) return ''
  return ratio > 0.2 ? styles.hpMid : styles.hpLow
}

function MoveSlot({ keyCap, name, progress }: { keyCap: string; name: string; progress: number }) {
  const ready = progress >= 1
  return (
    <div className={`${styles.slot} ${ready ? styles.slotReady : ''}`}>
      <span className={styles.slotKey}>{keyCap}</span>
      <span className={styles.slotName}>{name}</span>
      {!ready && (
        <div
          className={styles.cdOverlay}
          style={{ background: `conic-gradient(rgba(4, 6, 16, 0.82) ${(1 - progress) * 360}deg, transparent 0deg)` }}
        />
      )}
    </div>
  )
}

export default function BattlePage() {
  const playerHp = useBattle((s) => s.playerHp)
  const playerMaxHp = useBattle((s) => s.playerMaxHp)
  const enemyHp = useBattle((s) => s.enemyHp)
  const enemyMaxHp = useBattle((s) => s.enemyMaxHp)
  const phase = useBattle((s) => s.phase)
  const cooldowns = useBattle((s) => s.cooldowns)
  const dashLastAt = useBattle((s) => s.dashLastAt)
  const lastPlayerHitAt = useBattle((s) => s.lastPlayerHitAt)
  const reset = useBattle((s) => s.reset)

  // 100ms 節拍：驅動冷卻掃描與受擊紅暈
  const [now, setNow] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(t)
  }, [])

  const pRatio = playerHp / playerMaxHp
  const eRatio = enemyHp / enemyMaxHp
  const hitFlash = now - lastPlayerHitAt < 450

  return (
    <div className={styles.wrap}>
      <BattleScene />
      <BattleAudio />
      <div className={styles.overlay}>
        {/* 受擊紅暈 */}
        {hitFlash && <div className={styles.hitVignette} />}

        {/* 頂部聯盟橫幅 */}
        <div className={styles.banner}>
          <div className={styles.bannerSmall}>GALAR POKÉMON LEAGUE</div>
          <div className={styles.bannerMain}>WYNDON STADIUM · 冠軍盃決賽</div>
        </div>

        {/* 我方出戰 */}
        <div className={`${styles.chip} ${styles.chipPlayer}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.chipArt} src="/assets/artwork/25.png" alt="皮卡丘" />
          <div>
            <div className={styles.chipSub}>PLAYER · No.025</div>
            <div className={styles.chipName}>皮卡丘 PIKACHU</div>
            <div className={styles.hpRow}>
              <span className={styles.hpLabel}>HP</span>
              <div className={styles.hpBar}>
                <div className={`${styles.hpFill} ${hpClass(pRatio)}`} style={{ width: `${pRatio * 100}%` }} />
              </div>
              <span className={styles.hpNum}>{playerHp}/{playerMaxHp}</span>
            </div>
          </div>
        </div>

        {/* 對手出戰 */}
        <div className={`${styles.chip} ${styles.chipOpp}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.chipArt} src="/assets/artwork/6.png" alt="噴火龍" />
          <div>
            <div className={styles.chipSub}>CHAMPION · No.006</div>
            <div className={styles.chipName}>噴火龍 CHARIZARD</div>
            <div className={styles.hpRow} style={{ justifyContent: 'flex-end' }}>
              <span className={styles.hpNum}>{enemyHp}/{enemyMaxHp}</span>
              <span className={styles.hpLabel}>HP</span>
              <div className={styles.hpBar}>
                <div className={`${styles.hpFill} ${styles.hpFillOpp} ${hpClass(eRatio)}`} style={{ width: `${eRatio * 100}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* 技能欄 */}
        <div className={styles.slots}>
          <MoveSlot keyCap="Z" name={MOVES.quickAttack.nameZh} progress={cooldownProgress(cooldowns.quickAttack ?? 0, MOVES.quickAttack.cooldownMs, now)} />
          <MoveSlot keyCap="X" name={MOVES.thunderbolt.nameZh} progress={cooldownProgress(cooldowns.thunderbolt ?? 0, MOVES.thunderbolt.cooldownMs, now)} />
          <MoveSlot keyCap="C" name="疾走" progress={cooldownProgress(dashLastAt === -Infinity ? 0 : dashLastAt, DASH_COOLDOWN_MS, now)} />
        </div>

        {/* 操作提示 */}
        <div className={styles.hint}>
          <span className={styles.hintKeys}>← ↑ ↓ →</span> 移動 · <span className={styles.hintKeys}>Z X</span> 技能 · <span className={styles.hintKeys}>C</span> 疾走
        </div>

        {/* 勝負結算 */}
        {phase !== 'fighting' && (
          <div className={styles.endOverlay}>
            <div className={phase === 'victory' ? styles.endTitleWin : styles.endTitleLose}>
              {phase === 'victory' ? 'VICTORY 勝利！' : 'DEFEAT'}
            </div>
            <button className={styles.retryBtn} onClick={reset}>再戰一場</button>
          </div>
        )}
      </div>
    </div>
  )
}
