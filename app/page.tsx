export const dynamic = 'force-dynamic'

async function getCount() {
  try {
    const { getDb } = await import('@/lib/db')
    const { listCards } = await import('@/lib/collection')
    return listCards(getDb()).length
  } catch { return 0 }
}

export default async function Home() {
  const count = await getCount()
  return (
    <main style={{ padding: 40 }}>
      <h1>Pokémon 3D Arena</h1>
      <p style={{ marginTop: 8, color: '#9aa' }}>收藏：{count} 張卡</p>
      <ul style={{ marginTop: 20, lineHeight: 2 }}>
        <li><a href="/scan">📷 拍卡入庫</a></li>
        <li><a href="/battle">⚔️ 對戰（M1 場景）</a></li>
      </ul>
    </main>
  )
}
