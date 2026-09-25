'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { buttonClass, inputClass } from '@/components/ui'

export function LoginForm({ devLogin, demoLogin }: { devLogin: boolean; demoLogin: boolean }) {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const { error } = await authClient.signIn.email({ email, password })
    setPending(false)
    if (error) {
      setError(error.status === 429 ? '試行回数が多すぎます。少し時間をおいてください' : 'メールアドレスかパスワードが違います')
      return
    }
    const next = params.get('next')
    router.push(next && next.startsWith('/') && !next.startsWith('//') ? next : '/clients')
    router.refresh()
  }

  return (
    <div className="relative w-full max-w-sm rounded-3xl bg-white p-8 shadow-[0_10px_40px_rgba(80,60,0,0.12)]">
      <img src="/resole-logo.svg" alt="Resole" className="mx-auto h-14" />
      <p className="en mt-3 text-center text-sm text-ink-3">Client Management</p>
      <h1 className="mt-1 text-center text-lg font-black">{demoLogin ? '顧客管理 デモ版' : '顧客管理 ログイン'}</h1>
      {demoLogin && (
        <form method="post" action="/api/demo/login" className="mt-6">
          <button type="submit" className={`${buttonClass.primary} h-12 w-full text-base`}>
            デモを見る（ログイン不要）
          </button>
          <p className="mt-2.5 text-xs leading-relaxed text-ink-2">架空のお客様のデータで、記録や手書きメモも試せます。本当のお客様の情報は入力しないでください。</p>
          <p className="mt-6 border-t border-line pt-4 text-center text-xs font-bold text-ink-3">アカウントをお持ちの方</p>
        </form>
      )}
      <form onSubmit={submit}>
        <label className={`${demoLogin ? 'mt-3' : 'mt-7'} block text-sm font-bold`}>
          メールアドレス
          <input className={`${inputClass} mt-1.5`} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="mt-4 block text-sm font-bold">
          パスワード
          <span className="relative mt-1.5 block">
            <input
              className={`${inputClass} pr-11`}
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center text-ink-3"
              aria-label={show ? 'パスワードを隠す' : 'パスワードを表示'}
            >
              {show ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
            </button>
          </span>
        </label>
        {error && (
          <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} className={`${demoLogin ? buttonClass.secondary : buttonClass.primary} mt-7 h-12 w-full text-base`}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          ログイン
        </button>
        {devLogin && (
          <a href="/api/dev/login" className={`${buttonClass.secondary} mt-3 w-full`}>
            開発用オーナーでログイン
          </a>
        )}
      </form>
    </div>
  )
}
