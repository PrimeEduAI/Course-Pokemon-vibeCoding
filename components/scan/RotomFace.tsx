'use client'

import styles from '@/app/scan/scan.module.css'

export type RotomMood = 'idle' | 'scanning' | 'happy' | 'sad'

/**
 * Rotom's face integrated at the top of the Pokédex frame.
 * Blue plasma eyes that blink + glance around while idle, spin into
 * spirals while scanning, arc up into a grin on success, and droop on error.
 * All motion is pure CSS (transform/opacity) driven by the mood class.
 */
export default function RotomFace({ mood = 'idle' }: { mood?: RotomMood }) {
  return (
    <div className={`${styles.rotomFace} ${styles[`mood_${mood}`]}`} aria-hidden="true">
      <svg viewBox="0 0 220 110" className={styles.rotomSvg}>
        <defs>
          <radialGradient id="rotomEye" cx="42%" cy="38%" r="70%">
            <stop offset="0%" stopColor="#bff4ff" />
            <stop offset="45%" stopColor="#39c6ff" />
            <stop offset="100%" stopColor="#0a72d6" />
          </radialGradient>
          <filter id="rotomGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* soft plasma aura behind the face */}
        <ellipse className={styles.rotomAura} cx="110" cy="58" rx="96" ry="40" />

        {/* ---- left eye ---- */}
        <g className={styles.eyeGroup} filter="url(#rotomGlow)">
          <g className={styles.blink}>
            <circle className={styles.eyeBall} cx="74" cy="46" r="21" fill="url(#rotomEye)" />
            <circle className={styles.pupil} cx="74" cy="46" r="9" fill="#04263f" />
            <circle className={styles.glint} cx="68" cy="40" r="3.4" fill="#eafcff" />
          </g>
          {/* scanning spiral (only visible in scanning mood) */}
          <path
            className={styles.spiral}
            d="M74 46 m0 -14 a14 14 0 1 1 -0.1 0 M74 46 m0 -8 a8 8 0 1 0 0.1 0"
            fill="none"
            stroke="#eafcff"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </g>

        {/* ---- right eye ---- */}
        <g className={styles.eyeGroup} filter="url(#rotomGlow)">
          <g className={styles.blink}>
            <circle className={styles.eyeBall} cx="146" cy="46" r="21" fill="url(#rotomEye)" />
            <circle className={styles.pupil} cx="146" cy="46" r="9" fill="#04263f" />
            <circle className={styles.glint} cx="140" cy="40" r="3.4" fill="#eafcff" />
          </g>
          <path
            className={styles.spiral}
            d="M146 46 m0 -14 a14 14 0 1 1 -0.1 0 M146 46 m0 -8 a8 8 0 1 0 0.1 0"
            fill="none"
            stroke="#eafcff"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </g>

        {/* ---- happy arcs (success) ---- */}
        <path className={styles.happyArc} d="M58 48 q16 -20 32 0" fill="none" stroke="#39c6ff" strokeWidth="5" strokeLinecap="round" />
        <path className={styles.happyArc} d="M130 48 q16 -20 32 0" fill="none" stroke="#39c6ff" strokeWidth="5" strokeLinecap="round" />

        {/* ---- mouth: cheeky grin / neutral / frown ---- */}
        <path className={styles.grin} filter="url(#rotomGlow)" d="M84 78 q26 22 52 0" fill="none" stroke="#39c6ff" strokeWidth="5" strokeLinecap="round" />
        <path className={styles.frown} d="M86 84 q24 -18 48 0" fill="none" stroke="#4d7bff" strokeWidth="4.4" strokeLinecap="round" />

        {/* little fang for the grin */}
        <path className={styles.fang} d="M100 79 l5 9 l5 -9 z" fill="#eafcff" />
      </svg>
    </div>
  )
}
