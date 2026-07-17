import { afterAll, describe, expect, test } from 'bun:test'
import { createPvpServer } from '../server/pvp-server'

/**
 * relay 伺服器整合測試：真的起一個 Bun.serve（port 0 = 隨機埠），
 * 用兩個 WebSocket 客戶端走完 建房 → 加入 → 雙向轉發 → 斷線通知 全流程。
 */

const server = createPvpServer(0)
afterAll(() => server.stop(true))

type Msg = Record<string, unknown>

interface Client {
  ws: WebSocket
  /** 依序取出下一則訊息（先進先出；沒有就等） */
  next: () => Promise<Msg>
  send: (m: Msg) => void
  close: () => void
}

function connect(): Promise<Client> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${server.port}`)
    const queue: Msg[] = []
    const waiters: ((m: Msg) => void)[] = []
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data)) as Msg
      const w = waiters.shift()
      if (w) w(m)
      else queue.push(m)
    }
    ws.onerror = () => reject(new Error('ws connect failed'))
    ws.onopen = () =>
      resolve({
        ws,
        next: () => {
          const m = queue.shift()
          if (m) return Promise.resolve(m)
          return new Promise<Msg>((res, rej) => {
            waiters.push(res)
            setTimeout(() => rej(new Error('timeout waiting for message')), 2000)
          })
        },
        send: (m) => ws.send(JSON.stringify(m)),
        close: () => ws.close(),
      })
  })
}

describe('PvP relay 伺服器', () => {
  test('建房 → 加入 → 雙向轉發 → 斷線通知', async () => {
    const a = await connect()
    const b = await connect()

    // A 建房拿 4 碼房號
    a.send({ t: 'create' })
    const created = await a.next()
    expect(created.t).toBe('created')
    const room = created.room as string
    expect(room).toMatch(/^\d{4}$/)

    // B 加錯房 → room-not-found（房號空間 1000–9999，翻轉一碼保證不撞）
    const wrong = room === '9999' ? '1000' : '9999'
    b.send({ t: 'join', room: wrong })
    expect((await b.next()).code).toBe('room-not-found')

    // B 正確加入 → 自己收 joined、A 收 peer-joined
    b.send({ t: 'join', room })
    expect((await b.next()).t).toBe('joined')
    expect((await a.next()).t).toBe('peer-joined')

    // 遊戲訊息雙向盲轉發（不回送給發送者）
    a.send({ t: 'msg', d: { g: 'snap', p: [0, 1, -6] } })
    const gotB = await b.next()
    expect(gotB.t).toBe('msg')
    expect((gotB.d as Msg).g).toBe('snap')

    b.send({ t: 'msg', d: { g: 'hitC', dmg: 42 } })
    const gotA = await a.next()
    expect((gotA.d as Msg).dmg).toBe(42)

    // 第三人加入滿房 → room-full
    const c = await connect()
    c.send({ t: 'join', room })
    expect((await c.next()).code).toBe('room-full')
    c.close()

    // A 斷線 → B 收 peer-left
    a.close()
    expect((await b.next()).t).toBe('peer-left')
    b.close()
  })

  test('格式錯誤 → bad-request；沒進房的 msg 被靜默丟棄', async () => {
    const x = await connect()
    x.ws.send('not-json')
    expect((await x.next()).code).toBe('bad-request')
    // 沒進房就送遊戲訊息：不轉發也不報錯（下一則錯誤訊息仍正常到達 = 連線沒被搞壞）
    x.send({ t: 'msg', d: { g: 'snap' } })
    x.send({ t: 'unknown' })
    expect((await x.next()).code).toBe('bad-request')
    x.close()
  })
})
