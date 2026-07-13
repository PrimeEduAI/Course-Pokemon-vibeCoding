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
import { TYPE_COLOR, TYPE_ZH, type TypeName } from '@/lib/battle/species'
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

/** 選擇聯盟戰場：Gen 1–8 全數開放 */
function ArenaSelect({ onChoose }: { onChoose: (id: ArenaId) => void }) {
  return (
    <div className={styles.selectOverlay}>
      <div className={styles.selectSmall}>POKÉMON LEAGUE · WORLD CIRCUIT</div>
      <h1 className={styles.selectTitle}>選擇聯盟戰場</h1>
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

/** 出戰選角：預設（皮卡丘/伊布）∪ 掃卡收藏；含本場 BOSS 預告 */
function FighterSelect({ arenaId, onBack, onConfirm }: {
  arenaId: ArenaId
  onBack: () => void
  onConfirm: (dexId: number) => void
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

      {/* 本場 BOSS 預告 */}
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
            <span className={styles.bossHp}>HP {boss.maxHp}</span>
          </span>
        </div>
      </div>

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
              {e.base ? <StatBars base={e.base} /> : <span className={styles.fsPending}>資料補抓中…</span>}
            </button>
          )
        })}
        {loading && <div className={styles.fsLoading}>讀取收藏中…</div>}
      </div>

      <div className={styles.selectHint}>
        點選出戰 — <span className={styles.selectHintHot}>掃描卡片</span> 可解鎖更多收藏寶可夢
      </div>
      <button className={styles.backBtn} onClick={onBack}>← 返回戰場選擇</button>
    </div>
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

  // 選角完成才掛載戰鬥（選場 → 選角 → 開打）
  const [fighterReady, setFighterReady] = useState(false)

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
    useBattle.getState().configure(fighter, bossFor(arenaId))
    setFighterReady(true)
  }

  const pRatio = playerHp / playerMaxHp
  const eRatio = enemyHp / enemyMaxHp
  const hitFlash = now - lastPlayerHitAt < 450

  // 未選戰場：只顯示選場畫面（Canvas / 戰鬥 / 鳴叫都尚未開始）
  if (!arenaId) {
    return (
      <div className={styles.wrap}>
        <ArenaSelect onChoose={(id) => { setFighterReady(false); choose(id) }} />
        <StyleSwitch />
      </div>
    )
  }

  // 已選戰場、未選出戰寶可夢：選角畫面
  if (!fighterReady) {
    return (
      <div className={styles.wrap}>
        <FighterSelect arenaId={arenaId} onBack={backToArenaSelect} onConfirm={confirmFighter} />
        <StyleSwitch />
      </div>
    )
  }

  const arenaDef = ARENAS.find((a) => a.id === arenaId)!
  const meleeMove = playerFighter.moves[0]
  const projMove = playerFighter.moves[1]

  return (
    <div className={styles.wrap}>
      <BattleScene arena={arenaId} fieldType={fieldType} />
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
          </div>
        </div>

        {/* 對手出戰 */}
        <div className={`${styles.chip} ${styles.chipOpp}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.chipArt} src={artworkUrl(enemyFighter.dexId)} alt={enemyFighter.nameZh} />
          <div>
            <div className={styles.chipSub}>CHAMPION · {dexNo(enemyFighter.dexId)}</div>
            <div className={styles.chipName}>{enemyFighter.nameZh} {enemyFighter.nameEn}</div>
            <div className={styles.hpRow} style={{ justifyContent: 'flex-end' }}>
              <span className={styles.hpNum}>{enemyHp}/{enemyMaxHp}</span>
              <span className={styles.hpLabel}>HP</span>
              <div className={styles.hpBar}>
                <div className={`${styles.hpFill} ${styles.hpFillOpp} ${hpClass(eRatio)}`} style={{ width: `${eRatio * 100}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* 技能欄 */}
        <div className={styles.slots}>
          <MoveSlot keyCap="Q" name={meleeMove.nameZh} progress={cooldownProgress(cooldowns[meleeMove.id] ?? 0, meleeMove.cooldownMs, now)} />
          <MoveSlot keyCap="E" name={projMove.nameZh} progress={cooldownProgress(cooldowns[projMove.id] ?? 0, projMove.cooldownMs, now)} />
          <MoveSlot keyCap="F" name="疾走" progress={cooldownProgress(dashLastAt === -Infinity ? 0 : dashLastAt, DASH_COOLDOWN_MS, now)} />
        </div>

        {/* 操作提示 */}
        <div className={styles.hint}>
          <span className={styles.hintKeys}>WASD</span> 移動 · <span className={styles.hintKeys}>Q E</span> 技能 · <span className={styles.hintKeys}>F</span> 疾走 · <span className={styles.hintKeys}>滑鼠拖曳</span> 轉視角 · <span className={styles.hintKeys}>滾輪</span> 縮放 · <span className={styles.hintKeys}>V</span> 復位
        </div>

        {/* 勝負結算 */}
        {phase !== 'fighting' && (
          <div className={styles.endOverlay}>
            <div className={phase === 'victory' ? styles.endTitleWin : styles.endTitleLose}>
              {phase === 'victory' ? 'VICTORY 勝利！' : 'DEFEAT'}
            </div>
            <div className={styles.endActions}>
              <button className={styles.retryBtn} onClick={reset}>再戰一場</button>
              <button className={styles.changeBtn} onClick={backToArenaSelect}>更換戰場</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
