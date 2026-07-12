'use client'
import dynamic from 'next/dynamic'

const BattleScene = dynamic(() => import('@/components/three/BattleScene'), {
  ssr: false,
  loading: () => <p style={{ padding: 40 }}>載入 3D 場景…</p>,
})

export default function BattlePage() {
  return <div style={{ width: '100vw', height: '100vh' }}><BattleScene /></div>
}
