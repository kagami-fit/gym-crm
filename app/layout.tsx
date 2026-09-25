import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Montserrat, Noto_Sans_JP } from 'next/font/google'
import { APP_NAME } from '@/lib/app'

const noto = Noto_Sans_JP({ subsets: ['latin'], weight: ['400', '500', '700', '900'], variable: '--nf-noto', display: 'swap', preload: false })
// 英数字は Resole の公式サイトと同じ Montserrat（和文のゴシックMB101はWebフォントがないため Noto Sans JP）
const montserrat = Montserrat({ subsets: ['latin'], weight: ['500', '600', '700'], style: ['normal', 'italic'], variable: '--nf-mont', display: 'swap' })

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s｜${APP_NAME}` },
  applicationName: APP_NAME,
  // 顧客の健康情報を扱うため、検索結果には出さない
  robots: { index: false, follow: false },
  // iPad の「ホーム画面に追加」でアプリのように開く
  appleWebApp: { capable: true, title: '顧客管理', statusBarStyle: 'default' },
  formatDetection: { telephone: false, email: false, address: false },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#ffffff' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body suppressHydrationWarning className={`${noto.variable} ${montserrat.variable} min-h-dvh bg-page font-sans text-ink antialiased`}>{children}</body>
    </html>
  )
}
