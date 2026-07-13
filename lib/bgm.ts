/**
 * 戰鬥 BGM 管理器：模組級單例，全站共用「一顆」HTMLAudioElement。
 * 換戰場只是換 src（不重建元素），避免多軌重疊。音量以 rAF 斜坡淡入淡出。
 * 各代曲目放在 /assets/bgm/{arenaId}.mp3（下載腳本：scripts/download-bgm.sh）。
 *
 * 音量政策：
 *   - 開打（fighting）：LOUD 0.32
 *   - 勝負結算（victory/defeat）：SOFT 0.12（仍循環，墊在結算橫幅底下）
 *   - 靜音：實際音量 0（元素照跑，方便復用）
 * 靜音偏好存 localStorage，預設「開」。缺檔（404）→ 靜默跳過，只 warn 一次。
 */

const LOUD = 0.32
const SOFT = 0.12
const FADE_MS = 1000
const MUTE_KEY = 'pokearena.bgm.muted'

let audio: HTMLAudioElement | null = null
let currentArena = '' // 目前載入的 arenaId（''=未載入）
let phaseSoft = false // 是否進入結算的輕音量
let muted = false // 由 localStorage hydrate
let hydrated = false
let fadeTimer: ReturnType<typeof setInterval> | null = null
let warnedMissing = false
let retryBound = false // 是否已掛上「下次按鍵重試 play()」的一次性監聽

const src = (arenaId: string) => `/assets/bgm/${arenaId}.mp3`

function readMuted(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

function ensureAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null // SSR 安全
  if (!hydrated) {
    muted = readMuted()
    hydrated = true
  }
  if (audio) return audio
  const el = document.createElement('audio')
  el.loop = true
  el.preload = 'auto'
  el.volume = 0
  // 掛進 DOM（隱形）：方便復用與外部狀態檢查（data-bgm / data-arena）
  el.dataset.bgm = '1'
  el.style.display = 'none'
  document.body.appendChild(el)
  audio = el
  return el
}

/** 依目前 phase / mute 算出應該淡到的目標音量 */
function effectiveTarget(): number {
  if (muted) return 0
  return phaseSoft ? SOFT : LOUD
}

/**
 * 以「實際經過時間」內插的音量斜坡（setInterval 而非 rAF）：
 * rAF 在背景/預覽分頁會被凍結，導致淡入永遠跑不完、音量卡在 0；
 * 用時間內插即使 interval 被節流，下一次觸發也會直接跳到正確音量，1 秒內必達目標。
 */
function fadeTo(target: number, ms = FADE_MS, pauseAtZero = false) {
  const el = audio
  if (!el) return
  if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null }
  const from = el.volume
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  if (Math.abs(from - target) < 0.001) {
    el.volume = clamp(target)
    if (pauseAtZero && target === 0) el.pause()
    return
  }
  const start = performance.now()
  const tick = () => {
    if (!audio) { if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null } return }
    const k = Math.min(1, (performance.now() - start) / ms)
    audio.volume = clamp(from + (target - from) * k)
    if (k >= 1) {
      if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null }
      if (pauseAtZero && target === 0) audio.pause()
    }
  }
  fadeTimer = setInterval(tick, 40)
  tick() // 立即先走一步，避免起始的一格延遲
}

/** 嘗試播放；被 autoplay 政策擋下時 warn 並掛一次性 keydown 重試 */
function tryPlay() {
  const el = audio
  if (!el) return
  const p = el.play()
  if (p && typeof p.then === 'function') {
    p.then(() => {
      // 成功：確保淡入到目標音量
      fadeTo(effectiveTarget())
    }).catch(() => {
      if (retryBound) return
      retryBound = true
      const onKey = () => {
        window.removeEventListener('keydown', onKey)
        window.removeEventListener('pointerdown', onKey)
        retryBound = false
        if (audio && currentArena) tryPlay()
      }
      window.addEventListener('keydown', onKey, { once: true })
      window.addEventListener('pointerdown', onKey, { once: true })
    })
  }
}

/**
 * 播放某戰場的 BGM。掛載時（已有使用者手勢）呼叫。
 * 換 arena → 換 src、歸零重播（同一元素，不會多軌）。
 */
export function playArena(arenaId: string) {
  const el = ensureAudio()
  if (!el) return
  phaseSoft = false
  if (currentArena !== arenaId) {
    currentArena = arenaId
    el.dataset.arena = arenaId
    el.src = src(arenaId)
    el.dataset.bgmMissing = ''
    warnedMissing = false
    try {
      el.currentTime = 0
    } catch {
      /* 尚未載入中繼資料時忽略 */
    }
    // 缺檔（404 等）→ 靜默跳過，只 warn 一次
    el.onerror = () => {
      if (!warnedMissing) {
        warnedMissing = true
        el.dataset.bgmMissing = '1'
        console.warn(`[bgm] 找不到或無法載入戰場配樂：${src(arenaId)}（靜默跳過）`)
      }
    }
  }
  el.loop = true
  el.volume = el.paused ? 0 : el.volume // 從 0 淡入（若剛停）
  tryPlay()
  fadeTo(effectiveTarget())
}

/** 進入結算：淡到輕音量（仍循環） */
export function duckForResult() {
  phaseSoft = true
  if (audio && !audio.paused) fadeTo(effectiveTarget())
}

/** 卸載 / 更換戰場：淡出後暫停（元素保留復用） */
export function fadeOutAndPause() {
  if (!audio) return
  fadeTo(0, FADE_MS, true)
}

/** 切換靜音（回傳切換後狀態），並持久化到 localStorage */
export function toggleMuted(): boolean {
  setMuted(!getMuted())
  return muted
}

export function setMuted(next: boolean) {
  ensureAudio() // 確保 hydrate
  muted = next
  try {
    localStorage.setItem(MUTE_KEY, next ? '1' : '0')
  } catch {
    /* localStorage 不可用時忽略 */
  }
  if (!audio) return
  if (muted) {
    fadeTo(0)
  } else {
    // 解除靜音：若還在戰場中，確保有在播並淡回目標音量
    if (currentArena) {
      if (audio.paused) tryPlay()
      fadeTo(effectiveTarget())
    }
  }
}

export function getMuted(): boolean {
  if (!hydrated) {
    muted = readMuted()
    hydrated = true
  }
  return muted
}
