'use client'

import { useEffect, useRef, useState } from 'react'
import styles from '@/app/scan/scan.module.css'

const SCAN_STEPS = ['ROTOM 掃描中…', '讀取卡面資訊…', '查詢聯盟價格資料庫…']

/**
 * Left screen = camera viewfinder.
 * Corner brackets + crosshair + idle scan line + status LED.
 * The file input is styled as a big red shutter button; a smaller 上傳 button
 * shares the same input. During busy it overlays a cyan scan-beam + grid and a
 * rotating Poké Ball radar ring.
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

  // cycle the scanning status text while busy
  useEffect(() => {
    if (!busy) {
      setStep(0)
      return
    }
    const t = setInterval(() => setStep((s) => (s + 1) % SCAN_STEPS.length), 1100)
    return () => clearInterval(t)
  }, [busy])

  const pick = () => inputRef.current?.click()

  return (
    <section className={`${styles.screen} ${styles.viewScreen}`} aria-label="取景器">
      <div className={styles.screenLabel}>
        <span className={`${styles.led} ${busy ? styles.ledBusy : styles.ledReady}`} />
        {busy ? SCAN_STEPS[step] : 'READY · 拍攝或上傳卡片'}
      </div>

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
            <span className={styles.crosshair} />
            <p className={styles.viewHint}>將卡片對準取景框</p>
          </div>
        )}

        {/* idle sweeping scan line (always subtly running) */}
        {!busy && <span className={styles.idleScan} />}

        {/* busy overlay: grid + cyan beam + radar ring */}
        {busy && (
          <div className={styles.scanOverlay}>
            <span className={styles.scanGrid} />
            <span className={styles.scanBeam} />
            <svg className={styles.radar} viewBox="0 0 120 120" aria-hidden="true">
              <circle className={styles.radarRingDash} cx="60" cy="60" r="52" fill="none" stroke="#38e8ff" strokeWidth="2" strokeDasharray="6 10" />
              <circle cx="60" cy="60" r="38" fill="none" stroke="rgba(56,232,255,0.35)" strokeWidth="1.2" />
              <circle cx="60" cy="60" r="22" fill="none" stroke="rgba(56,232,255,0.25)" strokeWidth="1.2" />
              <g className={styles.radarSweep}>
                <path d="M60 60 L60 8 A52 52 0 0 1 105 40 Z" fill="url(#radarWedge)" />
              </g>
              <defs>
                <linearGradient id="radarWedge" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#38e8ff" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#38e8ff" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        )}
      </div>

      {/* controls */}
      <div className={styles.shutterRow}>
        <button
          type="button"
          className={styles.shutter}
          onClick={pick}
          disabled={busy}
          aria-label="拍攝或選擇卡片照片"
        >
          <span className={styles.shutterRing} />
          <span className={styles.shutterCore} />
        </button>
        <button type="button" className={styles.uploadBtn} onClick={pick} disabled={busy}>
          上傳
        </button>
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
    </section>
  )
}
