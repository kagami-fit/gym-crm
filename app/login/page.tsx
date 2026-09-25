import { Suspense } from 'react'
import { headers } from 'next/headers'
import { devLoginEnabled } from '@/lib/dev-access'
import { LoginForm } from './LoginForm'

export const metadata = { title: 'ログイン' }

export default async function LoginPage() {
  // 開発用ログインのボタンは、この Mac で開いたときだけ出す（iPad など他の端末には出さない）
  const devLogin = devLoginEnabled(await headers())
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-page px-4 py-10">
      {/* Resole サイトのファーストビューの黄色い筆あと */}
      <div aria-hidden className="pointer-events-none absolute -left-32 top-[18%] h-64 w-[46rem] -rotate-12 rounded-[9rem] bg-brand opacity-90" />
      <div aria-hidden className="pointer-events-none absolute -right-40 bottom-[8%] h-48 w-[36rem] rotate-[-8deg] rounded-[8rem] bg-brand-soft" />
      <Suspense>
        <LoginForm devLogin={devLogin} />
      </Suspense>
    </main>
  )
}
