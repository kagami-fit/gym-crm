'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Calculator, LogOut, Settings, Users } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/clients', label: '顧客一覧', short: '顧客', icon: Users },
  { href: '/simulator', label: '体験シミュレーター', short: 'シミュレーター', icon: Calculator },
  { href: '/settings', label: '設定', short: '設定', icon: Settings },
]

/**
 * iPad（縦・横とも）とスマホは上部の横並びメニュー、パソコンの広い画面（1280px以上）だけ左のサイドバー。
 * ホーム画面に追加して全画面で開いたときのために、上の安全領域（ノッチ・時計の部分）をあける。
 */
export function AppNav({ userName, role }: { userName: string; role: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await authClient.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="no-print border-b border-line bg-white pt-[env(safe-area-inset-top)] xl:sticky xl:top-0 xl:flex xl:h-dvh xl:w-60 xl:flex-none xl:flex-col xl:border-b-0 xl:border-r">
      <div className="flex items-center gap-3 px-4 py-2 sm:px-6 xl:block xl:px-6 xl:pt-7">
        <Link href="/clients" className="flex flex-none items-end gap-2 xl:block">
          <img src="/resole-logo.svg" alt="Resole" className="h-9 xl:h-11" />
          <span className="en hidden text-xs text-ink-3 sm:block xl:mt-2">Client Management</span>
        </Link>
        <nav className="ml-auto flex gap-1 xl:hidden" aria-label="メニュー">
          {ITEMS.map(({ href, label, short, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link
                key={href}
                href={href}
                className={cn('flex h-11 items-center gap-2 rounded-full px-3.5 text-sm font-bold text-ink-2 hover:bg-brand-soft sm:px-4', active && 'bg-brand text-ink hover:bg-brand')}
                aria-current={active ? 'page' : undefined}
                aria-label={label}
              >
                <Icon className="size-5" aria-hidden />
                <span className="hidden md:inline">{label}</span>
                <span className="hidden sm:inline md:hidden">{short}</span>
              </Link>
            )
          })}
          <button type="button" onClick={logout} className="flex h-11 items-center gap-2 rounded-full px-3 text-sm font-bold text-ink-3 hover:bg-brand-soft" aria-label="ログアウト">
            <LogOut className="size-5" aria-hidden />
            <span className="hidden lg:inline">ログアウト</span>
          </button>
        </nav>
      </div>
      <nav className="mt-6 hidden flex-col gap-1 px-4 xl:flex" aria-label="メニュー">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex h-11 items-center gap-2.5 rounded-full px-4 text-sm font-bold text-ink-2 hover:bg-brand-soft',
                active && 'bg-brand text-ink shadow-[0_4px_12px_rgba(251,175,0,0.25)] hover:bg-brand',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="size-4.5" aria-hidden />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="mt-auto hidden border-t border-line px-6 py-5 xl:block">
        <p className="truncate text-sm font-bold text-ink">{userName}</p>
        <p className="text-xs text-ink-3">{role === 'owner' ? 'オーナー' : 'スタッフ'}</p>
        <button type="button" onClick={logout} className="-ml-3 mt-3 inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-ink-2 hover:bg-brand-soft">
          <LogOut className="size-4" aria-hidden />
          ログアウト
        </button>
      </div>
    </aside>
  )
}
