// 同じWi-Fiの iPad から開発サーバーを開くための中継（npm run dev から起動。本番では使わない）。
// Next.js の本体はこの Mac の中（127.0.0.1）だけで待ち受け、他の端末からの通信はすべてこの中継を通す。
// 中継を通った通信には印（LAN_HEADER）を付け、開発用ログインなど「この Mac だけ」の機能を使えないようにする。
import http from 'node:http'
import net from 'node:net'
import { LAN_HEADER } from '../lib/dev-hosts.mjs'

/** 転送するヘッダー。相手が送ってきた印は消して、こちらで付け直す */
function forwardHeaders(req) {
  const headers = { ...req.headers }
  delete headers[LAN_HEADER]
  delete headers.expect
  headers[LAN_HEADER] = '1'
  headers['x-forwarded-for'] = req.socket.remoteAddress ?? ''
  return headers
}

/**
 * addresses の各アドレスの port で待ち受け、127.0.0.1:target に転送する。止める関数を返す。
 * 画面の更新を伝える通信（WebSocket）もそのまま中継する。
 */
export function startLanProxy({ addresses, port, target }) {
  const servers = []
  for (const address of addresses) {
    const server = http.createServer((req, res) => {
      const upstream = http.request(
        { host: '127.0.0.1', port: target, method: req.method, path: req.url, headers: forwardHeaders(req) },
        (up) => {
          res.writeHead(up.statusCode ?? 502, up.statusMessage, up.rawHeaders)
          up.pipe(res)
        },
      )
      upstream.on('error', () => {
        if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('開発サーバーを起動しています。少し待ってから再読み込みしてください')
      })
      req.pipe(upstream)
    })

    server.on('upgrade', (req, socket, head) => {
      const upstream = net.connect(target, '127.0.0.1', () => {
        let raw = `${req.method} ${req.url} HTTP/1.1\r\n`
        for (const [k, v] of Object.entries(forwardHeaders(req))) {
          for (const value of Array.isArray(v) ? v : [v]) raw += `${k}: ${value}\r\n`
        }
        upstream.write(`${raw}\r\n`)
        if (head?.length) upstream.write(head)
        upstream.pipe(socket)
        socket.pipe(upstream)
      })
      const close = () => {
        socket.destroy()
        upstream.destroy()
      }
      upstream.on('error', close)
      upstream.on('close', close)
      socket.on('error', close)
      socket.on('close', close)
    })

    server.on('error', (e) => console.warn(`iPad 用の中継を ${address}:${port} で開けませんでした（${e.code ?? e.message}）`))
    server.listen(port, address)
    servers.push(server)
  }
  return () =>
    Promise.all(
      servers.map(
        (s) =>
          new Promise((resolve) => {
            s.closeAllConnections?.()
            s.close(() => resolve())
          }),
      ),
    )
}
