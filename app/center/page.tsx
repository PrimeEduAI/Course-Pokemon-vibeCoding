'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import CenterScene from '@/components/three/center/CenterScene'
import type { CollectionCard, SummonRequest } from '@/components/three/center/types'
import styles from './center.module.css'

/*
 * 注意：這裡刻意不用 next/dynamic 拆 lazy chunk——開發期多個 next dev 共用 .next
 * 時 lazy chunk manifest 會壞掉。改用「掛載後才 render」閘門，SSR 一樣不會碰到 three。
 */
export default function CenterPage() {
  const [mounted, setMounted] = useState(false)
  const [cards, setCards] = useState<CollectionCard[]>([])
  const [loaded, setLoaded] = useState(false)
  const [selected, setSelected] = useState<CollectionCard | null>(null)
  const [summon, setSummon] = useState<SummonRequest | null>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    let dead = false
    fetch('/api/collection')
      .then((r) => r.json())
      .then((d: { cards?: CollectionCard[] }) => { if (!dead) setCards(d.cards ?? []) })
      .catch(() => {})
      .finally(() => { if (!dead) setLoaded(true) })
    return () => { dead = true }
  }, [])

  const totalValue = useMemo(() => cards.reduce((s, c) => s + (c.latestPrice ?? 0), 0), [cards])
  const empty = loaded && cards.length === 0

  const handleSummon = () => {
    const dexId = selected?.pokedexNumbers?.[0]
    if (!dexId) return
    setSummon({ dexId, key: Date.now() })
    const cry = new Audio(`/assets/cries/latest/${dexId}.ogg`)
    cry.volume = 0.5
    cry.play().catch(() => {})
    setSelected(null)
  }

  return (
    <div className={styles.wrap}>
      {mounted
        ? <CenterScene cards={cards} empty={empty} summon={summon} onSelectCard={setSelected} />
        : <div className={styles.loading}>點亮寶可夢中心…</div>}

      <div className={styles.overlay}>
        {/* 頂部橫幅 */}
        <div className={styles.banner}>
          <div className={styles.bannerSmall}>POKÉMON CENTER · NIGHT LOBBY</div>
          <div className={styles.bannerMain}>寶可夢中心 · 收藏大廳</div>
        </div>

        {/* 返回主選單 */}
        <Link href="/" className={styles.backBtn}>← 回主選單</Link>

        {/* 統計徽章 */}
        {loaded && (
          <div className={styles.stats}>
            <div className={styles.statChip}>
              <span className={styles.statLbl}>總卡數</span>
              <span className={styles.statVal}>{cards.length}</span>
            </div>
            <div className={styles.statChip}>
              <span className={styles.statLbl}>總市值</span>
              <span className={`${styles.statVal} ${styles.statGold}`}>US$ {totalValue.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* 空收藏邀請 */}
        {empty && !summon && (
          <div className={styles.emptyBanner}>
            <div className={styles.emptyText}>收藏大廳空空如也 — 到拍卡入庫登錄你的第一張卡片吧！</div>
            <Link href="/scan" className={styles.scanLink}>前往拍卡入庫 →</Link>
          </div>
        )}

        {/* 操作提示 */}
        <div className={styles.hint}>
          <span className={styles.hintKeys}>拖曳</span> 環視大廳 · <span className={styles.hintKeys}>雙擊</span> 回到巡航
        </div>

        {/* 卡片詳情側欄 */}
        <aside className={`${styles.panel} ${selected ? styles.panelOpen : ''}`}>
          {selected && (
            <>
              <button className={styles.panelClose} onClick={() => setSelected(null)} aria-label="關閉">×</button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.panelImg} src={selected.imageLarge} alt={selected.name} />
              <div className={styles.panelName}>{selected.name}</div>
              <div className={styles.panelRows}>
                <div className={styles.panelRow}><span>系列</span><b>{selected.setId}</b></div>
                <div className={styles.panelRow}><span>編號</span><b>#{selected.number}</b></div>
                <div className={styles.panelRow}><span>稀有度</span><b>{selected.rarity ?? '—'}</b></div>
                <div className={styles.panelRow}>
                  <span>市價</span>
                  <b className={styles.panelPrice}>
                    {selected.latestPrice != null ? `US$ ${selected.latestPrice.toFixed(2)}` : '— —'}
                  </b>
                </div>
              </div>
              <button
                className={styles.summonBtn}
                onClick={handleSummon}
                disabled={!selected.pokedexNumbers?.length}
              >
                ◓ 召喚
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
