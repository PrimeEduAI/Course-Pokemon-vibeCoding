'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import styles from './battle.module.css'
import { useBattle, DASH_COOLDOWN_MS } from '@/stores/useBattle'
import { ARENA_IDS, useArena } from '@/stores/useArena'
import { useRoster } from '@/stores/useRoster'
import { useStyleMode, type StyleMode } from '@/stores/useStyleMode'
import { ARENAS, FIELD_LABEL, type ArenaId } from '@/components/three/arenas/types'
import { cooldownProgress } from '@/lib/battle/cooldown'
import { bossFor } from '@/lib/battle/bosses'
import { METER_MAX, hasGmaxModel, hasMegaModel, resolveGimmick } from '@/lib/battle/gimmicks'
import { STATUS_META, type StatusEffect } from '@/lib/battle/status'
import { sfxMeterReady } from '@/lib/sfx'
import { TYPE_COLOR, TYPE_ZH, type FighterDef, type TypeName } from '@/lib/battle/species'
import { useNetwork, clearNetWorld } from '@/stores/useNetwork'
import BattleAudio from '@/components/three/BattleAudio'

const BattleScene = dynamic(() => import('@/components/three/BattleScene'), {
  ssr: false,
  loading: () => <div className={styles.loading}>載入聯盟戰場…</div>,
})

const dexNo = (dexId: number) => `No.${String(dexId).padStart(3, '0')}`
const artworkUrl = (dexId: number) => `/assets/artwork/${dexId}.png`

function hpClass(ratio: number) {
  if (ratio > 0.5) return ''
  return ratio > 0.2 ? styles.hpMid : styles.hpLow
}

function MoveSlot({ keyCap, name, progress }: { keyCap: string; name: string; progress: number }) {
  const ready = progress >= 1
  return (
    <div className={`${styles.slot} ${ready ? styles.slotReady : ''}`}>
      <span className={styles.slotKey}>{keyCap}</span>
      <span className={styles.slotName}>{name}</span>
      {!ready && (
        <div
          className={styles.cdOverlay}
          style={{ background: `conic-gradient(rgba(4, 6, 16, 0.82) ${(1 - progress) * 360}deg, transparent 0deg)` }}
        />
      )}
    </div>
  )
}

/** 控制狀態徽章列：HP 條下方的小圖章（單字 + 剩餘時間掃描環） */
function StatusChips({ effects, now, alignRight }: { effects: StatusEffect[]; now: number; alignRight?: boolean }) {
  const active = effects.filter((e) => now < e.expiresAt)
  if (active.length === 0) return null
  return (
    <div className={styles.statusRow} style={alignRight ? { justifyContent: 'flex-end' } : undefined}>
      {active.map((e) => {
        const meta = STATUS_META[e.kind]
        const frac = Math.max(0, Math.min(1, (e.expiresAt - now) / (e.expiresAt - e.appliedAt)))
        return (
          <span key={e.kind} className={styles.statusChip} title={meta.nameZh}>
            <span
              className={styles.statusSweep}
              style={{ background: `conic-gradient(${meta.color} ${frac * 360}deg, rgba(255,255,255,0.1) 0deg)` }}
            />
            <span className={styles.statusGlyph} style={{ color: meta.color }}>{meta.glyph}</span>
          </span>
        )
      })}
    </div>
  )
}

/** 屬性徽章（選角卡 / BOSS 預告） */
function TypeBadges({ types }: { types: TypeName[] }) {
  return (
    <span className={styles.typeRow}>
      {types.map((t) => (
        <span key={t} className={styles.typeBadge} style={{ background: TYPE_COLOR[t] }}>{TYPE_ZH[t]}</span>
      ))}
    </span>
  )
}

/** MEGA / G-MAX 真換模徽章：讓學生知道誰能在 Gen6/Gen8 變身 */
function FormBadges({ dexId }: { dexId: number }) {
  const mega = hasMegaModel(dexId)
  const gmax = hasGmaxModel(dexId)
  if (!mega && !gmax) return null
  return (
    <span className={styles.typeRow}>
      {mega && <span className={styles.typeBadge} style={{ background: '#b76bff' }}>MEGA</span>}
      {gmax && <span className={styles.typeBadge} style={{ background: '#ff4d6d' }}>G-MAX</span>}
    </span>
  )
}

const STYLE_LABEL: Record<StyleMode, string> = { pixel: '點陣', animated: '動畫', modern: '3D' }
const STYLE_ORDER: StyleMode[] = ['pixel', 'animated', 'modern']

/** 畫風切換（F4）：點陣 / 動畫 / 3D 三段切換 + Tab 快捷鍵提示 */
function StyleSwitch() {
  const mode = useStyleMode((s) => s.mode)
  const setMode = useStyleMode((s) => s.set)
  return (
    <div className={styles.styleSwitch}>
      <div className={styles.styleSeg}>
        {STYLE_ORDER.map((m) => (
          <button
            key={m}
            className={`${styles.styleBtn} ${mode === m ? styles.styleBtnActive : ''}`}
            onClick={(e) => {
              setMode(m)
              e.currentTarget.blur() // 免得之後按 Enter/空白鍵誤觸
            }}
          >
            {STYLE_LABEL[m]}
          </button>
        ))}
      </div>
      <div className={styles.styleHint}>
        <span className={styles.hintKeys}>TAB</span> 切換畫風
      </div>
    </div>
  )
}

/** 選擇聯盟戰場：Gen 1–8 全數開放（pvpHosting = 好友對戰房主替雙方選場） */
function ArenaSelect({ onChoose, onPvp, pvpHosting }: {
  onChoose: (id: ArenaId) => void
  onPvp?: () => void
  pvpHosting?: boolean
}) {
  return (
    <div className={styles.selectOverlay}>
      <div className={styles.selectSmall}>
        {pvpHosting ? 'FRIEND BATTLE · HOST PICKS THE ARENA' : 'POKÉMON LEAGUE · WORLD CIRCUIT'}
      </div>
      <h1 className={styles.selectTitle}>{pvpHosting ? '你是房主 — 選擇對戰場地' : '選擇聯盟戰場'}</h1>
      <div className={styles.selectGrid}>
        {ARENAS.map((a) =>
          a.playable ? (
            <button
              key={a.id}
              className={`${styles.card} ${styles.cardPlayable}`}
              style={{ '--accent': a.accent } as React.CSSProperties}
              onClick={() => onChoose(a.id as ArenaId)}
            >
              <span className={styles.cardGen}>GEN {a.gen}</span>
              <span className={styles.cardName}>{a.nameZh}</span>
              <span className={styles.cardEn}>{a.nameEn}</span>
              <span className={styles.cardFlavor}>{a.flavor}</span>
            </button>
          ) : (
            <div key={a.id} className={`${styles.card} ${styles.cardLocked}`}>
              <span className={styles.cardGen}>GEN {a.gen}</span>
              <span className={styles.cardName}>{a.nameZh}</span>
              <span className={styles.cardEn}>{a.nameEn}</span>
              <span className={styles.cardFlavor}>{a.flavor}</span>
              <span className={styles.lockBadge}>敬請期待</span>
            </div>
          ),
        )}
      </div>
      <div className={styles.selectHint}>
        <span className={styles.selectHintHot}>八大聯盟戰場 全數開放</span> — 各世代招牌機制等你見識
      </div>
      {onPvp && (
        <button className={styles.pvpEntry} onClick={onPvp}>🔗 好友對戰 · 區網連線</button>
      )}
    </div>
  )
}

/** 好友對戰大廳：建房 / 憑 4 碼房號加入（伺服器 = 跑 `bun run pvp` 的那台電腦） */
function PvpLobby({ onCancel }: { onCancel: () => void }) {
  const phase = useNetwork((s) => s.phase)
  const roomCode = useNetwork((s) => s.roomCode)
  const error = useNetwork((s) => s.error)
  const [addr, setAddr] = useState('localhost')
  const [code, setCode] = useState('')

  // 預設伺服器位址：上次用過的 > 目前頁面的 host（教室裡通常就是老師機 IP）
  useEffect(() => {
    const saved = window.localStorage.getItem('pvp-server')
    setAddr(saved || window.location.hostname)
  }, [])
  const remember = () => window.localStorage.setItem('pvp-server', addr.trim())

  if (phase === 'connecting') {
    return (
      <div className={styles.selectOverlay}>
        <div className={styles.selectSmall}>FRIEND BATTLE</div>
        <h1 className={styles.selectTitle}>好友對戰</h1>
        <div className={styles.pvpWait}>連線中…</div>
      </div>
    )
  }

  if (phase === 'waiting') {
    return (
      <div className={styles.selectOverlay}>
        <div className={styles.selectSmall}>FRIEND BATTLE · ROOM READY</div>
        <h1 className={styles.selectTitle}>房間已建立</h1>
        <div className={styles.roomCode}>{roomCode}</div>
        <div className={styles.pvpWait}>把房號告訴對手，等待加入…</div>
        <button className={styles.backBtn} onClick={onCancel}>← 取消</button>
      </div>
    )
  }

  const net = useNetwork.getState()
  return (
    <div className={styles.selectOverlay}>
      <div className={styles.selectSmall}>FRIEND BATTLE · LOCAL NETWORK</div>
      <h1 className={styles.selectTitle}>好友對戰</h1>
      <div className={styles.pvpPanel}>
        <label className={styles.pvpLabel}>對戰伺服器（跑 bun run pvp 的那台電腦）</label>
        <input
          className={styles.pvpInput}
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          placeholder="例如 192.168.1.10"
          spellCheck={false}
        />
        <button className={styles.pvpBtn} onClick={() => { remember(); net.create(addr) }}>建立房間</button>
        <div className={styles.pvpDivider}>或 加入朋友的房間</div>
        <input
          className={styles.pvpInput}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="輸入 4 碼房號"
          inputMode="numeric"
        />
        <button className={styles.pvpBtn} onClick={() => { remember(); net.join(addr, code) }} disabled={code.length !== 4}>
          加入房間
        </button>
        {error && <div className={styles.pvpError}>{error}</div>}
      </div>
      <button className={styles.backBtn} onClick={onCancel}>← 返回</button>
    </div>
  )
}

/** 種族值小條（總和上限以 160 為滿刻度） */
function StatBars({ base }: { base: { hp: number; atk: number; def: number; spe: number } }) {
  const rows: [string, number][] = [['HP', base.hp], ['攻擊', base.atk], ['防禦', base.def], ['速度', base.spe]]
  return (
    <div className={styles.statCol}>
      {rows.map(([label, v]) => (
        <div key={label} className={styles.statRow}>
          <span className={styles.statLabel}>{label}</span>
          <div className={styles.statTrack}>
            <div className={styles.statFill} style={{ width: `${Math.min(100, (v / 160) * 100)}%` }} />
          </div>
          <span className={styles.statVal}>{v}</span>
        </div>
      ))}
    </div>
  )
}

/** 出戰選角：預設（皮卡丘/伊布）∪ 掃卡收藏；含本場 BOSS 預告（PvP 換成對手動態） */
function FighterSelect({ arenaId, onBack, onConfirm, pvp, peerFighter }: {
  arenaId: ArenaId
  onBack: () => void
  onConfirm: (dexId: number) => void
  pvp?: boolean
  peerFighter?: FighterDef | null
}) {
  const roster = useRoster((s) => s.roster)
  const loading = useRoster((s) => s.loading)
  const arenaDef = ARENAS.find((a) => a.id === arenaId)!
  const boss = bossFor(arenaId)

  useEffect(() => {
    void useRoster.getState().load()
  }, [])

  // dev 後門：?fighter=133 選好即戰（收藏名單需等 load 完成，故掛在 roster 變化上）
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('fighter')
    if (!q) return
    const dex = Number(q)
    if (Number.isFinite(dex) && useRoster.getState().buildFighter(dex)) onConfirm(dex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster])

  return (
    <div className={styles.selectOverlay}>
      <div className={styles.selectSmall}>{arenaDef.bannerEn} · CHOOSE YOUR FIGHTER</div>
      <h1 className={styles.selectTitle}>選擇出戰寶可夢</h1>

      {/* 本場 BOSS 預告（PvP：換成對手選角動態） */}
      {pvp ? (
        <div className={styles.bossStrip}>
          {peerFighter ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.bossArt} src={artworkUrl(peerFighter.dexId)} alt={peerFighter.nameZh} />
              <div className={styles.bossInfo}>
                <span className={styles.bossLabel}>對手已選擇 · {arenaDef.nameZh}</span>
                <span className={styles.bossName}>
                  {peerFighter.nameZh} <span className={styles.bossEn}>{peerFighter.nameEn}</span>
                </span>
                <span className={styles.bossMeta}>
                  <TypeBadges types={peerFighter.types} />
                  <FormBadges dexId={peerFighter.dexId} />
                  <span className={styles.bossHp}>HP {peerFighter.maxHp}</span>
                </span>
              </div>
            </>
          ) : (
            <div className={styles.bossInfo}>
              <span className={styles.bossLabel}>好友對戰 · {arenaDef.nameZh}</span>
              <span className={styles.bossName}>對手選擇中…</span>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.bossStrip}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.bossArt} src={artworkUrl(boss.dexId)} alt={boss.nameZh} />
          <div className={styles.bossInfo}>
            <span className={styles.bossLabel}>本場 BOSS · {arenaDef.nameZh}</span>
            <span className={styles.bossName}>
              {boss.nameZh} <span className={styles.bossEn}>{boss.nameEn}</span>
            </span>
            <span className={styles.bossMeta}>
              <TypeBadges types={boss.types} />
              <FormBadges dexId={boss.dexId} />
              <span className={styles.bossHp}>HP {boss.maxHp}</span>
            </span>
          </div>
        </div>
      )}

      <div className={styles.fsGrid}>
        {roster.map((e) => {
          const disabled = !e.base
          return (
            <button
              key={e.dexId}
              className={`${styles.fsCard} ${disabled ? styles.fsCardDisabled : ''}`}
              disabled={disabled}
              onClick={() => onConfirm(e.dexId)}
            >
              <span className={`${styles.sourceTag} ${e.source === 'collection' ? styles.sourceTagCol : ''}`}>
                {e.source === 'default' ? '預設' : '收藏'}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.fsArt} src={artworkUrl(e.dexId)} alt={e.nameZh} />
              <span className={styles.fsNo}>{dexNo(e.dexId)}</span>
              <span className={styles.fsName}>{e.nameZh}</span>
              <span className={styles.fsEn}>{e.nameEn}</span>
              <TypeBadges types={e.types} />
              <FormBadges dexId={e.dexId} />
              {e.base ? <StatBars base={e.base} /> : <span className={styles.fsPending}>資料補抓中…</span>}
            </button>
          )
        })}
        {loading && <div className={styles.fsLoading}>讀取收藏中…</div>}
      </div>

      <div className={styles.selectHint}>
        點選出戰 — <span className={styles.selectHintHot}>掃描卡片</span> 可解鎖更多收藏寶可夢
      </div>

      {/* 操作說明只放在戰前畫面，不進戰鬥 HUD */}
      <div className={`${styles.hint} ${styles.hintInline}`}>
        <span className={styles.hintKeys}>WASD</span> 移動 · <span className={styles.hintKeys}>Space</span> 跳躍 · <span className={styles.hintKeys}>J K U</span> 技能 · <span className={styles.hintKeys}>L</span> 疾走 · <span className={styles.hintKeys}>R</span> 招牌能力（計量滿） · 鏡頭自動鎖定對手
      </div>
      <button className={styles.backBtn} onClick={onBack}>← 返回戰場選擇</button>
    </div>
  )
}

/** 招牌能力發動中的剩餘時間環（conic-gradient；MEGA = Infinity 顯示常亮） */
function GimmickRing({ frac, color }: { frac: number | null; color: string }) {
  const deg = frac === null ? 360 : Math.max(0, Math.min(1, frac)) * 360
  return (
    <span
      className={styles.gimmickRing}
      style={{ background: `conic-gradient(${color} ${deg}deg, rgba(255,255,255,0.12) 0deg)` }}
    />
  )
}

export default function BattlePage() {
  const playerFighter = useBattle((s) => s.playerFighter)
  const enemyFighter = useBattle((s) => s.enemyFighter)
  const playerHp = useBattle((s) => s.playerHp)
  const playerMaxHp = useBattle((s) => s.playerMaxHp)
  const enemyHp = useBattle((s) => s.enemyHp)
  const enemyMaxHp = useBattle((s) => s.enemyMaxHp)
  const phase = useBattle((s) => s.phase)
  const cooldowns = useBattle((s) => s.cooldowns)
  const dashLastAt = useBattle((s) => s.dashLastAt)
  const lastPlayerHitAt = useBattle((s) => s.lastPlayerHitAt)
  const reset = useBattle((s) => s.reset)

  const arenaId = useArena((s) => s.arenaId)
  const fieldType = useArena((s) => s.fieldType)
  const choose = useArena((s) => s.choose)
  const clearArena = useArena((s) => s.clear)

  // 世代招牌能力：計量 / 發動狀態
  const playerGimmick = useBattle((s) => s.playerGimmick)
  const enemyGimmick = useBattle((s) => s.enemyGimmick)
  // 控制狀態（HP 條下的小徽章）
  const playerEffects = useBattle((s) => s.playerEffects)
  const enemyEffects = useBattle((s) => s.enemyEffects)

  // 選角完成才掛載戰鬥（選場 → 選角 → 開打）
  const [fighterReady, setFighterReady] = useState(false)

  // 好友對戰：連線狀態 + 大廳入口
  const battleMode = useBattle((s) => s.mode)
  const netPhase = useNetwork((s) => s.phase)
  const isHost = useNetwork((s) => s.isHost)
  const roomCode = useNetwork((s) => s.roomCode)
  const myFighter = useNetwork((s) => s.myFighter)
  const peerFighter = useNetwork((s) => s.peerFighter)
  const peerLeft = useNetwork((s) => s.peerLeft)
  const pvp = netPhase === 'paired'
  const [pvpEntry, setPvpEntry] = useState(false)

  // PvP：雙方出戰者到齊 → 同步開打（兩邊各自 configure，結果一致）
  useEffect(() => {
    if (pvp && myFighter && peerFighter && arenaId && !fighterReady) {
      useBattle.getState().configure(myFighter, peerFighter, 'pvp')
      setFighterReady(true)
    }
  }, [pvp, myFighter, peerFighter, arenaId, fighterReady])

  // 離開對戰頁：斷線（房間讓給別人用）
  useEffect(() => () => { useNetwork.getState().disconnect() }, [])

  // 發動橫幅：「MEGA 進化！」等大字 1.2s
  const [gimmickBanner, setGimmickBanner] = useState<{ text: string; key: number } | null>(null)
  useEffect(() => {
    if (!playerGimmick.activatedAt) return
    const name = useBattle.getState().playerGimmick.active?.nameZh
    if (!name) return
    setGimmickBanner({ text: `${name}！`, key: playerGimmick.activatedAt })
    const t = setTimeout(() => setGimmickBanner(null), 1300)
    return () => clearTimeout(t)
  }, [playerGimmick.activatedAt])
  useEffect(() => {
    if (!enemyGimmick.activatedAt) return
    const name = useBattle.getState().enemyGimmick.active?.nameZh
    if (!name) return
    setGimmickBanner({ text: `對手 ${name}！`, key: enemyGimmick.activatedAt })
    const t = setTimeout(() => setGimmickBanner(null), 1300)
    return () => clearTimeout(t)
  }, [enemyGimmick.activatedAt])

  // 計量集滿 sting（只提示玩家側 —— 那顆 R 是玩家的按鈕）
  const meterReady = playerGimmick.meter >= METER_MAX && !playerGimmick.used
  useEffect(() => {
    if (meterReady) sfxMeterReady()
  }, [meterReady])

  // 100ms 節拍：驅動冷卻掃描與受擊紅暈
  const [now, setNow] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(t)
  }, [])

  // dev 後門：?arena=gen5 直接進場（掛載後套用，避免 SSR hydration 不一致）
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('arena')
    if (q && (ARENA_IDS as string[]).includes(q)) choose(q as ArenaId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 畫風：讀回上次選擇 + Tab 循環切換（preventDefault 避免焦點跳走）
  useEffect(() => {
    useStyleMode.getState().hydrate()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.code === 'Tab') {
        e.preventDefault()
        useStyleMode.getState().cycle()
      }
      // 空白鍵 = 跳躍：擋掉捲動與焦點按鈕誤觸（例如結算後按空白鍵重按到「再戰」）；輸入框內不擋
      if ((e.code === 'Space' || e.key === ' ') && !(e.target instanceof HTMLInputElement)) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const backToArenaSelect = () => {
    setFighterReady(false)
    clearArena()
  }

  const confirmFighter = (dexId: number) => {
    if (!arenaId) return
    const fighter = useRoster.getState().buildFighter(dexId)
    if (!fighter) return
    useRoster.getState().setPlayerDex(dexId)
    if (pvp) {
      // PvP：廣播選角，等對手到齊由 effect 統一開打
      useNetwork.getState().chooseFighter(fighter)
      return
    }
    useBattle.getState().configure(fighter, bossFor(arenaId))
    setFighterReady(true)
  }

  // PvP：房主選場 → 廣播給客隊（gen1–3 的隨機場地型別以房主抽到的為準）
  const choosePvpArena = (id: ArenaId) => {
    setFighterReady(false)
    choose(id)
    useNetwork.getState().sendConfig(id, useArena.getState().fieldType)
  }

  // 離開好友對戰：斷線 + 回到單人選場
  const exitPvp = () => {
    useNetwork.getState().disconnect()
    setPvpEntry(false)
    setFighterReady(false)
    clearArena()
  }

  // 再戰：PvP 同步通知對手一起重開
  const rematch = () => {
    if (useBattle.getState().mode === 'pvp') {
      clearNetWorld()
      useNetwork.getState().sendGame({ g: 'rematch' })
    }
    reset()
  }

  const pRatio = playerHp / playerMaxHp
  const eRatio = enemyHp / enemyMaxHp
  const hitFlash = now - lastPlayerHitAt < 450

  // 對手離線 / 連線中斷（PvP 各階段共用覆蓋層）
  const peerLeftOverlay = peerLeft ? (
    <div className={styles.endOverlay}>
      <div className={styles.endTitleLose}>對手已離線</div>
      <div className={styles.endActions}>
        <button className={styles.changeBtn} onClick={exitPvp}>離開對戰</button>
      </div>
    </div>
  ) : null

  // PvP 大廳：入口點擊後、配對完成前（建房 / 加入）
  if (pvpEntry && !pvp) {
    return (
      <div className={styles.wrap}>
        <PvpLobby onCancel={exitPvp} />
      </div>
    )
  }

  // PvP 配對完成、未選戰場：房主選場、客隊等待 config
  if (pvp && !arenaId) {
    return (
      <div className={styles.wrap}>
        {isHost ? (
          <ArenaSelect onChoose={choosePvpArena} pvpHosting />
        ) : (
          <div className={styles.selectOverlay}>
            <div className={styles.selectSmall}>FRIEND BATTLE · ROOM {roomCode}</div>
            <h1 className={styles.selectTitle}>配對成功！</h1>
            <div className={styles.pvpWait}>房主選擇戰場中…</div>
            <button className={styles.backBtn} onClick={exitPvp}>← 離開對戰</button>
          </div>
        )}
        {peerLeftOverlay}
      </div>
    )
  }

  // 未選戰場：只顯示選場畫面（Canvas / 戰鬥 / 鳴叫都尚未開始）
  if (!arenaId) {
    return (
      <div className={styles.wrap}>
        <ArenaSelect onChoose={(id) => { setFighterReady(false); choose(id) }} onPvp={() => setPvpEntry(true)} />
        <StyleSwitch />
      </div>
    )
  }

  // 已選戰場、未選出戰寶可夢：選角畫面（PvP：選完等對手）
  if (!fighterReady) {
    if (pvp && myFighter) {
      return (
        <div className={styles.wrap}>
          <div className={styles.selectOverlay}>
            <div className={styles.selectSmall}>FRIEND BATTLE · ROOM {roomCode}</div>
            <h1 className={styles.selectTitle}>{myFighter.nameZh} 準備完成</h1>
            <div className={styles.pvpWait}>等待對手選擇寶可夢…</div>
            <button className={styles.backBtn} onClick={exitPvp}>← 離開對戰</button>
          </div>
          {peerLeftOverlay}
        </div>
      )
    }
    return (
      <div className={styles.wrap}>
        <FighterSelect
          arenaId={arenaId}
          onBack={pvp ? exitPvp : backToArenaSelect}
          onConfirm={confirmFighter}
          pvp={pvp}
          peerFighter={peerFighter}
        />
        <StyleSwitch />
        {peerLeftOverlay}
      </div>
    )
  }

  const arenaDef = ARENAS.find((a) => a.id === arenaId)!
  const meleeMove = playerFighter.moves[0]
  const projMove = playerFighter.moves[1]
  const ctrlMove = playerFighter.moves[2]

  // 世代招牌能力（本場戰場世代 × 出戰者）
  const pGimDef = resolveGimmick(arenaDef.gen, playerFighter.dexId)
  const pActive = playerGimmick.active
  const pRemainFrac = pActive
    ? (Number.isFinite(pActive.durationMs) ? Math.max(0, playerGimmick.endsAt - now) / pActive.durationMs : null)
    : null
  const eActive = enemyGimmick.active
  const eRemainFrac = eActive
    ? (Number.isFinite(eActive.durationMs) ? Math.max(0, enemyGimmick.endsAt - now) / eActive.durationMs : null)
    : null

  return (
    <div className={styles.wrap}>
      <BattleScene arena={arenaId} fieldType={fieldType} pvp={battleMode === 'pvp'} />
      <BattleAudio />
      <div className={styles.overlay}>
        {/* 受擊紅暈 */}
        {hitFlash && <div className={styles.hitVignette} />}

        {/* 頂部聯盟橫幅（依戰場） */}
        <div className={styles.banner}>
          <div className={styles.bannerSmall}>{arenaDef.bannerEn}</div>
          <div className={styles.bannerMain}>{arenaDef.bannerZh}</div>
          {fieldType && (
            <div className={styles.fieldChip} data-field={fieldType}>{FIELD_LABEL[fieldType]}</div>
          )}
        </div>

        {/* 畫風切換（F4） */}
        <StyleSwitch />

        {/* 我方出戰 */}
        <div className={`${styles.chip} ${styles.chipPlayer}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.chipArt} src={artworkUrl(playerFighter.dexId)} alt={playerFighter.nameZh} />
          <div>
            <div className={styles.chipSub}>PLAYER · {dexNo(playerFighter.dexId)}</div>
            <div className={styles.chipName}>{playerFighter.nameZh} {playerFighter.nameEn}</div>
            <div className={styles.hpRow}>
              <span className={styles.hpLabel}>HP</span>
              <div className={styles.hpBar}>
                <div className={`${styles.hpFill} ${hpClass(pRatio)}`} style={{ width: `${pRatio * 100}%` }} />
              </div>
              <span className={styles.hpNum}>{playerHp}/{playerMaxHp}</span>
            </div>
            <StatusChips effects={playerEffects} now={now} />
          </div>
        </div>

        {/* 對手出戰 */}
        <div className={`${styles.chip} ${styles.chipOpp}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.chipArt} src={artworkUrl(enemyFighter.dexId)} alt={enemyFighter.nameZh} />
          <div>
            <div className={styles.chipSub}>{battleMode === 'pvp' ? 'RIVAL' : 'CHAMPION'} · {dexNo(enemyFighter.dexId)}</div>
            <div className={styles.chipName}>{enemyFighter.nameZh} {enemyFighter.nameEn}</div>
            <div className={styles.hpRow} style={{ justifyContent: 'flex-end' }}>
              <span className={styles.hpNum}>{enemyHp}/{enemyMaxHp}</span>
              <span className={styles.hpLabel}>HP</span>
              <div className={styles.hpBar}>
                <div className={`${styles.hpFill} ${styles.hpFillOpp} ${hpClass(eRatio)}`} style={{ width: `${eRatio * 100}%` }} />
              </div>
            </div>
            <StatusChips effects={enemyEffects} now={now} alignRight />
          </div>
        </div>

        {/* 技能欄 */}
        <div className={styles.slots}>
          <MoveSlot keyCap="J" name={meleeMove.nameZh} progress={cooldownProgress(cooldowns[meleeMove.id] ?? 0, meleeMove.cooldownMs, now)} />
          <MoveSlot keyCap="K" name={projMove.nameZh} progress={cooldownProgress(cooldowns[projMove.id] ?? 0, projMove.cooldownMs, now)} />
          <MoveSlot keyCap="U" name={ctrlMove.nameZh} progress={cooldownProgress(cooldowns[ctrlMove.id] ?? 0, ctrlMove.cooldownMs, now)} />
          <MoveSlot keyCap="L" name="疾走" progress={cooldownProgress(dashLastAt === -Infinity ? 0 : dashLastAt, DASH_COOLDOWN_MS, now)} />
        </div>

        {/* 世代招牌能力：玩家計量條（滿了按 R） */}
        <div className={`${styles.gimmickBar} ${meterReady ? styles.gimmickBarReady : ''} ${pActive ? styles.gimmickBarActive : ''}`}>
          <span className={`${styles.gimmickKey} ${meterReady ? styles.gimmickKeyReady : ''}`}>R</span>
          <div className={styles.gimmickTrack}>
            <div
              className={`${styles.gimmickFill} ${meterReady ? styles.gimmickFillReady : ''}`}
              style={{ width: `${pActive ? 100 : playerGimmick.meter}%` }}
            />
          </div>
          <span className={styles.gimmickName}>
            {pActive
              ? `${pActive.nameZh} 發動中`
              : playerGimmick.used
                ? `${pGimDef.nameZh} · 已使用`
                : meterReady
                  ? `R 發動 ${pGimDef.nameZh}`
                  : pGimDef.nameZh}
          </span>
          {pActive && <GimmickRing frac={pRemainFrac} color="#ffd75e" />}
        </div>

        {/* 對手招牌能力計量（BOSS 卡上方） */}
        <div className={`${styles.gimmickOpp} ${eActive ? styles.gimmickBarActive : ''}`}>
          <span className={styles.gimmickOppLabel}>
            {eActive ? `${eActive.nameZh} 發動中` : enemyGimmick.used ? '招牌能力 已使用' : '招牌能力'}
          </span>
          <div className={styles.gimmickTrack}>
            <div className={`${styles.gimmickFill} ${styles.gimmickFillOpp}`} style={{ width: `${eActive ? 100 : enemyGimmick.meter}%` }} />
          </div>
          {eActive && <GimmickRing frac={eRemainFrac} color="#ff2d5e" />}
        </div>

        {/* 發動橫幅：MEGA 進化！/ 極巨化！/ Z 招式！/ 羈絆爆發！ */}
        {gimmickBanner && (
          <div key={gimmickBanner.key} className={styles.gimmickBanner}>{gimmickBanner.text}</div>
        )}

        {/* 勝負結算（PvP：再戰同步對手、離開即斷線） */}
        {phase !== 'fighting' && !peerLeft && (
          <div className={styles.endOverlay}>
            <div className={phase === 'victory' ? styles.endTitleWin : styles.endTitleLose}>
              {phase === 'victory' ? 'VICTORY 勝利！' : 'DEFEAT'}
            </div>
            <div className={styles.endActions}>
              <button className={styles.retryBtn} onClick={rematch}>再戰一場</button>
              {battleMode === 'pvp' ? (
                <button className={styles.changeBtn} onClick={exitPvp}>離開對戰</button>
              ) : (
                <button className={styles.changeBtn} onClick={backToArenaSelect}>更換戰場</button>
              )}
            </div>
          </div>
        )}

        {/* PvP：對手離線覆蓋層 */}
        {battleMode === 'pvp' && peerLeftOverlay}
      </div>
    </div>
  )
}
