import { create } from 'zustand'
import {
  wsUrl,
  type ClientMsg, type GameMsg, type PvpErrorCode, type ServerMsg, type Vec3,
} from '@/lib/pvp/protocol'
import type { FighterDef } from '@/lib/battle/species'
import type { ArenaId, FieldType } from '@/components/three/arenas/types'
import type { MotionState } from './battleWorld'
import { useBattle } from './useBattle'
import { useArena } from './useArena'

/**
 * 好友對戰連線狀態（lobby 生命週期 + 遊戲訊息路由）：
 * - 大廳訊息（config / fighter / rematch / snap）在這裡直接處理；
 * - 戰鬥事件（swing / shot / hitA / hitC / gimmick）交給 PvpDriver 註冊的 handler
 *   （它們需要 three 世界與 combat 管線，避免 store 反向依賴 Canvas 層）。
 */

export interface NetSnap { t: number; p: Vec3; f: number; m: MotionState }

/** 非反應式網路頻道（每幀讀寫）：對手快照緩衝 + 事件去重游標 */
export const netWorld = {
  snaps: [] as NetSnap[],
  lastSnapSentAt: 0,
  lastAttackAtSent: 0,
  lastProjIdSent: 0,
  lastGimmickAtSent: 0,
}

export function clearNetWorld() {
  netWorld.snaps.length = 0
  netWorld.lastSnapSentAt = 0
  netWorld.lastAttackAtSent = 0
  netWorld.lastProjIdSent = 0
  netWorld.lastGimmickAtSent = 0
}

type GameHandler = (msg: GameMsg) => void
let gameHandler: GameHandler | null = null
/** PvpDriver 掛載時註冊戰鬥事件處理器（卸載時傳 null） */
export function setGameHandler(h: GameHandler | null) {
  gameHandler = h
}

export type NetPhase = 'idle' | 'connecting' | 'waiting' | 'paired'

const ERR_ZH: Record<PvpErrorCode | 'conn', string> = {
  'room-not-found': '找不到這個房號，跟對方再確認一次',
  'room-full': '這個房間已經滿了',
  'bad-request': '訊息格式錯誤',
  conn: '連不上伺服器 — 確認老師機已執行 bun run pvp，IP 沒打錯',
}

interface NetworkState {
  phase: NetPhase
  roomCode: string | null
  isHost: boolean
  error: string | null
  /** 對手離線 / 連線中斷（戰鬥中顯示覆蓋層） */
  peerLeft: boolean
  /** 雙方選定的出戰者（都到齊 → 開打） */
  myFighter: FighterDef | null
  peerFighter: FighterDef | null

  create: (addr: string) => void
  join: (addr: string, room: string) => void
  disconnect: () => void
  sendGame: (m: GameMsg) => void
  /** 房主選完戰場 → 廣播給客隊 */
  sendConfig: (arena: ArenaId, fieldType: FieldType | null) => void
  /** 我方選定出戰者 → 記錄 + 廣播 */
  chooseFighter: (f: FighterDef) => void
}

let socket: WebSocket | null = null

function closeSocket() {
  if (!socket) return
  const ws = socket
  socket = null
  ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null
  try { ws.close() } catch { /* 已關閉 */ }
}

export const useNetwork = create<NetworkState>((set, get) => {
  const sendRaw = (m: ClientMsg) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(m))
  }

  const handleGame = (m: GameMsg) => {
    switch (m.g) {
      case 'config':
        useArena.getState().applyConfig(m.arena, m.fieldType)
        break
      case 'fighter':
        set({ peerFighter: m.fighter })
        break
      case 'snap': {
        netWorld.snaps.push({ t: performance.now(), p: m.p, f: m.f, m: m.m })
        if (netWorld.snaps.length > 40) netWorld.snaps.splice(0, netWorld.snaps.length - 40)
        useBattle.getState().netSyncEnemy(m.hp, m.meter, m.used)
        break
      }
      case 'rematch':
        clearNetWorld()
        useBattle.getState().reset()
        break
      default:
        gameHandler?.(m)
    }
  }

  const handleServer = (msg: ServerMsg) => {
    switch (msg.t) {
      case 'created':
        set({ phase: 'waiting', roomCode: msg.room, isHost: true })
        break
      case 'joined':
        set({ phase: 'paired', roomCode: msg.room, isHost: false })
        break
      case 'peer-joined':
        set({ phase: 'paired' })
        break
      case 'peer-left':
        set({ peerLeft: true })
        break
      case 'error':
        set({ phase: 'idle', error: ERR_ZH[msg.code] ?? msg.code })
        closeSocket()
        break
      case 'msg':
        handleGame(msg.d)
        break
    }
  }

  const open = (addr: string, firstMsg: ClientMsg) => {
    closeSocket()
    clearNetWorld()
    set({
      phase: 'connecting', error: null, peerLeft: false,
      roomCode: null, myFighter: null, peerFighter: null,
    })
    let ws: WebSocket
    try {
      ws = new WebSocket(wsUrl(addr))
    } catch {
      set({ phase: 'idle', error: ERR_ZH.conn })
      return
    }
    socket = ws
    ws.onopen = () => ws.send(JSON.stringify(firstMsg))
    ws.onmessage = (e) => {
      try { handleServer(JSON.parse(String(e.data)) as ServerMsg) } catch { /* 非 JSON：忽略 */ }
    }
    ws.onerror = () => {
      if (socket === ws && get().phase === 'connecting') {
        set({ phase: 'idle', error: ERR_ZH.conn })
        closeSocket()
      }
    }
    ws.onclose = () => {
      // 連線意外斷掉（非主動 disconnect）：等同對手離線
      if (socket === ws && get().phase !== 'idle') set({ peerLeft: true })
    }
  }

  return {
    phase: 'idle',
    roomCode: null,
    isHost: false,
    error: null,
    peerLeft: false,
    myFighter: null,
    peerFighter: null,

    create: (addr) => open(addr, { t: 'create' }),
    join: (addr, room) => open(addr, { t: 'join', room: room.trim() }),

    disconnect: () => {
      set({
        phase: 'idle', roomCode: null, isHost: false, error: null,
        peerLeft: false, myFighter: null, peerFighter: null,
      })
      closeSocket()
      clearNetWorld()
    },

    sendGame: (m) => sendRaw({ t: 'msg', d: m }),

    sendConfig: (arena, fieldType) => sendRaw({ t: 'msg', d: { g: 'config', arena, fieldType } }),

    chooseFighter: (f) => {
      set({ myFighter: f })
      sendRaw({ t: 'msg', d: { g: 'fighter', fighter: f } })
    },
  }
})
