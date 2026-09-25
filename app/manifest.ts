import type { MetadataRoute } from 'next'

// iPad の Safari で「ホーム画面に追加」すると、アプリのように全画面で開ける
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Resole 顧客管理',
    short_name: '顧客管理',
    description: 'Resole のトレーナー用 顧客管理',
    start_url: '/clients',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#fbf8ed',
    theme_color: '#ffffff',
    lang: 'ja',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
