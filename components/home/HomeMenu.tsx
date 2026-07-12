'use client'

/* ============================================================
   POKÉMON 3D ARENA — main menu (client presentation layer)
   All motion is CSS-transform based / SVG stroke animation.
   ============================================================ */

type MenuCard = {
  href: string
  icon: string
  index: string
  title: string
  desc: string
  color: string
  art: string
  cta: string
  soon?: boolean
}

const CARDS: MenuCard[] = [
  {
    href: '/scan',
    icon: '📷',
    index: '01',
    title: '拍卡入庫',
    desc: '掃描實體卡牌，用 AI 辨識並收進你的數位圖鑑。',
    color: 'var(--cyan)',
    art: '/assets/artwork/25.png',
    cta: 'SCAN CARD',
  },
  {
    href: '/battle',
    icon: '⚔️',
    index: '02',
    title: '聯盟對戰',
    desc: '踏入 3D 競技場，操控你的隊伍與對手一決高下。',
    color: 'var(--magenta)',
    art: '/assets/artwork/6.png',
    cta: 'ENTER ARENA',
  },
  {
    href: '#',
    icon: '🏛️',
    index: '03',
    title: '收藏大廳',
    desc: '漫步在你的傳說收藏之間，展示每一張珍藏卡。',
    color: 'var(--violet)',
    art: '/assets/artwork/150.png',
    cta: 'M4 · 即將開放',
    soon: true,
  },
]

// diagonal floating showcase artwork (parallax bob)
const SHOWCASE = [
  { id: 6,   glow: '#ff7a3d', sz: 258, top: '9%',  left: '-3%',  rot: '-6deg', dur: '6.5s', del: '0s',    op: 1 },
  { id: 448, glow: '#4d7cff', sz: 205, top: '54%', left: '3%',   rot: '5deg',  dur: '6s',   del: '-2.4s', op: 1 },
  { id: 384, glow: '#37d67a', sz: 250, top: '4%',  left: '80%',  rot: '7deg',  dur: '7.8s', del: '-1.2s', op: 1 },
  { id: 94,  glow: '#a35bff', sz: 196, top: '56%', left: '84%',  rot: '-8deg', dur: '7.2s', del: '-0.7s', op: 1 },
  { id: 887, glow: '#7b6bff', sz: 132, top: '36%', left: '93%',  rot: '4deg',  dur: '8.4s', del: '-3.1s', op: 0.6 },
]

// marching pixel gifs along the bottom edge (duplicated for seamless loop)
const MARCH = [
  'pikachu', 'charizard', 'lucario', 'gengar', 'dragonite', 'garchomp',
  'greninja', 'rayquaza', 'gyarados', 'mewtwo', 'gardevoir', 'dragapult',
  'eevee', 'snorlax', 'tyranitar', 'metagross', 'scizor', 'machamp',
]

// pseudo-random but deterministic star field
const STARS = Array.from({ length: 46 }, (_, i) => {
  const x = (i * 97.13) % 100
  const y = (i * 53.71) % 100
  const r = 0.6 + ((i * 7) % 5) * 0.28
  const d = ((i * 31) % 35) / 10
  return { x, y, r, d }
})

export default function HomeMenu({ count }: { count: number }) {
  return (
    <div className="stage">
      {/* ---------- background layers ---------- */}
      <div className="bg-gradient" />
      <PokeballWatermark />
      <div className="bg-hex" />
      <BackgroundFx />
      <div className="bg-scan" />
      <div className="bg-vignette" />

      {/* ---------- foreground ---------- */}
      <div className="shell">
        {/* top bar */}
        <header className="topbar rise rise-1">
          <div className="brandmark">
            <span className="brand-orb"><OrbIcon /></span>
            <span className="brand-text">POKÉMON <b>3D</b> ARENA</span>
          </div>
          <div className="hud-chip" role="status" aria-label={`卡片收藏 ${count} 張`}>
            <span className="dot" />
            <span className="lbl">卡片收藏</span>
            <span className="val">{count.toLocaleString()}<small>張</small></span>
          </div>
        </header>

        {/* hero */}
        <section className="hero">
          {/* floating showcase pokemon behind the title */}
          <div className="showcase fadein" aria-hidden="true">
            {SHOWCASE.map((m) => (
              <div
                key={m.id}
                className="mon"
                style={{
                  top: m.top,
                  left: m.left,
                  opacity: m.op,
                  ['--sz' as string]: `${m.sz}px`,
                  ['--glow' as string]: m.glow,
                  ['--rot' as string]: m.rot,
                  ['--dur' as string]: m.dur,
                  ['--del' as string]: m.del,
                }}
              >
                <img src={`/assets/artwork/${m.id}.png`} alt="" loading="lazy" />
              </div>
            ))}
          </div>

          <span className="edition-tag rise rise-2"><i />LEAGUE EDITION</span>

          <div className="title-wrap rise rise-3">
            <h1 className="title-main">
              POKÉMON
              <span className="arena">3D ARENA</span>
              <span className="title-shine" aria-hidden="true">
                POKÉMON<span className="arena">3D ARENA</span>
              </span>
            </h1>
          </div>

          <p className="title-cjk rise rise-4">寶可夢 <b>3D</b> 競技場</p>
          <p className="tagline rise rise-5">
            掃描 · 收藏 · 對戰 — 打造專屬你的傳說隊伍，登上聯盟頂點。
          </p>
        </section>

        {/* menu cards */}
        <nav className="menu" aria-label="主選單">
          {CARDS.map((c, i) => {
            const style = { ['--c' as string]: c.color }
            const inner = (
              <>
                <span className="card__border" aria-hidden="true" />
                <span className="card__accent" aria-hidden="true" />
                <img className="card__art" src={c.art} alt="" aria-hidden="true" loading="lazy" />
                {c.soon
                  ? <span className="badge-soon">即將開放</span>
                  : <span className="card__index">{c.index}</span>}
                <span className="card__icon" aria-hidden="true">{c.icon}</span>
                <span className="card__title">{c.title}</span>
                <span className="card__desc">{c.desc}</span>
                <span className="card__cta">
                  {c.cta}{!c.soon && <span className="arrow">→</span>}
                </span>
              </>
            )
            const riseCls = `rise rise-${5 + i}`
            if (c.soon) {
              return (
                <div
                  key={c.title}
                  className={`card is-soon ${riseCls}`}
                  style={style}
                  role="button"
                  aria-disabled="true"
                  tabIndex={0}
                >
                  {inner}
                </div>
              )
            }
            return (
              <a key={c.title} href={c.href} className={`card ${riseCls}`} style={style}>
                {inner}
              </a>
            )
          })}
        </nav>
      </div>

      {/* marching pixel sprite row */}
      <div className="march fadein" aria-hidden="true">
        <div className="march__track">
          {[...MARCH, ...MARCH].map((n, i) => (
            <img key={`${n}-${i}`} src={`/assets/sprites/gen5ani/${n}.gif`} alt="" loading="lazy" />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------- inline SVG: rotating pokeball line-art watermark ---------- */
function PokeballWatermark() {
  return (
    <div className="bg-pokeball" aria-hidden="true">
      <svg viewBox="0 0 400 400" fill="none">
        <defs>
          <radialGradient id="pbGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff2d6b" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#ff2d6b" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="200" cy="200" r="190" fill="url(#pbGlow)" />
        <circle cx="200" cy="200" r="176" stroke="#4b5bd6" strokeOpacity="0.35" strokeWidth="2" />
        <circle cx="200" cy="200" r="150" stroke="#ff2d6b" strokeOpacity="0.28" strokeWidth="2.5" />
        <line x1="24" y1="200" x2="150" y2="200" stroke="#4b5bd6" strokeOpacity="0.32" strokeWidth="2.5" />
        <line x1="250" y1="200" x2="376" y2="200" stroke="#4b5bd6" strokeOpacity="0.32" strokeWidth="2.5" />
        <circle cx="200" cy="200" r="50" stroke="#38e8ff" strokeOpacity="0.4" strokeWidth="2.5" />
        <circle cx="200" cy="200" r="30" stroke="#ffe23d" strokeOpacity="0.5" strokeWidth="2" />
        <circle cx="200" cy="200" r="12" fill="#ffe23d" fillOpacity="0.14" stroke="#ffe23d" strokeOpacity="0.5" strokeWidth="1.5" />
        {/* dashed outer ticks ring */}
        <circle cx="200" cy="200" r="120" stroke="#8b5cff" strokeOpacity="0.3" strokeWidth="2"
          strokeDasharray="4 14" />
      </svg>
    </div>
  )
}

/* ---------- inline SVG fx: energy beams, pulse rings, star field ---------- */
function BackgroundFx() {
  return (
    <svg className="bg-fx" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="beamMag" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ff2d6b" stopOpacity="0" />
          <stop offset="50%" stopColor="#ff2d6b" />
          <stop offset="100%" stopColor="#ff2d6b" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="beamCyan" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#38e8ff" stopOpacity="0" />
          <stop offset="50%" stopColor="#38e8ff" />
          <stop offset="100%" stopColor="#38e8ff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* star field */}
      <g>
        {STARS.map((s, i) => (
          <circle
            key={i}
            className="star"
            cx={(s.x / 100) * 1440}
            cy={(s.y / 100) * 900}
            r={s.r}
            fill={i % 4 === 0 ? '#ffe23d' : '#cdd6ff'}
            style={{ animationDelay: `${s.d}s` }}
          />
        ))}
      </g>

      {/* radial pulse rings emanating from center-behind-title */}
      <g style={{ color: '#8b5cff' }}>
        <circle className="pulse-ring" cx="720" cy="380" r="120" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle className="pulse-ring r2" cx="720" cy="380" r="120" fill="none" stroke="#ff2d6b" strokeWidth="1.5" />
        <circle className="pulse-ring r3" cx="720" cy="380" r="120" fill="none" stroke="#38e8ff" strokeWidth="1.5" />
      </g>

      {/* animated energy beams (stroke-dashoffset flow) */}
      <g fill="none" strokeWidth="2.5" strokeLinecap="round">
        <path className="beam"  style={{ color: '#ff2d6b' }} stroke="url(#beamMag)"  d="M-40 140 Q 400 90 760 200 T 1500 150" />
        <path className="beam b2" style={{ color: '#38e8ff' }} stroke="url(#beamCyan)" d="M-40 700 Q 500 760 900 640 T 1500 720" />
        <path className="beam b3" style={{ color: '#ff2d6b' }} stroke="url(#beamMag)"  d="M-40 520 Q 380 470 720 560 T 1500 500" />
        <path className="beam b4" style={{ color: '#38e8ff' }} stroke="url(#beamCyan)" d="M-40 300 Q 460 360 820 280 T 1500 340" />
      </g>
    </svg>
  )
}

/* ---------- small brand orb ---------- */
function OrbIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="#0a0e1a" stroke="#ff2d6b" strokeWidth="2.5" />
      <path d="M2 20 H38" stroke="#ff2d6b" strokeWidth="2.5" />
      <path d="M2 20 A18 18 0 0 1 38 20 Z" fill="#ff2d6b" fillOpacity="0.85" />
      <circle cx="20" cy="20" r="6.5" fill="#0a0e1a" stroke="#fff" strokeWidth="2.5" />
      <circle cx="20" cy="20" r="2.5" fill="#38e8ff" />
    </svg>
  )
}
