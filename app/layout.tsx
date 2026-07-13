import './globals.css'

export const metadata = {
  title: 'Pokémon 3D Arena — League Edition',
  description: '掃描 · 收藏 · 對戰。打造專屬你的傳說隊伍，登上聯盟頂點。',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      {/* suppressHydrationWarning：瀏覽器擴充（如 ColorZilla 的 cz-shortcut-listen）會在 React 載入前改 body 屬性 */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
