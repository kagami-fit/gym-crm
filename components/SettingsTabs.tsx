'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/settings', label: '計算式・減量ペース' },
  { href: '/settings/exercises', label: '種目マスタ' },
  { href: '/settings/staff', label: 'スタッフ' },
]

export function SettingsTabs() {
  const pathname = usePathname()
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line" aria-label="設定">
      {TABS.map((t) => {
        const active = pathname === t.href
        return (
          <Link key={t.href} href={t.href} className={cn('flex-none border-b-[3px] px-4 py-3 text-sm font-bold text-ink-3 hover:text-ink', active ? 'border-brand text-ink' : 'border-transparent')} aria-current={active ? 'page' : undefined}>
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
