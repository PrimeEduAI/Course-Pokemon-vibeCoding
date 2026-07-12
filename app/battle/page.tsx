'use client'
import dynamic from 'next/dynamic'
import styles from './battle.module.css'

const BattleScene = dynamic(() => import('@/components/three/BattleScene'), {
  ssr: false,
  loading: () => <div className={styles.loading}>載入宮門體育場…</div>,
})

export default function BattlePage() {
  return (
    <div className={styles.wrap}>
      <BattleScene />
      <div className={styles.overlay}>
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
                <div className={styles.hpFill} style={{ width: '100%' }} />
              </div>
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
              <span className={styles.hpLabel}>HP</span>
              <div className={styles.hpBar}>
                <div className={`${styles.hpFill} ${styles.hpFillOpp}`} style={{ width: '86%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* 操作提示 */}
        <div className={styles.hint}>
          <span className={styles.hintKeys}>← ↑ ↓ →</span> 方向鍵移動
        </div>
      </div>
    </div>
  )
}
