/**
 * 戰鬥音效引擎：純 WebAudio 合成（零素材、零版權）+ 鳴叫檔案節流播放。
 * 所有函式在 SSR / 無音訊環境下靜默 no-op；AudioContext 於第一次使用者手勢解鎖。
 */
import type { MoveVisualId } from '@/lib/battle/moves'

// ---------------------------------------------------------------------------
// AudioContext 單例
// ---------------------------------------------------------------------------

let ctx: AudioContext | null = null
let master: GainNode | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    try {
      ctx = new AC()
      master = ctx.createGain()
      master.gain.value = 0.5
      master.connect(ctx.destination)
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => { /* 待手勢 */ })
  return ctx
}

/** 綁在 pointerdown / keydown 上呼叫：建立 + 解鎖 AudioContext */
export function unlockAudio() {
  getCtx()
}

/** 測試 / 診斷用：目前 context 狀態 */
export function audioState(): string {
  return ctx?.state ?? 'none'
}

// ---------------------------------------------------------------------------
// 合成原語
// ---------------------------------------------------------------------------

interface ToneOpts {
  type?: OscillatorType
  from: number
  to?: number
  dur: number
  gain?: number
  when?: number
  attack?: number
}

/** 單振盪器：頻率 from→to 指數滑落 + AD 包絡 */
function tone({ type = 'sine', from, to, dur, gain = 0.2, when = 0, attack = 0.005 }: ToneOpts) {
  const c = getCtx()
  if (!c || !master) return
  const t0 = c.currentTime + when
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(Math.max(1, from), t0)
  if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

let noiseBuf: AudioBuffer | null = null
function getNoiseBuffer(c: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf
  const buf = c.createBuffer(1, c.sampleRate, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  noiseBuf = buf
  return buf
}

interface NoiseOpts {
  dur: number
  gain?: number
  when?: number
  filter?: BiquadFilterType
  from?: number
  to?: number
  q?: number
  attack?: number
}

/** 白噪音 + 掃頻濾波：whoosh / crackle / splash 基底 */
function noise({ dur, gain = 0.2, when = 0, filter = 'bandpass', from = 800, to, q = 1, attack = 0.01 }: NoiseOpts) {
  const c = getCtx()
  if (!c || !master) return
  const t0 = c.currentTime + when
  const src = c.createBufferSource()
  src.buffer = getNoiseBuffer(c)
  src.loop = true
  const f = c.createBiquadFilter()
  f.type = filter
  f.Q.value = q
  f.frequency.setValueAtTime(Math.max(10, from), t0)
  if (to !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(10, to), t0 + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(f).connect(g).connect(master)
  src.start(t0)
  src.stop(t0 + dur + 0.02)
}

// ---------------------------------------------------------------------------
// 具名音效（皆 < 0.6s）
// ---------------------------------------------------------------------------

/** 十萬伏特發射：鋸齒驟降 + 噪音劈啪 */
export function sfxZap() {
  tone({ type: 'sawtooth', from: 950, to: 160, dur: 0.2, gain: 0.22 })
  tone({ type: 'square', from: 1900, to: 500, dur: 0.12, gain: 0.08, when: 0.02 })
  noise({ dur: 0.18, gain: 0.18, filter: 'bandpass', from: 3200, to: 900, q: 2 })
}

/** 通用飛行道具 / 衝刺：濾波噪音掃頻（low = 火焰等厚重版） */
export function sfxWhoosh(lowVariant = false) {
  if (lowVariant) noise({ dur: 0.34, gain: 0.26, filter: 'bandpass', from: 180, to: 750, q: 1.2, attack: 0.05 })
  else noise({ dur: 0.28, gain: 0.22, filter: 'bandpass', from: 450, to: 2100, q: 1.4, attack: 0.03 })
}

/** 近戰揮擊：高頻噪音啁啾 + 正弦 tick */
export function sfxSlash() {
  noise({ dur: 0.12, gain: 0.2, filter: 'highpass', from: 2600, to: 5600, attack: 0.004 })
  tone({ type: 'sine', from: 1300, to: 2600, dur: 0.055, gain: 0.1 })
}

/** 命中：低頻悶擊（120→40Hz）+ 噪音 tap；heavy（傷害 ≥60）加副低音 boom */
export function sfxImpact(heavy = false) {
  tone({ type: 'sine', from: 120, to: 40, dur: 0.22, gain: 0.5, attack: 0.003 })
  noise({ dur: 0.07, gain: 0.24, filter: 'lowpass', from: 900, attack: 0.002 })
  if (heavy) tone({ type: 'sine', from: 62, to: 28, dur: 0.4, gain: 0.5, attack: 0.004 })
}

/** 效果絕佳（倍率 ≥2）：重命中 + 上行雙音 sting */
export function sfxSuperEffective() {
  sfxImpact(true)
  tone({ type: 'square', from: 660, dur: 0.09, gain: 0.12, when: 0.06 })
  tone({ type: 'square', from: 990, dur: 0.13, gain: 0.12, when: 0.16 })
}

/** KO：三音下行 */
export function sfxKo() {
  tone({ type: 'triangle', from: 523, dur: 0.16, gain: 0.22 })
  tone({ type: 'triangle', from: 392, dur: 0.16, gain: 0.22, when: 0.17 })
  tone({ type: 'triangle', from: 262, dur: 0.3, gain: 0.24, when: 0.34 })
}

/** 勝利小號角：四音上行（合成、非任何既有旋律） */
export function sfxFanfare() {
  const notes = [523.25, 659.25, 783.99, 1046.5]
  notes.forEach((f, i) => {
    const last = i === notes.length - 1
    tone({ type: 'square', from: f, dur: last ? 0.42 : 0.14, gain: 0.12, when: i * 0.13 })
    tone({ type: 'triangle', from: f / 2, dur: last ? 0.42 : 0.14, gain: 0.1, when: i * 0.13 })
  })
}

/** UI 點擊（選角/樣式切換可用；目前未接線） */
export function sfxUiTick() {
  tone({ type: 'sine', from: 880, to: 660, dur: 0.045, gain: 0.08 })
}

/** 高速星星：三連正弦琶音（亮晶晶） */
export function sfxSparkle() {
  tone({ type: 'sine', from: 880, dur: 0.1, gain: 0.11 })
  tone({ type: 'sine', from: 1318, dur: 0.1, gain: 0.11, when: 0.06 })
  tone({ type: 'sine', from: 1760, dur: 0.14, gain: 0.1, when: 0.12 })
}

/** 水手裏劍：三連短 whoosh */
export function sfxTripleWhoosh() {
  for (let i = 0; i < 3; i++) noise({ dur: 0.1, gain: 0.16, filter: 'bandpass', from: 900, to: 2400, q: 2, when: i * 0.07 })
}

/** 波導/念力系：低頻脈動蓄力感 */
export function sfxAuraPulse() {
  tone({ type: 'sine', from: 220, to: 470, dur: 0.24, gain: 0.16, attack: 0.03 })
  tone({ type: 'triangle', from: 440, to: 940, dur: 0.2, gain: 0.08, when: 0.04 })
}

/** 月亮之力：柔和下滑 shimmer + 尾綴亮音 */
export function sfxMoonShimmer() {
  tone({ type: 'triangle', from: 988, to: 494, dur: 0.3, gain: 0.14, attack: 0.04 })
  tone({ type: 'sine', from: 1976, dur: 0.12, gain: 0.07, when: 0.12 })
}

/** 光束系：短促 pew（方波下滑） */
export function sfxPew() {
  tone({ type: 'square', from: 1250, to: 320, dur: 0.16, gain: 0.14 })
  noise({ dur: 0.1, gain: 0.08, filter: 'highpass', from: 3000 })
}

/** 岩石系：低沉拋擲 + 碎石粒感 */
export function sfxRockThrow() {
  tone({ type: 'sine', from: 150, to: 70, dur: 0.2, gain: 0.3, attack: 0.006 })
  noise({ dur: 0.16, gain: 0.14, filter: 'lowpass', from: 600, to: 250 })
}

/** 風系：長一點的氣流掃頻 */
export function sfxWindSweep() {
  noise({ dur: 0.42, gain: 0.2, filter: 'bandpass', from: 500, to: 2600, q: 3, attack: 0.06 })
  noise({ dur: 0.3, gain: 0.1, filter: 'bandpass', from: 300, to: 900, q: 1, when: 0.05 })
}

/** 招牌能力計量集滿：上行三音 sting（亮、短、辨識度高） */
export function sfxMeterReady() {
  tone({ type: 'square', from: 740, dur: 0.09, gain: 0.13 })
  tone({ type: 'square', from: 1108, dur: 0.1, gain: 0.13, when: 0.09 })
  tone({ type: 'triangle', from: 1480, dur: 0.24, gain: 0.12, when: 0.18 })
  tone({ type: 'sine', from: 2960, dur: 0.2, gain: 0.05, when: 0.2 })
}

/** 招牌能力發動：0.8s 低吼上升 swell + 收尾低頻震撼（MEGA / 極巨化 / Z 招式共用） */
export function sfxGimmickCharge() {
  tone({ type: 'sawtooth', from: 65, to: 520, dur: 0.8, gain: 0.26, attack: 0.1 })
  tone({ type: 'triangle', from: 130, to: 1040, dur: 0.78, gain: 0.14, attack: 0.12, when: 0.04 })
  noise({ dur: 0.85, gain: 0.16, filter: 'bandpass', from: 260, to: 2600, q: 1.1, attack: 0.25 })
  // 尾端 impact：能量炸開
  tone({ type: 'sine', from: 60, to: 26, dur: 0.5, gain: 0.5, attack: 0.004, when: 0.78 })
  noise({ dur: 0.22, gain: 0.2, filter: 'lowpass', from: 800, attack: 0.004, when: 0.78 })
}

// ---------------------------------------------------------------------------
// 發射音對照表：每種視覺樣式一個專屬發射音（純資料，可測試）
// ---------------------------------------------------------------------------

export type LaunchSoundId =
  | 'zap' | 'sparkle' | 'whooshLow' | 'windSweep' | 'tripleWhoosh'
  | 'auraPulse' | 'moonShimmer' | 'pew' | 'rockThrow'

export const LAUNCH_SOUND: Record<MoveVisualId, LaunchSoundId> = {
  bolt: 'zap',
  stars: 'sparkle',
  flame: 'whooshLow',
  wind: 'windSweep',
  shuriken: 'tripleWhoosh',
  aura: 'auraPulse',
  moon: 'moonShimmer',
  beam: 'pew',
  rock: 'rockThrow',
}

const LAUNCH_PLAYERS: Record<LaunchSoundId, () => void> = {
  zap: sfxZap,
  sparkle: sfxSparkle,
  whooshLow: () => sfxWhoosh(true),
  windSweep: sfxWindSweep,
  tripleWhoosh: sfxTripleWhoosh,
  auraPulse: sfxAuraPulse,
  moonShimmer: sfxMoonShimmer,
  pew: sfxPew,
  rockThrow: sfxRockThrow,
}

/** 投射發射音：依招式視覺樣式挑專屬合成音（未指定 → beam 的 pew） */
export function playLaunch(visual?: MoveVisualId) {
  LAUNCH_PLAYERS[LAUNCH_SOUND[visual ?? 'beam']]()
}

// ---------------------------------------------------------------------------
// 鳴叫（cry）檔案播放：節流 + 一次性觸發
// ---------------------------------------------------------------------------

const cryUrl = (dex: number) => `/assets/cries/latest/${dex}.ogg`

export function playCryFile(dex: number, volume = 0.5) {
  if (typeof window === 'undefined') return
  try {
    const a = new Audio(cryUrl(dex))
    a.volume = volume
    void a.play().catch(() => { /* autoplay 政策：忽略 */ })
  } catch { /* 無音訊裝置 */ }
}

const cryLastAt = new Map<string, number>()
const cryOnceKeys = new Set<string>()

/** 機率鳴叫：prob 命中且距上次 ≥ throttleMs 才播（發招時偶爾吼一聲） */
export function maybeCry(dex: number, key: string, prob = 0.25, throttleMs = 6000) {
  if (typeof window === 'undefined') return
  const now = performance.now()
  if (now - (cryLastAt.get(key) ?? -Infinity) < throttleMs) return
  if (Math.random() >= prob) return
  cryLastAt.set(key, now)
  playCryFile(dex, 0.45)
}

/** 一次性鳴叫：同 key 每場只播一次（低血量哀鳴） */
export function cryOnce(dex: number, key: string, volume = 0.5) {
  if (typeof window === 'undefined') return
  if (cryOnceKeys.has(key)) return
  cryOnceKeys.add(key)
  playCryFile(dex, volume)
}

/** 再戰 / 換場：清掉節流與一次性紀錄 */
export function resetCries() {
  cryLastAt.clear()
  cryOnceKeys.clear()
}

/** 測試用：一次性 key 是否已觸發 */
export function hasCriedOnce(key: string): boolean {
  return cryOnceKeys.has(key)
}

// dev 診斷：瀏覽器 console 可 __sfx.audioState() / __sfx.playLaunch('bolt') 試聽
if (typeof window !== 'undefined') {
  ;(window as unknown as { __sfx?: object }).__sfx = {
    audioState, unlockAudio, playLaunch,
    sfxZap, sfxWhoosh, sfxSlash, sfxImpact, sfxSuperEffective, sfxKo, sfxFanfare, sfxUiTick,
    sfxMeterReady, sfxGimmickCharge,
  }
}
