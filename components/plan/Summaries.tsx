import { Badge } from '@/components/ui'
import { md } from '@/lib/dates'
import type { HistoryItem } from '@/lib/plan'

// 概要・指導計画に出す「まとめ」の表示（入力はしない）
// 自律神経の最新の評価・体調の経過・動作の達成状況のまとめは、2026-10 にいったん画面から外した（git の履歴に残っている）

/** フェーズ・食事方針の変更の履歴 */
export function ChangeHistory({ items }: { items: HistoryItem[] }) {
  if (!items.length) return <p className="rounded-xl border border-dashed border-line-2 bg-soft px-4 py-5 text-center text-sm text-ink-2">まだフェーズ・食事方針の記録がありません</p>
  return (
    <ul className="divide-y divide-line">
      {items.map((h, i) => (
        <li key={`${h.kind}-${h.date}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 first:pt-0 last:pb-0">
          <span className="num w-24 flex-none text-sm font-semibold text-ink-2">{md(h.date)}</span>
          <Badge tone={h.kind === 'phase' ? 'dark' : 'neutral'}>{h.kind === 'phase' ? 'フェーズ' : '食事方針'}</Badge>
          <span className="font-bold">{h.title}</span>
          {h.note && <span className="w-full pl-0 text-sm text-ink-2 sm:pl-[6.75rem]">{h.note}</span>}
        </li>
      ))}
    </ul>
  )
}

