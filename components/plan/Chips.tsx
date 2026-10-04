import { Badge } from '@/components/ui'
import { CONDITION_LEVELS, type ConditionLevel } from '@/lib/condition'
import { ANS_LEVELS, phaseSub, type AnsLevel } from '@/lib/labels'
import { MOVEMENT_STATUS, type MovementStatus } from '@/lib/movements'
import { cn } from '@/lib/utils'

// 指導計画で使う小さな印（色だけにせず、必ず文字も出す）

/** 活性度の棒とグレーゾーンとの位置（空＝未確認） */
export function AnsLevelChip({ level, className }: { level: AnsLevel | null | undefined; className?: string }) {
  if (!level) return <Badge tone="muted" className={className}>未確認</Badge>
  return (
    <Badge tone={ANS_LEVELS[level].tone} className={className}>
      {ANS_LEVELS[level].label}
    </Badge>
  )
}

/** 動作の達成状況（未評価・練習中・達成） */
export function MovementChip({ status, className }: { status: MovementStatus | null | undefined; className?: string }) {
  const s = status ?? 'untested'
  return (
    <Badge tone={MOVEMENT_STATUS[s].tone} className={className}>
      {MOVEMENT_STATUS[s].label}
    </Badge>
  )
}

/** 体調チェックの段階（なし・少し・強い。答えていなければ —） */
export function ConditionChip({ level, className }: { level: ConditionLevel | null | undefined; className?: string }) {
  if (!level) return <Badge tone="muted" className={className}>—</Badge>
  const tone = level === 'none' ? 'ok' : level === 'mild' ? 'brand' : 'warn'
  return (
    <Badge tone={tone} className={className}>
      {CONDITION_LEVELS[level].label}
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
