'use client'
import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'

/** 過肩視角的球面軌道狀態（world 單位）。yaw=π 時鏡頭正好在角色背後，等同改動前。 */
export interface OrbitState {
  /** 水平角：π 為背後（+Z）；拖曳左右改變 */
  yaw: number
  /** 俯仰角（弧度）：越大鏡頭越高 */
  pitch: number
  /** 鏡頭到錨點距離 */
  dist: number
  /** 是否正在拖曳（拉高 lerp 反應速度用） */
  dragging: boolean
}

/** 錨點（注視點）在角色上方的高度 */
export const ANCHOR_Y = 1.1
/** 預設鏡頭相對角色的抬高 / 後退（沿用改動前的 (2.45, 5.0)） */
const CAM_UP = 2.45
const CAM_BACK = 5.0
export const YAW0 = Math.PI
// 讓預設鏡頭精準落在角色的 (up=2.45, back=5.0)——注視點已抬到 ANCHOR_Y，故以 (CAM_UP-ANCHOR_Y) 反推
export const PITCH0 = Math.atan2(CAM_UP - ANCHOR_Y, CAM_BACK)
export const DIST0 = Math.hypot(CAM_UP - ANCHOR_Y, CAM_BACK)

const PITCH_MIN = 0.08
const PITCH_MAX = 1.15
const DIST_MIN = 3.2
const DIST_MAX = 11
const TWO_PI = Math.PI * 2

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

interface Tween {
  t: number
  dur: number
  fromYaw: number
  toYaw: number
  fromPitch: number
  fromDist: number
}

/**
 * 掛在 canvas（gl.domElement）上的滑鼠軌道控制：
 *  - 按住拖曳（任意鍵）→ 轉視角；右鍵拖曳抑制 context menu
 *  - 滾輪 → 縮放（passive:false 阻止頁面捲動）
 *  - V（window keydown）→ ~0.35s 平滑復位
 * 回傳可變 state（供 useFrame 讀取）與需在 useFrame 每幀呼叫的 update(dt)（推進復位補間）。
 */
export function useOrbitControls() {
  const state = useRef<OrbitState>({ yaw: YAW0, pitch: PITCH0, dist: DIST0, dragging: false })
  const tween = useRef<Tween | null>(null)
  const { gl } = useThree()

  useEffect(() => {
    const dom = gl.domElement
    let lastX = 0
    let lastY = 0
    let activePointer: number | null = null

    const onPointerDown = (e: PointerEvent) => {
      activePointer = e.pointerId
      state.current.dragging = true
      lastX = e.clientX
      lastY = e.clientY
      tween.current = null // 抓住鏡頭即取消復位補間
      dom.style.cursor = 'grabbing'
      try { dom.setPointerCapture(e.pointerId) } catch { /* 合成事件可能無指標捕捉 */ }
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!state.current.dragging || e.pointerId !== activePointer) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      state.current.yaw -= dx * 0.006
      state.current.pitch = clamp(state.current.pitch + dy * 0.004, PITCH_MIN, PITCH_MAX)
    }
    const endDrag = (e: PointerEvent) => {
      if (e.pointerId !== activePointer) return
      state.current.dragging = false
      activePointer = null
      dom.style.cursor = 'grab'
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      state.current.dist = clamp(state.current.dist * (1 + e.deltaY * 0.001), DIST_MIN, DIST_MAX)
    }
    const onContextMenu = (e: MouseEvent) => e.preventDefault()
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyV' && e.key !== 'v' && e.key !== 'V') return
      const s = state.current
      // 取最短路徑回到 π，避免多圈拖曳後長途繞回
      let d = (YAW0 - s.yaw) % TWO_PI
      if (d > Math.PI) d -= TWO_PI
      if (d < -Math.PI) d += TWO_PI
      tween.current = { t: 0, dur: 0.35, fromYaw: s.yaw, toYaw: s.yaw + d, fromPitch: s.pitch, fromDist: s.dist }
    }

    dom.style.cursor = 'grab'
    // 滑鼠監聽只掛在 canvas（配合 setPointerCapture，拖到畫布外仍持續）——HUD 按鈕維持可點
    dom.addEventListener('pointerdown', onPointerDown)
    dom.addEventListener('pointermove', onPointerMove)
    dom.addEventListener('pointerup', endDrag)
    dom.addEventListener('pointercancel', endDrag)
    dom.addEventListener('wheel', onWheel, { passive: false })
    dom.addEventListener('contextmenu', onContextMenu)
    // V 復位用純 window keydown（BattleScene 的 KeyboardControls 不可動）
    window.addEventListener('keydown', onKey)

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown)
      dom.removeEventListener('pointermove', onPointerMove)
      dom.removeEventListener('pointerup', endDrag)
      dom.removeEventListener('pointercancel', endDrag)
      dom.removeEventListener('wheel', onWheel)
      dom.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('keydown', onKey)
      dom.style.cursor = ''
    }
  }, [gl])

  /** 每幀推進復位補間（smoothstep 緩動） */
  const update = (dt: number) => {
    const tw = tween.current
    if (!tw) return
    tw.t = Math.min(1, tw.t + dt / tw.dur)
    const e = tw.t * tw.t * (3 - 2 * tw.t)
    const s = state.current
    s.yaw = tw.fromYaw + (tw.toYaw - tw.fromYaw) * e
    s.pitch = tw.fromPitch + (PITCH0 - tw.fromPitch) * e
    s.dist = tw.fromDist + (DIST0 - tw.fromDist) * e
    if (tw.t >= 1) tween.current = null
  }

  return { state, update }
}
