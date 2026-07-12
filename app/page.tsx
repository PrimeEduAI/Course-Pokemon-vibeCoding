export default function Home() {
  return (
    <main style={{ padding: 40 }}>
      <h1>Pokémon 3D Arena</h1>
      <ul style={{ marginTop: 20, lineHeight: 2 }}>
        <li><a href="/scan">📷 拍卡入庫</a></li>
        <li><a href="/battle">⚔️ 對戰（M1 場景）</a></li>
      </ul>
    </main>
  )
}
