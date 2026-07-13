'use client'

import type { Candidate } from '@/lib/scan'
import type { CardHint } from '@/lib/tcg'
import styles from '@/app/scan/scan.module.css'

type ScanResult = { hint: CardHint; candidates: Candidate[]; photoPath: string }

function fmtPrice(c: Candidate): string {
  const m = c.price?.market
  return m != null ? `US$ ${m.toFixed(2)}` : '— · — —'
}

/** Compact Rotom mascot for the empty / idle / error dex screen. */
function MiniRotom({ sad }: { sad: boolean }) {
  return (
    <svg viewBox="0 0 120 80" className={styles.sadRotom} aria-hidden="true">
      <ellipse cx="60" cy="42" rx="52" ry="26" fill="rgba(77,123,255,0.14)" />
      <circle cx="42" cy="34" r="12" fill="#2b6fb8" />
      <circle cx="78" cy="34" r="12" fill="#2b6fb8" />
      <circle cx="42" cy="37" r="5" fill="#04263f" />
      <circle cx="78" cy="37" r="5" fill="#04263f" />
      {sad ? (
        <path d="M46 58 q14 -12 28 0" fill="none" stroke="#4d7bff" strokeWidth="4" strokeLinecap="round" />
      ) : (
        <path d="M46 52 q14 12 28 0" fill="none" stroke="#39c6ff" strokeWidth="4" strokeLinecap="round" />
      )}
    </svg>
  )
}

export default function DexResults({
  result,
  message,
  busy,
  onSave,
}: {
  result: ScanResult | null
  message: string
  busy: boolean
  onSave: (c: Candidate) => void
}) {
  const saved = message.startsWith('✅')
  const hasCards = !!result && result.candidates.length > 0
  // a real scan happened but produced no usable candidates / errored
  const noMatch = !busy && !hasCards && message.length > 0 && !saved
  const isError = noMatch && message.startsWith('掃描失敗')

  return (
    <section className={`${styles.screen} ${styles.dexScreen}`} aria-label="圖鑑結果">
      <div className={styles.screenLabel}>
        <span className={styles.dexIndex}>NO.</span> 圖鑑結果 · POKÉDEX
      </div>

      {/* success feedback chip + sparkle burst */}
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

      <div className={styles.dexBody}>
        {busy && (
          <div className={styles.dexPlaceholder}>
            <span className={styles.dexPulse} />
            <p>資料傳輸中…</p>
          </div>
        )}

        {!busy && hasCards && (
          <div className={styles.entryList}>
            {result!.candidates.map((c) => (
              <article
                key={c.id}
                className={`${styles.entry} ${c.validated ? styles.entryMatch : ''}`}
              >
                <div className={styles.entryArt}>
                  <img src={c.imageSmall} alt={c.name} loading="lazy" />
                  {c.validated && <span className={styles.matchStamp}>MATCH ✓</span>}
                </div>

                <div className={styles.entryInfo}>
                  <dl className={styles.infoRows}>
                    <div>
                      <dt>名稱</dt>
                      <dd className={styles.infoName}>{c.name}</dd>
                    </div>
                    <div>
                      <dt>系列</dt>
                      <dd>{c.setName}</dd>
                    </div>
                    <div>
                      <dt>編號</dt>
                      <dd>{c.number}/{c.printedTotal}</dd>
                    </div>
                    <div>
                      <dt>稀有度</dt>
                      <dd>{c.rarity ?? '—'}</dd>
                    </div>
                  </dl>

                  <div className={styles.priceLed}>
                    <span className={styles.priceLbl}>市價</span>
                    <span className={styles.priceVal}>{fmtPrice(c)}</span>
                  </div>

                  <button
                    type="button"
                    className={styles.saveKey}
                    onClick={() => onSave(c)}
                    disabled={busy}
                  >
                    ＋ 加入收藏
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {!busy && !hasCards && (
          <div className={styles.dexEmpty}>
            <MiniRotom sad={noMatch} />
            <p className={styles.emptyTitle}>
              {isError ? '掃描失敗' : noMatch ? '查無此卡' : '待機中 · STANDBY'}
            </p>
            <p className={styles.emptyMsg}>
              {message || '拍攝或上傳一張寶可夢卡片，洛托姆會為你查詢圖鑑與聯盟價格。'}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
