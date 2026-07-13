'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import styles from './battle.module.css'
import { useBattle, DASH_COOLDOWN_MS } from '@/stores/useBattle'
import { useArena } from '@/stores/useArena'
import { ARENAS, FIELD_LABEL, type ArenaId } from '@/components/three/arenas/types'
import { MOVES } from '@/lib/battle/moves'
import { cooldownProgress } from '@/lib/battle/cooldown'
import BattleAudio from '@/components/three/BattleAudio'

const BattleScene = dynamic(() => import('@/components/three/BattleScene'), {
  ssr: false,
  loading: () => <div className={styles.loading}>載入聯盟戰場…</div>,
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

/** 選擇聯盟戰場：Gen 1–8 卡片，僅 gen1 / gen8 可出戰 */
function ArenaSelect({ onChoose }: { onChoose: (id: ArenaId) => void }) {
  return (
    <div className={styles.selectOverlay}>
      <div className={styles.selectSmall}>POKÉMON LEAGUE · WORLD CIRCUIT</div>
      <h1 className={styles.selectTitle}>選擇聯盟戰場</h1>
      <div className={styles.selectGrid}>
        {ARENAS.map((a) =>
          a.playable ? (
            <button
              key={a.id}
              className={`${styles.card} ${styles.cardPlayable}`}
              style={{ '--accent': a.accent } as React.CSSProperties}
              onClick={() => onChoose(a.id as ArenaId)}
            >
              <span className={styles.cardGen}>GEN {a.gen}</span>
              <span className={styles.cardName}>{a.nameZh}</span>
              <span className={styles.cardEn}>{a.nameEn}</span>
              <span className={styles.cardFlavor}>{a.flavor}</span>
            </button>
          ) : (
            <div key={a.id} className={`${styles.card} ${styles.cardLocked}`}>
              <span className={styles.cardGen}>GEN {a.gen}</span>
              <span className={styles.cardName}>{a.nameZh}</span>
              <span className={styles.cardEn}>{a.nameEn}</span>
              <span className={styles.cardFlavor}>{a.flavor}</span>
              <span className={styles.lockBadge}>敬請期待</span>
            </div>
          ),
        )}
      </div>
      <div className={styles.selectHint}>
        可出戰：<span className={styles.selectHintHot}>GEN 1 石英高原</span> ·{' '}
        <span className={styles.selectHintHot}>GEN 8 宮門體育場</span>
      </div>
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

  const arenaId = useArena((s) => s.arenaId)
  const fieldType = useArena((s) => s.fieldType)
  const choose = useArena((s) => s.choose)
  const clearArena = useArena((s) => s.clear)

  // 100ms 節拍：驅動冷卻掃描與受擊紅暈
  const [now, setNow] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(t)
  }, [])

  const pRatio = playerHp / playerMaxHp
  const eRatio = enemyHp / enemyMaxHp
  const hitFlash = now - lastPlayerHitAt < 450

  // 未選戰場：只顯示選場畫面（Canvas / 戰鬥 / 鳴叫都尚未開始）
  if (!arenaId) {
    return (
      <div className={styles.wrap}>
        <ArenaSelect onChoose={choose} />
      </div>
    )
  }

  const arenaDef = ARENAS.find((a) => a.id === arenaId)!

  return (
    <div className={styles.wrap}>
      <BattleScene arena={arenaId} fieldType={fieldType} />
      <BattleAudio />
      <div className={styles.overlay}>
        {/* 受擊紅暈 */}
        {hitFlash && <div className={styles.hitVignette} />}

        {/* 頂部聯盟橫幅（依戰場） */}
        <div className={styles.banner}>
          <div className={styles.bannerSmall}>{arenaDef.bannerEn}</div>
          <div className={styles.bannerMain}>{arenaDef.bannerZh}</div>
          {arenaId === 'gen1' && fieldType && (
            <div className={styles.fieldChip} data-field={fieldType}>{FIELD_LABEL[fieldType]}</div>
          )}
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
            <div className={styles.endActions}>
              <button className={styles.retryBtn} onClick={reset}>再戰一場</button>
              <button className={styles.changeBtn} onClick={clearArena}>更換戰場</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
