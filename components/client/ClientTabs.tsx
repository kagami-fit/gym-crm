'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '', label: '概要' },
  { href: '/body', label: '体重・目標' },
  { href: '/training', label: 'トレーニング' },
  { href: '/talk', label: '会話メモ' },
  { href: '/meals', label: '食事メモ' },
  { href: '/profile', label: '台帳' },
  { href: '/questionnaire', label: '問診票' },
]

export function ClientTabs({ clientId }: { clientId: string }) {
  const pathname = usePathname()
  const params = useSearchParams()
  const date = params.get('date')
  const base = `/clients/${clientId}`
  const section = pathname.slice(base.length)
  return (
    <nav className="-mb-px flex min-w-0 flex-1 gap-1 overflow-x-auto" aria-label="顧客ページ">
      {TABS.map((t) => {
        const active = t.href === '' ? section === '' : section.startsWith(t.href)
        return (
          <Link
            key={t.label}
            href={`${base}${t.href}${date ? `?date=${date}` : ''}`}
            className={cn(
              'flex min-h-12 flex-none items-center border-b-[3px] px-4 text-[15px] font-bold text-ink-3 hover:text-ink',
              active ? 'border-brand text-ink' : 'border-transparent',
            )}
            aria-current={active ? 'page' : undefined}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
