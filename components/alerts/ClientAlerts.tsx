'use client'

import { useState } from 'react'
import { Bell, Check, ChevronDown, ChevronRight, ClipboardCheck, ClipboardList, Minus, Plus, X } from 'lucide-react'
import { checkHomeworkAction } from '@/app/(app)/clients/[id]/plan/actions'
import { Sheet } from '@/components/Sheet'
import { HomeworkPanel } from '@/components/client/HomeworkPanel'
import type { AlertBoard, AlertItem } from '@/lib/data/alerts'
import type { HomeworkBoard } from '@/lib/data/homework'
import { md, type Ymd } from '@/lib/dates'
import { LEVELS, type Level } from '@/lib/alerts/rules'
import { cn } from '@/lib/utils'
import { AlertList, MutedList } from './AlertList'
import { LEVEL_STYLE } from './Level'
import { ReminderForm } from './ReminderForm'

const topLevel = (items: AlertItem[]): Level | null =>
  items.reduce<Level | null>((top, a) => (!top || LEVELS[a.level].rank > LEVELS[top].rank ? a.level : top), null)

type Props = { board: AlertBoard; homework?: HomeworkBoard; base: Ymd; clientId: string; clientName: string }
type Tab = 'homework' | 'alerts'

/** 開いたときのタブ：確認待ちの宿題があれば宿題、なければお知らせ */
const defaultTab = ({ homework }: Props): Tab => (homework?.open.length ? 'homework' : 'alerts')

/** お客様のお知らせ・宿題のパネル。「宿題」と「お知らせ」をタブで切り替える */
function ClientAlertsSheet({ board, homework, base, clientId, clientName, open, tab, onTab, onClose }: Props & { open: boolean; tab: Tab; onTab: (t: Tab) => void; onClose: () => void }) {
  const alertCount = board.open.length + board.nextVisit.length
  const hwCount = homework?.open.length ?? 0
  const current = homework ? tab : 'alerts'
  return (
    <Sheet open={open} onClose={onClose} title={`${clientName} さんのお知らせ・宿題`}>
      {homework && (
        <div role="tablist" aria-label="表示の切り替え" className="sticky -top-3 z-10 -mx-3 -mt-3 mb-4 bg-page px-3 pb-2 pt-3 sm:-top-4 sm:-mx-4 sm:-mt-4 sm:px-4 sm:pt-4">
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-soft p-1 ring-1 ring-line">
            <TabButton active={current === 'homework'} onClick={() => onTab('homework')} icon={ClipboardList} label="宿題" count={hwCount} />
            <TabButton active={current === 'alerts'} onClick={() => onTab('alerts')} icon={Bell} label="お知らせ" count={alertCount} />
          </div>
        </div>
      )}
      {current === 'homework' && homework ? (
        <HomeworkPanel clientId={clientId} board={homework} base={base} />
      ) : (
        <div className="space-y-5">
          <section className="space-y-2">
            <h3 className="text-base font-black">対応が必要</h3>
            <AlertList items={board.open} showClient={false} empty="いま対応が必要なお知らせはありません" />
          </section>
          {board.nextVisit.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-base font-black">次の来店時に知らせる</h3>
              <AlertList items={board.nextVisit} mode="nextVisit" showClient={false} />
            </section>
          )}
          {board.upcoming.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-base font-black">予定（日付がまだ先）</h3>
              <AlertList items={board.upcoming} mode="upcoming" showClient={false} />
            </section>
          )}
          {board.snoozed.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-base font-black">あとでにしたもの</h3>
              <AlertList items={board.snoozed} mode="snoozed" showClient={false} />
            </section>
          )}
          <section className="rounded-2xl border border-line bg-white p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-base font-black">
              <Plus className="size-4" aria-hidden />
              お知らせを作る
            </h3>
            <ReminderForm clientId={clientId} />
          </section>
          {board.muted.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-base font-black">止めているお知らせ</h3>
              <MutedList items={board.muted} />
            </section>
          )}
        </div>
      )}
    </Sheet>
  )
}

function TabButton({ active, onClick, icon: Icon, label, count }: { active: boolean; onClick: () => void; icon: typeof Bell; label: string; count: number }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} className={cn('flex h-12 items-center justify-center gap-2 rounded-xl text-base font-black transition', active ? 'bg-white text-ink shadow-[0_2px_8px_rgba(80,60,0,0.12)]' : 'text-ink-3 hover:text-ink')}>
      <Icon className="size-5" aria-hidden />
      {label}
      {count > 0 && <span className={cn('num min-w-6 rounded-full px-1.5 text-sm leading-6', active ? 'bg-dark text-white' : 'bg-dark/10 text-ink-2')}>{count}</span>}
    </button>
  )
}

const RESULTS = [
  { status: 'done', label: 'できた', icon: Check, cls: 'bg-ok-soft text-ok ring-ok/35' },
  { status: 'partial', label: '一部', icon: Minus, cls: 'bg-warn-soft text-warn ring-warn/35' },
  { status: 'not_done', label: 'できなかった', icon: X, cls: 'bg-danger-soft text-danger ring-danger/35' },
] as const
/** 帯に出す行の数（それより多いときは「ほか N件」からパネルで見る） */
const MAX_ROWS = 5

/**
 * トレーニングの帯の「今日の確認」（2026-10 はやとさんの選んだ B＋C 案）。
 * 宿題とお知らせを1本のリストにまとめ、種類はラベル（文字と色）で分ける。
 * 宿題の行は、その場で「できた・一部・できなかった」を押して結果をつけられる。お知らせの行は押すとパネルで開く（対応した・あとで など）。
 */
export function ClientAlerts(props: Props) {
  const { board, homework, base, clientId } = props
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('homework')
  const [folded, setFolded] = useState(false)
  const [marked, setMarked] = useState<Record<string, { status: string; text: string }>>({})
  const [error, setError] = useState<string | null>(null)
  const show = (t: Tab) => {
    setTab(t)
    setOpen(true)
  }
  const alerts = [...board.open, ...board.nextVisit]
  const hwOpen = homework?.open ?? []
  const toCheck = hwOpen.filter((h) => h.assignedOn < base)
  const today = hwOpen.filter((h) => h.assignedOn >= base)
  const count = toCheck.length + alerts.length
  // 結果をつけた宿題は一覧から消えるので、つけたことを短く残す
  const recorded = Object.entries(marked).filter(([id]) => !toCheck.some((h) => h.id === id))
  const resultLabel = (status: string) => RESULTS.find((x) => x.status === status)?.label

  async function mark(id: string, text: string, status: (typeof RESULTS)[number]['status']) {
    setError(null)
    setMarked((m) => ({ ...m, [id]: { status, text } }))
    const r = await checkHomeworkAction(clientId, id, status, { on: base })
    if (!r.ok) {
      setError(r.message)
      setMarked((m) => {
        const n = { ...m }
        delete n[id]
        return n
      })
    }
  }

  type Item = { key: string; node: React.ReactNode }
  const rows: Item[] = [
    ...toCheck.map((h) => ({
      key: `hw-${h.id}`,
      node: (
        <>
          <span className="w-24 flex-none whitespace-nowrap rounded-md bg-ok-soft px-2 py-0.5 text-center text-xs font-black text-ok">宿題</span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{h.text}</span>
            <span className="num block text-xs text-ink-3">{md(h.assignedOn)} に出した・結果をつける</span>
          </span>
          {marked[h.id] ? (
            <span className="flex-none text-sm font-bold text-ok">
              <Check className="mr-1 inline size-4 align-[-3px]" aria-hidden />
              {resultLabel(marked[h.id].status)}で記録しました
            </span>
          ) : (
            <span className="flex flex-none flex-wrap gap-1.5" role="group" aria-label={`宿題「${h.text}」の結果`}>
              {RESULTS.map(({ status, label, icon: Icon, cls }) => (
                <button key={status} type="button" onClick={() => void mark(h.id, h.text, status)} className={cn('inline-flex h-10 items-center gap-1 rounded-full px-3 text-sm font-bold ring-1', cls)}>
                  <Icon className="size-4" aria-hidden />
                  {label}
                </button>
              ))}
            </span>
          )}
        </>
      ),
    })),
    ...alerts.map((a) => {
      const { icon: Icon, label, badge } = LEVEL_STYLE[a.level]
      const next = board.nextVisit.includes(a)
      return {
        key: a.key,
        node: (
          <>
            <span className={cn('inline-flex w-24 flex-none items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-black', badge)}>
              <Icon className="size-3.5" aria-hidden />
              {next ? '次の来店' : label}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{a.title}</span>
              {a.detail && <span className="block truncate text-xs text-ink-3">{a.detail}</span>}
            </span>
            <button type="button" onClick={() => show('alerts')} className="inline-flex h-10 flex-none items-center gap-0.5 rounded-full bg-dark px-3.5 text-sm font-bold text-white hover:bg-dark-2">
              開く
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </>
        ),
      }
    }),
  ]
  const shown = rows.slice(0, MAX_ROWS)

  return (
    <div className="overflow-hidden rounded-2xl border border-line-2 bg-white">
      <div className="flex flex-wrap items-center gap-2 bg-soft px-3 py-2">
        <ClipboardCheck className="size-5 flex-none" aria-hidden />
        <span className="text-base font-black">今日の確認</span>
        <span className="num rounded-full bg-dark px-2 text-sm font-bold leading-6 text-white">{count}</span>
        {today.length > 0 && <span className="text-xs text-ink-3">今日出した宿題 {today.length}件</span>}
        <span className="ml-auto flex items-center gap-1.5">
          {count > 0 && (
            <button type="button" onClick={() => setFolded((v) => !v)} aria-expanded={!folded} className="inline-flex h-9 items-center gap-0.5 rounded-full px-2.5 text-sm font-bold text-ink-2 hover:bg-white">
              {folded ? 'ひらく' : 'たたむ'}
              <ChevronDown className={cn('size-4 transition', !folded && 'rotate-180')} aria-hidden />
            </button>
          )}
          <button type="button" onClick={() => show(defaultTab(props))} className="inline-flex h-9 items-center gap-1 rounded-full bg-white px-3 text-sm font-bold text-ink-2 ring-1 ring-line-2 hover:bg-brand-soft">
            <Plus className="size-4" aria-hidden />
            宿題・お知らせを作る
          </button>
        </span>
      </div>
      {recorded.length > 0 && (
        <p role="status" className="border-b border-line bg-ok-soft/60 px-3 py-1.5 text-sm font-bold text-ok">
          <Check className="mr-1 inline size-4 align-[-3px]" aria-hidden />
          {recorded.map(([, m]) => `「${m.text}」を${resultLabel(m.status)}で記録しました`).join('　')}
        </p>
      )}
      {!folded &&
        (count === 0 ? (
          <p className="px-3 py-2.5 text-[15px] text-ink-3">今日確認することはありません</p>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((r) => (
              <li key={r.key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 text-[15px]">
                {r.node}
              </li>
            ))}
            {rows.length > MAX_ROWS && (
              <li>
                <button type="button" onClick={() => show(defaultTab(props))} className="w-full px-3 py-2 text-left text-sm font-bold text-brand-ink hover:bg-soft">
                  ほか {rows.length - MAX_ROWS}件を見る
                </button>
              </li>
            )}
          </ul>
        ))}
      {error && (
        <p role="alert" className="px-3 pb-2 text-sm font-bold text-danger">
          {error}
        </p>
      )}
      <ClientAlertsSheet {...props} open={open} tab={tab} onTab={setTab} onClose={() => setOpen(false)} />
    </div>
  )
}

/** 手書きメモの画面の道具の並びに置く「お知らせ」ボタン（件数・一番重い段階の色） */
export function ClientAlertsButton({ className, ...props }: Props & { className?: string }) {
  const { board, homework } = props
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('homework')
  const now = [...board.open, ...board.nextVisit, ...(homework?.open ?? [])]
  const level = topLevel(board.open)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setTab(defaultTab(props))
          setOpen(true)
        }}
        className={cn(className, board.open.length > 0 && level && LEVEL_STYLE[level].chip)}
      >
        <Bell className="size-4 flex-none" aria-hidden />
        お知らせ
        {now.length > 0 && <span className="num rounded-full bg-dark/10 px-1.5 text-xs">{now.length}</span>}
      </button>
      <ClientAlertsSheet {...props} open={open} tab={tab} onTab={setTab} onClose={() => setOpen(false)} />
    </>
  )
}
