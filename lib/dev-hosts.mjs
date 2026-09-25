// 開発中に、同じWi-Fiの iPad からこの Mac の開発サーバーを開くための設定（本番では使わない）
import os from 'node:os'

/** 他の端末からの通信（scripts/lan-proxy.mjs の中継を通ったもの）に付ける印 */
export const LAN_HEADER = 'x-gym-lan'

/** この Mac の LAN の IPv4 アドレス（Wi-Fi など） */
export function lanAddresses() {
  const out = new Set()
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list ?? []) if (i.family === 'IPv4' && !i.internal) out.add(i.address)
  }
  return [...out]
}

/** iPad のブラウザに入力するホスト名（IP と「〜.local」の名前） */
export function lanHosts() {
  const base = os.hostname().replace(/\.local$/i, '')
  return [...new Set([...lanAddresses(), `${base}.local`, `${base.toLowerCase()}.local`])]
}
