import { Bell, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { Level } from '@/lib/alerts/rules'
import { cn } from '@/lib/utils'

/** お知らせの段階の見た目（色だけで区別しないよう、必ず名前とアイコンも出す） */
export const LEVEL_STYLE: Record<Level, { label: string; icon: LucideIcon; badge: string; bar: string; chip: string; dot: string }> = {
  info: { label: '気づき', icon: Bell, badge: 'bg-brand-soft text-brand-ink ring-1 ring-brand-deep/60', bar: 'border-l-brand-deep', chip: 'bg-brand-soft text-ink ring-1 ring-brand-deep/60', dot: 'bg-brand-deep text-ink' },
  warn: { label: '要対応', icon: TriangleAlert, badge: 'bg-warn-soft text-warn ring-1 ring-warn/30', bar: 'border-l-warn', chip: 'bg-warn-soft text-warn ring-1 ring-warn/30', dot: 'bg-warn text-white' },
  alert: { label: '相談', icon: OctagonAlert, badge: 'bg-danger-soft text-danger ring-1 ring-danger/30', bar: 'border-l-danger', chip: 'bg-danger-soft text-danger ring-1 ring-danger/30', dot: 'bg-danger text-white' },
}

export function LevelBadge({ level, className }: { level: Level; className?: string }) {
  const { label, icon: Icon, badge } = LEVEL_STYLE[level]
  return (
    <span className={cn('inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold', badge, className)}>
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  )
}
