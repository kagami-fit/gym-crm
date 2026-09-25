// npm run dev: 開発用DBを起動してから Next.js の開発サーバーを立ち上げる（終了時にDBも止める）
// 同じWi-Fiの iPad からも開けるよう、この Mac の IP で中継も立ち上げる（LAN=0 で無効）
import { spawn } from 'node:child_process'
import { startDevDb } from './dev-db.mjs'
import { startLanProxy } from './lan-proxy.mjs'
import { lanAddresses, lanHosts } from '../lib/dev-hosts.mjs'

const port = Number(process.env.PORT ?? 3020)
const stopDb = await startDevDb()

// 本体はこの Mac の中だけで待ち受ける（他の端末は必ず下の中継を通る）
const next = spawn('npx', ['next', 'dev', '-p', String(port), '-H', '127.0.0.1'], { stdio: 'inherit', env: process.env })

const addresses = process.env.LAN === '0' ? [] : lanAddresses()
const stopProxy = addresses.length ? startLanProxy({ addresses, port, target: port }) : async () => {}
const isHomeLan = (ip) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)
console.log(`\n  この Mac で開く: http://localhost:${port}`)
if (addresses.length) {
  const others = [...addresses.filter((a) => !isHomeLan(a)), ...lanHosts().filter((h) => h.endsWith('.local') && h === h.toLowerCase())]
  for (const a of addresses.filter(isHomeLan)) console.log(`  iPad で開く（同じWi-Fi）: http://${a}:${port}`)
  if (others.length) console.log(`    つながらないとき: ${others.map((h) => `http://${h}:${port}`).join(' ／ ')}`)
}
console.log('')

let stopping = false
async function shutdown(code = 0) {
  if (stopping) return
  stopping = true
  if (!next.killed) next.kill('SIGINT')
  await stopProxy()
  await stopDb()
  process.exit(code)
}
next.on('exit', (code) => shutdown(code ?? 0))
process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
