'use client'
import { useState, useEffect } from 'react'
import type { Candidate } from '@/lib/scan'
import type { CardHint } from '@/lib/tcg'
import DexLens from '@/components/scan/DexLens'
import Viewfinder from '@/components/scan/Viewfinder'
import DexResults from '@/components/scan/DexResults'
import DexControls from '@/components/scan/DexControls'
import styles from './scan.module.css'

type ScanResult = { hint: CardHint; candidates: Candidate[]; photoPath: string }
export type DexStatus = 'idle' | 'scanning' | 'success' | 'error'

export default function ScanPage() {
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [message, setMessage] = useState('')
  const [highlight, setHighlight] = useState(0)

  const candidates = result?.candidates ?? []
  const hasCards = candidates.length > 0

  // a fresh scan result resets the dex cursor to the first entry
  useEffect(() => {
    setHighlight(0)
  }, [result])

  async function onFile(file: File) {
    const url = URL.createObjectURL(file)
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return url
    })
    setResult(null); setMessage(''); setBusy(true)
    const fd = new FormData()
    fd.append('photo', file)
    try {
      const res = await fetch('/api/scan', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setResult(json)
      if (json.candidates.length === 0) setMessage(`辨識為「${json.hint.name}」但查無此卡，請重拍或換角度`)
    } catch (e) {
      setMessage(`掃描失敗：${e}`)
    } finally { setBusy(false) }
  }

  async function save(c: Candidate) {
    const res = await fetch('/api/collection', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card: c, photoPath: result?.photoPath ?? null }),
    })
    const json = await res.json()
    setMessage(res.ok ? `✅ 已加入收藏：${c.name}` : `⚠️ ${json.error}`)
  }

  // D-pad / swipe: move the dex cursor across candidates
  const cycle = (dir: number) => {
    if (candidates.length < 2) return
    setHighlight((h) => (h + dir + candidates.length) % candidates.length)
  }
  // green button 登錄圖鑑: register the highlighted candidate
  const registerHighlighted = () => {
    if (hasCards && !busy) save(candidates[highlight])
  }

  // presentation status derived from the existing state contract
  const status: DexStatus = busy
    ? 'scanning'
    : message.startsWith('✅')
      ? 'success'
      : message && !hasCards
        ? 'error'
        : 'idle'

  return (
    <main className={styles.dexRoot}>
      <div className={`${styles.dex} ${styles[`is_${status}`]}`}>
        {/* ============ TOP PANEL (lens + LEDs + camera screen) ============ */}
        <section className={styles.topPanel}>
          <span className={`${styles.panelScrew} ${styles.screwTL}`} aria-hidden="true" />
          <span className={`${styles.panelScrew} ${styles.screwBL}`} aria-hidden="true" />

          <div className={styles.headRow}>
            <DexLens status={status} />
            <div className={styles.brandPlate}>
              <span className={styles.brandName}>Pokédex</span>
              <span className={styles.brandSub}>KANTO&nbsp;·&nbsp;拍卡入庫</span>
            </div>
            <a href="/" className={styles.homePill} aria-label="返回首頁">
              <span className={styles.homePillDot} />
            </a>
          </div>

          <Viewfinder preview={preview} busy={busy} onFile={onFile} />
        </section>

        {/* ============ HINGE ============ */}
        <div className={styles.hinge} aria-hidden="true">
          <span className={styles.hingePin} />
          <span className={styles.hingePin} />
          <span className={styles.hingePin} />
        </div>

        {/* ============ BOTTOM PANEL (results + D-pad + green key + keypad) ============ */}
        <section className={styles.bottomPanel}>
          <span className={`${styles.panelScrew} ${styles.screwTR}`} aria-hidden="true" />
          <span className={`${styles.panelScrew} ${styles.screwBR}`} aria-hidden="true" />

          <DexResults
            result={result}
            message={message}
            busy={busy}
            highlight={highlight}
            onSelect={setHighlight}
            onSwipe={cycle}
          />

          <DexControls
            onPrev={() => cycle(-1)}
            onNext={() => cycle(1)}
            onRegister={registerHighlighted}
            canRegister={hasCards && !busy}
            canCycle={candidates.length > 1}
            scanning={busy}
            status={status}
          />
        </section>
      </div>
    </main>
  )
}
