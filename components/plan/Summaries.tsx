import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui'
import { CONDITION_ITEMS, conditionTrend } from '@/lib/condition'
import type { AnsRow } from '@/lib/data/ans'
import type { ConditionRow, MovementCheckRow } from '@/lib/data/plan'
import { md, type Ymd } from '@/lib/dates'
import { num, signed } from '@/lib/format'
import { ANS_LEVELS, ANS_TYPES } from '@/lib/labels'
import { MOVEMENTS } from '@/lib/movements'
import { ansChanges, ansShort, ansState, type HistoryItem } from '@/lib/plan'
import { cn } from '@/lib/utils'
import { AnsLevelChip, ConditionChip, MovementChip } from './Chips'

// 概要・指導計画に出す「まとめ」の表示（入力はしない）

const STATE_STYLE = { good: 'bg-ok-soft text-ok', out: 'bg-warn-soft text-warn', unknown: 'bg-soft text-ink-2' } as const

/** 最新の自律神経の評価と、前回との比較（数値の増減と位置の変化） */
export function AnsLatest({ latest, previous, emptyHref }: { latest: AnsRow | null; previous: AnsRow | null; emptyHref?: string }) {
  if (!latest) {
    return (
      <p className="rounded-xl border border-dashed border-line-2 bg-soft px-4 py-5 text-center text-sm text-ink-2">
        まだ測定結果がありません
        {emptyHref && (
          <Link href={emptyHref} className="ml-2 font-bold text-brand-ink underline underline-offset-2">
            測定結果を入れる
          </Link>
        )}
      </p>
    )
  }
  const st = ansState(latest)
  const changes = ansChanges(previous, latest)
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-2">
        最新 <span className="num font-bold text-ink">{md(latest.measuredOn)}</span>
        {previous && (
          <>
            {' '}・前回 <span className="num font-bold text-ink">{md(previous.measuredOn)}</span>
          </>
        )}
        <a href={`/api/ans/${latest.id}`} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 font-bold text-brand-ink underline-offset-2 hover:underline">
          <ExternalLink className="size-3.5" aria-hidden />
          測定票
        </a>
      </p>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {changes.map((c) => (
          <li key={c.label} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5">
            <span className="w-24 flex-none text-sm font-bold">{c.label}</span>
            <span className="num text-xl font-semibold">{c.to != null ? num(c.to, 2) : '—'}</span>
            <AnsLevelChip level={c.toLevel} />
            {previous && (
              <span className="ml-auto text-xs text-ink-3">
                前回 <span className="num">{c.from != null ? num(c.from, 2) : '—'}</span>
                {c.delta != null && <span className="num">（{signed(c.delta, 2)}）</span>}・{c.fromLevel ? ANS_LEVELS[c.fromLevel].label : '未確認'} → {c.toLevel ? ANS_LEVELS[c.toLevel].label : '未確認'}
                {!c.moved && c.fromLevel && <span>（変わらず）</span>}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className={cn('rounded-lg px-3 py-2 text-sm font-bold', STATE_STYLE[st.state])}>
        評価：{st.text}
        {latest.ansType && <span className="ml-2 font-normal">型 {latest.ansType}（{ANS_TYPES[latest.ansType].replace('（仮）', '')}・仮）</span>}
      </p>
      {latest.note && <p className="text-sm text-ink-2">メモ：{latest.note}</p>}
    </div>
  )
}

/** その日までで一番新しい測定 */
const ansOn = (ans: AnsRow[], day: Ymd) => ans.find((a) => a.measuredOn <= day) ?? null

/** 体調の経過：初回（本人の最初の訴え）と最新を並べ、その時点の測定結果とも比べる */
export function ConditionSummary({ rows, ans, bodyNotes = [], emptyHref }: { rows: ConditionRow[]; ans: AnsRow[]; bodyNotes?: Array<{ id: string; date: Ymd; text: string }>; emptyHref?: string }) {
  if (!rows.length) {
    return (
      <div className="space-y-3">
        <p className="rounded-xl border border-dashed border-line-2 bg-soft px-4 py-5 text-center text-sm text-ink-2">
          まだ体調チェックがありません
          {emptyHref && (
            <Link href={emptyHref} className="ml-2 font-bold text-brand-ink underline underline-offset-2">
              体調チェックを入れる
            </Link>
          )}
        </p>
        <BodyNotes notes={bodyNotes} />
      </div>
    )
  }
  const first = rows[0]
  const latest = rows[rows.length - 1]
  const same = first.id === latest.id
  const a1 = ansOn(ans, first.date)
  const a2 = ansOn(ans, latest.date)
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="bg-tint text-left text-xs text-ink-2">
            <tr>
              <th className="px-3 py-2 font-bold">項目</th>
              <th className="px-3 py-2 font-bold">
                初回 <span className="num">{md(first.date)}</span>
              </th>
              {!same && (
                <th className="px-3 py-2 font-bold">
                  最新 <span className="num">{md(latest.date)}</span>
                </th>
              )}
              {!same && <th className="px-3 py-2 font-bold">変化</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {CONDITION_ITEMS.map((it) => {
              const t = conditionTrend(first.items[it.key], latest.items[it.key])
              return (
                <tr key={it.key}>
                  <td className="px-3 py-2 font-bold">
                    {it.label}
                    {it.key === 'pain' && (latest.painArea || first.painArea) && <span className="ml-1 text-xs font-normal text-ink-3">（{latest.painArea ?? first.painArea}）</span>}
                  </td>
                  <td className="px-3 py-2">
                    <ConditionChip level={first.items[it.key]} />
                  </td>
                  {!same && (
                    <td className="px-3 py-2">
                      <ConditionChip level={latest.items[it.key]} />
                    </td>
                  )}
                  {!same && <td className="px-3 py-2 text-xs text-ink-2">{t === 'better' ? 'よくなった' : t === 'worse' ? '強くなった' : t === 'same' ? '変わらない' : '—'}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-3">
        測定：{a1 ? `${md(a1.measuredOn)} ${ansShort(a1)}` : '初回の時点の測定なし'}
        {!same && <> → {a2 ? `${md(a2.measuredOn)} ${ansShort(a2)}` : '最新の時点の測定なし'}</>}
      </p>
      {latest.note && <p className="text-sm text-ink-2">メモ（{md(latest.date)}）：{latest.note}</p>}
      <BodyNotes notes={bodyNotes} />
    </div>
  )
}

function BodyNotes({ notes }: { notes: Array<{ id: string; date: Ymd; text: string }> }) {
  if (!notes.length) return null
  return (
    <div>
      <p className="mb-1 text-xs font-bold text-ink-3">会話メモ（身体の変化）</p>
      <ul className="space-y-1">
        {notes.map((n) => (
          <li key={n.id} className="flex gap-2 text-sm">
            <span className="num w-12 flex-none text-ink-3">{md(n.date)}</span>
            <span className="line-clamp-2 min-w-0 text-ink-2">{n.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 動作の達成状況（6つの動きの最新） */
export function MovementSummary({ latest }: { latest: Record<string, MovementCheckRow | undefined> }) {
  return (
    <div className="space-y-2">
      <ul className="grid gap-x-6 gap-y-0 sm:grid-cols-2">
        {MOVEMENTS.map((m) => {
          const r = latest[m.key]
          const sides = m.sides && r ? `左 ${r.checks.left ? movementLabel(r.checks.left) : '—'}・右 ${r.checks.right ? movementLabel(r.checks.right) : '—'}` : null
          return (
            <li key={m.key} className="flex items-center justify-between gap-2 border-b border-line py-2">
              <span className="min-w-0">
                <span className="block text-[15px] font-bold">{m.label}</span>
                {sides && <span className="block text-xs text-ink-3">{sides}</span>}
              </span>
              <span className="flex flex-none items-center gap-1.5">
                {r && <span className="num text-xs text-ink-3">{md(r.date)}</span>}
                <MovementChip status={r?.status} />
              </span>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-ink-3">目安（会議）：ロングスパインは長くて4週間程度・屈曲は1〜2ヶ月程度。届かなくても「遅れ」とはしません</p>
    </div>
  )
}

const movementLabel = (s: string) => (s === 'achieved' ? '達成' : s === 'practicing' ? '練習中' : '未評価')

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

