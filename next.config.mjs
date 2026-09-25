import { lanHosts } from './lib/dev-hosts.mjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // 開発中、同じWi-Fiの iPad から http://<このMacのIP>:3020 で開けるようにする
  allowedDevOrigins: [...lanHosts(), '*.local'],
  experimental: {
    // 手書きメモ（線の座標）を保存できるよう、送信サイズの上限を広げる（初期値は1MB）
    serverActions: { bodySizeLimit: '4mb' },
  },
}

export default nextConfig
