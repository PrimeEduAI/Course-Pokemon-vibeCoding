'use client'

import { useEffect, useRef, useState } from 'react'
import styles from '@/app/scan/scan.module.css'

/* Local Claude scanning runs ~15–20s, so the loading show has to earn that time.
   Stage 0 fires once on start, then the interval walks the list; once it reaches
   the end it loops only over the "deep work" stages (2..n) so it reads as ongoing
   analysis rather than restarting from scratch. */
const STAGES = [
  '圖鑑啟動…',
  '校正鏡頭焦距…',
  '掃描卡片中…',
  '分析圖像特徵…',
  '辨識寶可夢…',
  '查詢聯盟價格資料庫…',
  '彙整圖鑑資料…',
]
const STAGE_MS = 2500

/**
 * Top-panel camera screen: a white-framed viewfinder (like the reference's
 * Poké Ball screen) with corner LEDs, an always-running idle scan line, and a
 * busy overlay (grid + beam + status stages + progress bar). The big round red
 * button under it is the shutter; the hidden <input capture="environment"> means
 * tapping it opens the phone camera.
 */
export default function Viewfinder({
  preview,
  busy,
  onFile,
}: {
  preview: string | null
  busy: boolean
  onFile: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!busy) {
      setStep(0)
      return
    }
    const t = setInterval(() => setStep((s) => s + 1), STAGE_MS)
    return () => clearInterval(t)
  }, [busy])

  const stageIdx =
    step < STAGES.length ? step : 2 + ((step - STAGES.length) % (STAGES.length - 2))

  const pick = () => inputRef.current?.click()

  return (
    <div className={styles.cameraDeck}>
      <div className={styles.screenFrame}>
        <span className={`${styles.frameLed} ${styles.frameLedL}`} />
        <span className={`${styles.frameLed} ${styles.frameLedR}`} />

        <div className={styles.viewport}>
          {/* corner brackets */}
          <span className={`${styles.bracket} ${styles.brTL}`} />
          <span className={`${styles.bracket} ${styles.brTR}`} />
          <span className={`${styles.bracket} ${styles.brBL}`} />
          <span className={`${styles.bracket} ${styles.brBR}`} />

          {preview ? (
            <img src={preview} alt="卡片預覽" className={styles.previewImg} />
          ) : (
            <div className={styles.viewEmpty}>
              <span className={styles.pokeballGhost} aria-hidden="true" />
              <p className={styles.viewHint}>將卡片對準取景框</p>
            </div>
          )}

          {/* idle sweep line — always subtly alive */}
          {!busy && <span className={styles.idleScan} />}

          {/* busy overlay */}
          {busy && (
            <div className={styles.scanOverlay}>
              <span className={styles.scanGrid} />
              <span className={styles.scanBeam} />
              <div className={styles.scanStatus}>
                <span className={styles.scanDot} />
                <span className={styles.scanText}>{STAGES[stageIdx]}</span>
              </div>
              <div className={styles.scanProgressTrack}>
                <span className={styles.scanProgressFill} />
              </div>
            </div>
          )}
        </div>

        <div className={styles.screenCaption}>
          <span className={`${styles.captionLed} ${busy ? styles.captionBusy : styles.captionReady}`} />
          {busy ? 'SCANNING' : preview ? 'PREVIEW' : 'READY'}
        </div>
      </div>

      {/* shutter */}
      <div className={styles.shutterRow}>
        <button
          type="button"
          className={styles.shutter}
          onClick={pick}
          disabled={busy}
          aria-label="拍攝或選擇卡片照片"
        >
          <span className={styles.shutterGloss} />
        </button>
        <span className={styles.shutterHint}>{busy ? '掃描中…' : '按下拍攝／上傳卡片'}</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        disabled={busy}
        className={styles.hiddenInput}
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
    </div>
  )
}
