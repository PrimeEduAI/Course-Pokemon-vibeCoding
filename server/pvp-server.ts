import type { ServerWebSocket } from 'bun'

/**
 * 好友對戰 relay 伺服器（Bun WebSocket）：
 * - 只做「4 碼房號配對 + 訊息盲轉發」，不跑任何遊戲邏輯（傷害權威在客戶端，見 lib/pvp/protocol.ts）。
 * - 教室用法：老師機（或任一台）跑 `bun run pvp`，兩位玩家在遊戲的「好友對戰」輸入這台的 IP。
 * - 每房上限 2 人；斷線即通知對手（peer-left），空房自動回收。
 */

interface Ctx {
  room: string | null
}

type ClientMsg =
  | { t: 'create' }
  | { t: 'join'; room?: string }
  | { t: 'msg'; d: unknown }

type Peer = ServerWebSocket<Ctx>

export function createPvpServer(port = 3412) {
  const rooms = new Map<string, Set<Peer>>()

  const genCode = (): string => {
    for (;;) {
      const code = String(Math.floor(1000 + Math.random() * 9000))
      if (!rooms.has(code)) return code
    }
  }

  const send = (ws: Peer, msg: unknown): void => { ws.send(JSON.stringify(msg)) }

  const leave = (ws: Peer) => {
    const code = ws.data.room
    if (!code) return
    ws.data.room = null
    const room = rooms.get(code)
    if (!room) return
    room.delete(ws)
    if (room.size === 0) rooms.delete(code)
    else for (const peer of room) send(peer, { t: 'peer-left' })
  }

  const server = Bun.serve<Ctx>({
    port,
    fetch(req, srv) {
      if (srv.upgrade(req, { data: { room: null } })) return
      return new Response('Pokémon PvP relay OK\n')
    },
    websocket: {
      message(ws, raw) {
        let msg: ClientMsg
        try {
          msg = JSON.parse(String(raw)) as ClientMsg
        } catch {
          return send(ws, { t: 'error', code: 'bad-request' })
        }
        switch (msg.t) {
          case 'create': {
            leave(ws)
            const code = genCode()
            rooms.set(code, new Set([ws]))
            ws.data.room = code
            send(ws, { t: 'created', room: code })
            break
          }
          case 'join': {
            const code = String(msg.room ?? '').trim()
            const room = rooms.get(code)
            if (!room) return send(ws, { t: 'error', code: 'room-not-found' })
            if (room.size >= 2) return send(ws, { t: 'error', code: 'room-full' })
            leave(ws)
            room.add(ws)
            ws.data.room = code
            send(ws, { t: 'joined', room: code })
            for (const peer of room) if (peer !== ws) send(peer, { t: 'peer-joined' })
            break
          }
          case 'msg': {
            const room = ws.data.room ? rooms.get(ws.data.room) : undefined
            if (!room) return
            const out = JSON.stringify({ t: 'msg', d: msg.d })
            for (const peer of room) if (peer !== ws) peer.send(out)
            break
          }
          default:
            send(ws, { t: 'error', code: 'bad-request' })
        }
      },
      close(ws) {
        leave(ws)
      },
    },
  })

  return server
}

if (import.meta.main) {
  const port = Number(process.env.PVP_PORT ?? 3412)
  const server = createPvpServer(port)
  console.log(`⚡ 好友對戰 relay 已啟動：ws://localhost:${server.port}`)
  console.log('   教室用法：把這台電腦的 IP 告訴兩位玩家，在遊戲「好友對戰」輸入即可配對')
}
