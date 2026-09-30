'use client'

import { useState } from 'react'
import { Bell, ChevronRight, ClipboardList, Plus } from 'lucide-react'
import { Sheet } from '@/components/Sheet'
import { HomeworkPanel } from '@/components/client/HomeworkPanel'
import type { AlertBoard, AlertItem } from '@/lib/data/alerts'
import type { HomeworkBoard } from '@/lib/data/homework'
import type { Ymd } from '@/lib/dates'
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

/**
 * トレーニングの帯の「お知らせ・宿題」の行。確認待ちの宿題と、対応が必要なお知らせ・次の来店時のお知らせを並べる。
 * 宿題を押すと宿題のタブ、お知らせを押すとお知らせのタブでパネルが開く（ないときも「作る」から宿題・お知らせを作れる）。
 */
export function ClientAlerts(props: Props) {
  const { board, homework } = props
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('homework')
  const show = (t: Tab) => {
    setTab(t)
    setOpen(true)
  }
  const items = [...board.open, ...board.nextVisit]
  const hw = homework?.open ?? []
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="inline-flex flex-none items-center gap-1 rounded bg-dark px-2 text-[13px] font-bold leading-6 text-white">
        <Bell className="size-3.5" aria-hidden />
        お知らせ・宿題
      </span>
      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
        {items.length === 0 && hw.length === 0 && <span className="text-[15px] text-ink-3">いまはありません</span>}
        {hw.map((h) => (
          <button key={h.id} type="button" onClick={() => show('homework')} className="inline-flex h-9 max-w-[22rem] flex-none items-center gap-1.5 rounded-full bg-white px-3 text-sm font-bold text-ink ring-1 ring-dark/40" title={`宿題：${h.text}`}>
            <ClipboardList className="size-4 flex-none" aria-hidden />
            <span className="truncate">宿題：{h.text}</span>
          </button>
        ))}
        {items.map((a) => {
          const { icon: Icon, chip } = LEVEL_STYLE[a.level]
          const next = board.nextVisit.includes(a)
          return (
            <button key={a.key} type="button" onClick={() => show('alerts')} className={cn('inline-flex h-9 max-w-[24rem] flex-none items-center gap-1.5 rounded-full px-3 text-sm font-bold', chip)} title={a.detail ?? a.title}>
              <Icon className="size-4 flex-none" aria-hidden />
              <span className="truncate">{next ? `次の来店：${a.title}` : a.title}</span>
            </button>
          )
        })}
      </div>
      <button type="button" onClick={() => show(defaultTab(props))} className="inline-flex h-9 flex-none items-center gap-0.5 rounded-full px-3 text-sm font-bold text-ink-2 ring-1 ring-line-2 hover:bg-soft">
        {items.length || hw.length ? (
          <>
            すべて・作る
            <ChevronRight className="size-4" aria-hidden />
          </>
        ) : (
          <>
            <Plus className="size-4" aria-hidden />
            作る
          </>
        )}
      </button>
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
