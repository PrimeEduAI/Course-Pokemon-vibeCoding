'use client'

import styles from '@/app/scan/scan.module.css'
import type { DexStatus } from '@/app/scan/page'

/**
 * The tactile control cluster on the bottom panel:
 *  - functional D-pad: left/right move the dex cursor across candidates
 *  - green rectangular button = 登錄圖鑑 (register the highlighted candidate)
 *  - decorative red / blue pill buttons + speaker slits
 *  - 2×5 cyan keypad that lights up sequentially while scanning
 */
export default function DexControls({
  onPrev,
  onNext,
  onRegister,
  canRegister,
  canCycle,
  scanning,
  status,
}: {
  onPrev: () => void
  onNext: () => void
  onRegister: () => void
  canRegister: boolean
  canCycle: boolean
  scanning: boolean
  status: DexStatus
}) {
  return (
    <div className={styles.controls}>
      <div className={styles.controlsTop}>
        {/* D-pad */}
        <div className={styles.dpadWrap}>
          <div className={styles.dpad}>
            <span className={`${styles.dpadArm} ${styles.dpadV}`} />
            <span className={`${styles.dpadArm} ${styles.dpadH}`} />
            <span className={styles.dpadHub} />
            <button
              type="button"
              className={`${styles.dpadHit} ${styles.dpadLeft}`}
              onClick={onPrev}
              disabled={!canCycle}
              aria-label="上一張候選"
            />
            <button
              type="button"
              className={`${styles.dpadHit} ${styles.dpadRight}`}
              onClick={onNext}
              disabled={!canCycle}
              aria-label="下一張候選"
            />
          </div>
          <span className={styles.dpadCaption}>SELECT</span>
        </div>

        {/* action buttons */}
        <div className={styles.actionCol}>
          <button
            type="button"
            className={`${styles.greenKey} ${status === 'success' ? styles.greenKeyLit : ''}`}
            onClick={onRegister}
            disabled={!canRegister}
          >
            <span className={styles.greenKeyFace}>登錄圖鑑</span>
          </button>
          <div className={styles.pillRow}>
            <span className={`${styles.pill} ${styles.pillRed}`} aria-hidden="true" />
            <span className={`${styles.pill} ${styles.pillBlue}`} aria-hidden="true" />
          </div>
        </div>
      </div>

      <div className={styles.controlsBottom}>
        {/* blue keypad */}
        <div className={`${styles.keypad} ${scanning ? styles.keypadScan : ''}`} aria-hidden="true">
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} className={styles.key} style={{ ['--k' as string]: i }} />
          ))}
        </div>

        {/* speaker */}
        <div className={styles.speaker} aria-hidden="true">
          <span /><span /><span /><span />
        </div>
      </div>
    </div>
  )
}
