'use client'
import { useState } from 'react'
import type { Candidate } from '@/lib/scan'
import type { CardHint } from '@/lib/tcg'

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

  return (
    <main style={{ padding: 40, maxWidth: 900 }}>
      <h1>📷 拍卡入庫</h1>
      <p style={{ margin: '12px 0' }}>
        <input type="file" accept="image/*" capture="environment" disabled={busy}
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </p>
      {preview && <img src={preview} alt="preview" style={{ maxWidth: 260, borderRadius: 8 }} />}
      {busy && <p>🔍 辨識中…</p>}
      {message && <p style={{ margin: '12px 0' }}>{message}</p>}
      {result && result.candidates.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16 }}>
          {result.candidates.map((c) => (
            <div key={c.id} style={{ border: c.validated ? '2px solid #4caf50' : '1px solid #555', borderRadius: 8, padding: 12, width: 220 }}>
              <img src={c.imageSmall} alt={c.name} style={{ width: '100%' }} />
              <p><b>{c.name}</b> {c.validated && '✓'}</p>
              <p>{c.setName} · {c.number}/{c.printedTotal}</p>
              <p>{c.price?.market != null ? `市價 US$${c.price.market}` : '無市價資料'}</p>
              <button onClick={() => save(c)} disabled={busy} style={{ marginTop: 8, padding: '6px 12px' }}>加入收藏</button>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
