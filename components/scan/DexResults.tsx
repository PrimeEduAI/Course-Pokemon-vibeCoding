'use client'

import { useRef } from 'react'
import type { Candidate } from '@/lib/scan'
import type { CardHint } from '@/lib/tcg'
import styles from '@/app/scan/scan.module.css'

type ScanResult = { hint: CardHint; candidates: Candidate[]; photoPath: string }

function fmtPrice(c: Candidate): string {
  const m = c.price?.market
  return m != null ? `$${m.toFixed(2)}` : '-- . --'
}

/**
 * Bottom-panel results screen, styled as the classic green Pokédex LCD.
 * Each candidate is a dex entry (art + 名稱/系列/編號 + amber price readout +
 * MATCH stamp); the highlighted entry gets a blinking ▶ selector cursor and is
 * the one the green 登錄圖鑑 button registers. Tap an entry or swipe to move the
 * cursor.
 */
export default function DexResults({
  result,
  message,
  busy,
  highlight,
  onSelect,
  onSwipe,
}: {
  result: ScanResult | null
  message: string
  busy: boolean
  highlight: number
  onSelect: (i: number) => void
  onSwipe: (dir: number) => void
}) {
  const saved = message.startsWith('✅')
  const candidates = result?.candidates ?? []
  const hasCards = candidates.length > 0
  const noMatch = !busy && !hasCards && message.length > 0 && !saved
  const isError = noMatch && message.startsWith('掃描失敗')

  // horizontal swipe to move the dex cursor on touch devices
  const touchX = useRef<number | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0]?.clientX ?? null
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return
    const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current
    if (Math.abs(dx) > 42) onSwipe(dx < 0 ? 1 : -1)
    touchX.current = null
  }

  return (
    <div className={styles.dexScreenShell}>
      <div className={styles.dexScreenLabel}>
        <span className={styles.dexLabelDot} />
        NO. POKéDEX ENTRY
        {hasCards && (
          <span className={styles.dexCount}>
            {highlight + 1}/{candidates.length}
          </span>
        )}
      </div>

      <div
        className={styles.dexGlass}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {saved && (
          <div className={styles.savedChip} role="status">
            <span className={styles.sparkBurst} aria-hidden="true">
              {Array.from({ length: 8 }).map((_, i) => (
                <span key={i} style={{ ['--i' as string]: i }} />
              ))}
            </span>
            已登錄圖鑑！
          </div>
        )}

        {busy && (
          <div className={styles.dexTransmit}>
            <span className={styles.transmitRing} />
            <p>
              資料傳輸中<span className={styles.ellipsis} />
            </p>
          </div>
        )}

        {!busy && hasCards && (
          <div className={styles.entryList}>
            {candidates.map((c, i) => {
              const active = i === highlight
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => onSelect(i)}
                  className={`${styles.entry} ${active ? styles.entryActive : ''} ${c.validated ? styles.entryMatch : ''}`}
                >
                  <span className={styles.selCursor} aria-hidden="true">
                    ▶
                  </span>
                  <div className={styles.entryArt}>
                    <img src={c.imageSmall} alt={c.name} loading="lazy" />
                    {c.validated && <span className={styles.matchStamp}>MATCH ✓</span>}
                  </div>

                  <div className={styles.entryInfo}>
                    <div className={styles.entryName}>{c.name}</div>
                    <dl className={styles.infoRows}>
                      <div>
                        <dt>系列</dt>
                        <dd>{c.setName}</dd>
                      </div>
                      <div>
                        <dt>編號</dt>
                        <dd>
                          {c.number}/{c.printedTotal}
                        </dd>
                      </div>
                      <div>
                        <dt>稀有</dt>
                        <dd>{c.rarity ?? '—'}</dd>
                      </div>
                    </dl>

                    <div className={styles.priceLed}>
                      <span className={styles.priceLbl}>市價</span>
                      <span className={styles.priceVal}>{fmtPrice(c)}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {!busy && !hasCards && (
          <div className={styles.dexEmpty}>
            <span className={`${styles.emptyBall} ${isError ? styles.emptyBallErr : ''}`} aria-hidden="true" />
            <p className={styles.emptyTitle}>
              {isError ? '掃描失敗' : noMatch ? '查無此卡' : 'STANDBY · 待機中'}
            </p>
            <p className={styles.emptyMsg}>
              {message || '拍攝或上傳一張寶可夢卡片，圖鑑會查詢名稱、編號與聯盟市價。'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
