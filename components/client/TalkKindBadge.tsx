import { CloudRain, HeartPulse, MessageCircle, Sparkles, ThumbsUp, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui'
import { talkKindOf, type TalkKind } from '@/lib/labels'

/** 会話メモの種類ごとのアイコンと色（色だけで区別しないよう、必ず名前も出す） */
export const TALK_KIND_STYLE: Record<TalkKind, { icon: LucideIcon; tone: 'neutral' | 'brand' | 'ok' | 'danger' | 'warn'; chipOn: string }> = {
  talk: { icon: MessageCircle, tone: 'neutral', chipOn: 'bg-dark text-white' },
  change: { icon: Sparkles, tone: 'brand', chipOn: 'bg-brand text-ink' },
  good: { icon: ThumbsUp, tone: 'ok', chipOn: 'bg-ok text-white' },
  negative: { icon: CloudRain, tone: 'danger', chipOn: 'bg-danger text-white' },
  body: { icon: HeartPulse, tone: 'warn', chipOn: 'bg-warn text-white' },
}

export function TalkKindBadge({ kind, className }: { kind: TalkKind; className?: string }) {
  const { icon: Icon, tone } = TALK_KIND_STYLE[kind]
  return (
    <Badge tone={tone} className={className}>
      <Icon className="size-3.5" aria-hidden />
      {talkKindOf(kind).label}
    </Badge>
  )
}
