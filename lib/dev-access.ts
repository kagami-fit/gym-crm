import { LAN_HEADER } from './dev-hosts.mjs'

/**
 * 開発用オーナーでのログインを使ってよいか。開発中で、この Mac で開いたときだけ true。
 * 開発サーバーの本体はこの Mac の中（127.0.0.1）だけで待ち受け、iPad など他の端末からの通信は
 * scripts/lan-proxy.mjs の中継を通って印（LAN_HEADER）が付くので、見た目のホスト名をごまかしても使えない。
 */
export function devLoginEnabled(headers: Headers): boolean {
  if (process.env.NODE_ENV === 'production' || process.env.DEV_LOGIN !== 'true') return false
  if (!process.env.DEV_OWNER_EMAIL || !process.env.DEV_OWNER_PASSWORD) return false
  if (headers.get(LAN_HEADER)) return false
  const host = (headers.get('host') ?? '').replace(/:\d+$/, '').toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
}
