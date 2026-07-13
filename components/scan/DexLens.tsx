'use client'

import styles from '@/app/scan/scan.module.css'
import type { DexStatus } from '@/app/scan/page'

/**
 * The signature top-left cluster of the classic Gen-1 Kanto Pokédex:
 *  - a big blue fisheye lens (radial-gradient sphere + white glint + chrome ring)
 *    that pulses / glows while scanning
 *  - three mini LEDs (red / yellow / green) whose choreography tracks status:
 *    idle = soft staggered glow, scanning = fast sequential blink,
 *    success = green solid, error = red blink.
 */
export default function DexLens({ status }: { status: DexStatus }) {
  return (
    <div className={`${styles.lensCluster} ${styles[`lens_${status}`]}`} aria-hidden="true">
      <div className={styles.lensRing}>
        <div className={styles.lensGlass}>
          <span className={styles.lensGlint} />
          <span className={styles.lensSweep} />
        </div>
      </div>

      <div className={styles.miniLeds}>
        <span className={`${styles.miniLed} ${styles.ledRed}`} />
        <span className={`${styles.miniLed} ${styles.ledYellow}`} />
        <span className={`${styles.miniLed} ${styles.ledGreen}`} />
      </div>
    </div>
  )
}
