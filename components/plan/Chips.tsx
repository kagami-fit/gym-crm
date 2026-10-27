import { Badge } from '@/components/ui'
import { phaseSub } from '@/lib/labels'
import { MOVEMENT_STATUS, type MovementStatus } from '@/lib/movements'
import { cn } from '@/lib/utils'

// 指導計画で使う小さな印（色だけにせず、必ず文字も出す）

/** 動作の達成状況（未評価・練習中・達成） */
export function MovementChip({ status, className }: { status: MovementStatus | null | undefined; className?: string }) {
  const s = status ?? 'untested'
  return (
    <Badge tone={MOVEMENT_STATUS[s].tone} className={className}>
      {MOVEMENT_STATUS[s].label}
    </Badge>
  )
}

/** フェーズの印（色の点＋名前。説明名もつけられる） */
export function PhaseChip({ name, color, withSub, big, className }: { name: string; color: string; withSub?: boolean; big?: boolean; className?: string }) {
  const sub = withSub ? phaseSub(name) : ''
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full font-black text-ink', big ? 'px-3 py-1 text-base' : 'px-2.5 py-0.5 text-sm', className)} style={{ background: `${color}24` }}>
      <span className={cn('flex-none rounded-full', big ? 'size-3' : 'size-2.5')} style={{ background: color }} aria-hidden />
      {name}
      {sub && <span className="font-bold text-ink-2">（{sub}）</span>}
    </span>
  )
}
