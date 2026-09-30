'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'
import type { Level } from '@/lib/alerts/rules'
import { cn } from '@/lib/utils'
import { LEVEL_STYLE } from './Level'

/** メニューの「お知らせ」（対応が必要な件数。色は一番重い段階） */
export function NavBell({ count, level, variant = 'top' }: { count: number | null; level: Level | null; variant?: 'top' | 'side' }) {
  const pathname = usePathname()
  const active = pathname === '/alerts'
  const badge = count ? (
    <span className={cn('num inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-black leading-5', level ? LEVEL_STYLE[level].dot : 'bg-dark text-white')}>{count}</span>
  ) : null
  if (variant === 'side')
    return (
      <Link
        href="/alerts"
        className={cn('flex h-11 items-center gap-2.5 rounded-full px-4 text-sm font-bold text-ink-2 hover:bg-brand-soft', active && 'bg-brand text-ink shadow-[0_4px_12px_rgba(251,175,0,0.25)] hover:bg-brand')}
        aria-current={active ? 'page' : undefined}
      >
        <Bell className="size-4.5" aria-hidden />
        お知らせ
        {badge && <span className="ml-auto">{badge}</span>}
      </Link>
    )
  return (
    <Link
      href="/alerts"
      className={cn('relative flex h-11 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-bold text-ink-2 hover:bg-brand-soft sm:px-3.5', active && 'bg-brand text-ink hover:bg-brand')}
      aria-current={active ? 'page' : undefined}
      aria-label={count ? `お知らせ ${count}件` : 'お知らせ'}
    >
      <Bell className="size-5" aria-hidden />
      <span className="hidden sm:inline">お知らせ</span>
      {badge}
    </Link>
  )
}
