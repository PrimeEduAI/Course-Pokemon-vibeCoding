import './globals.css'

export const metadata = { title: 'Pokémon 3D Arena' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  )
}
