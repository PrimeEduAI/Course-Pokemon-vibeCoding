'use client'
import { useState } from 'react'
import type { Candidate } from '@/lib/scan'
import type { CardHint } from '@/lib/tcg'
import RotomFace, { type RotomMood } from '@/components/scan/RotomFace'
import Viewfinder from '@/components/scan/Viewfinder'
import DexResults from '@/components/scan/DexResults'
import styles from './scan.module.css'

type ScanResult = { hint: CardHint; candidates: Candidate[]; photoPath: string }

export default function ScanPage() {
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [message, setMessage] = useState('')

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

  // presentation-only mood derived from the existing state
  const mood: RotomMood = busy
    ? 'scanning'
    : message.startsWith('✅')
      ? 'happy'
      : message && !(result && result.candidates.length > 0)
        ? 'sad'
        : 'idle'

  return (
    <main className={styles.dexRoot}>
      <div className={`${styles.device} ${styles[`dev_${mood}`]}`}>
        {/* ---- top bar of the Rotom Dex frame ---- */}
        <div className={styles.topBar}>
          <a href="/" className={styles.dpad} aria-label="返回首頁">
            <span className={styles.dpadArrow} />
            <span className={styles.dpadLabel}>HOME</span>
          </a>

          <div className={styles.faceWrap}>
            <RotomFace mood={mood} />
            <span className={styles.deviceName}>ROTOM 圖鑑</span>
          </div>

          <div className={styles.vents} aria-hidden="true">
            <span className={styles.screw} />
            <span className={styles.ventGrill} />
          </div>
        </div>

        {/* ---- twin screens ---- */}
        <div className={styles.screens}>
          <Viewfinder preview={preview} busy={busy} onFile={onFile} />
          <DexResults result={result} message={message} busy={busy} onSave={save} />
        </div>

        {/* ---- lower frame details ---- */}
        <div className={styles.bottomBar} aria-hidden="true">
          <span className={styles.screw} />
          <span className={styles.hingeLine} />
          <span className={styles.speaker} />
          <span className={styles.screw} />
        </div>
      </div>
    </main>
  )
}
