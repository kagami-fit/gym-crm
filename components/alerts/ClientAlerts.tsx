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

/** お客様のお知らせ・宿題のパネル（宿題の確認・出す、お知らせの対応・自分で作る・止めたものの再開） */
function ClientAlertsSheet({ board, homework, base, clientId, clientName, open, onClose }: Props & { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={`${clientName} さんのお知らせ・宿題`}>
      <div className="space-y-5">
        {homework && (
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-black">
              <ClipboardList className="size-4" aria-hidden />
              宿題（前回までに出したもの）
            </h3>
            <HomeworkPanel clientId={clientId} board={homework} base={base} />
          </section>
        )}
        <section className="space-y-2">
          <h3 className="text-sm font-black">対応が必要</h3>
          <AlertList items={board.open} showClient={false} empty="いま対応が必要なお知らせはありません" />
        </section>
        {board.nextVisit.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-black">次の来店時に知らせる</h3>
            <AlertList items={board.nextVisit} mode="nextVisit" showClient={false} />
          </section>
        )}
        {board.upcoming.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-black">予定（日付がまだ先）</h3>
            <AlertList items={board.upcoming} mode="upcoming" showClient={false} />
          </section>
        )}
        {board.snoozed.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-black">あとでにしたもの</h3>
            <AlertList items={board.snoozed} mode="snoozed" showClient={false} />
          </section>
        )}
        <section className="rounded-2xl border border-line bg-white p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-black">
            <Plus className="size-4" aria-hidden />
            お知らせを作る
          </h3>
          <ReminderForm clientId={clientId} />
        </section>
        {board.muted.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-black">止めているお知らせ</h3>
            <MutedList items={board.muted} />
          </section>
        )}
      </div>
    </Sheet>
  )
}

/**
 * トレーニングの帯の「お知らせ」の行。そのお客様の対応が必要なお知らせ・次の来店時のお知らせを並べ、
 * 押すとパネルが開く（ないときも「作る」から自分でお知らせを作れる）。
 */
export function ClientAlerts(props: Props) {
  const { board, homework } = props
  const [open, setOpen] = useState(false)
  const items = [...board.open, ...board.nextVisit]
  const hw = homework?.open ?? []
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="inline-flex flex-none items-center gap-0.5 rounded bg-dark px-1.5 text-[11px] font-bold leading-5 text-white">
        <Bell className="size-3" aria-hidden />
        お知らせ・宿題
      </span>
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
        {items.length === 0 && hw.length === 0 && <span className="text-sm text-ink-3">いまはありません</span>}
        {hw.map((h) => (
          <button key={h.id} type="button" onClick={() => setOpen(true)} className="inline-flex h-7 max-w-[20rem] flex-none items-center gap-1 rounded-full bg-white px-2.5 text-xs font-bold text-ink ring-1 ring-dark/40" title={`宿題：${h.text}`}>
            <ClipboardList className="size-3.5 flex-none" aria-hidden />
            <span className="truncate">宿題：{h.text}</span>
          </button>
        ))}
        {items.map((a) => {
          const { icon: Icon, chip } = LEVEL_STYLE[a.level]
          const next = board.nextVisit.includes(a)
          return (
            <button key={a.key} type="button" onClick={() => setOpen(true)} className={cn('inline-flex h-7 max-w-[22rem] flex-none items-center gap-1 rounded-full px-2.5 text-xs font-bold', chip)} title={a.detail ?? a.title}>
              <Icon className="size-3.5 flex-none" aria-hidden />
              <span className="truncate">{next ? `次の来店：${a.title}` : a.title}</span>
            </button>
          )
        })}
      </div>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-8 flex-none items-center gap-0.5 rounded-full px-2.5 text-xs font-bold text-ink-2 ring-1 ring-line-2 hover:bg-soft">
        {items.length || hw.length ? (
          <>
            すべて・作る
            <ChevronRight className="size-3.5" aria-hidden />
          </>
        ) : (
          <>
            <Plus className="size-3.5" aria-hidden />
            作る
          </>
        )}
      </button>
      <ClientAlertsSheet {...props} open={open} onClose={() => setOpen(false)} />
    </div>
  )
}

/** 手書きメモの画面の道具の並びに置く「お知らせ」ボタン（件数・一番重い段階の色） */
export function ClientAlertsButton({ className, ...props }: Props & { className?: string }) {
  const { board, homework } = props
  const [open, setOpen] = useState(false)
  const now = [...board.open, ...board.nextVisit, ...(homework?.open ?? [])]
  const level = topLevel(board.open)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn(className, board.open.length > 0 && level && LEVEL_STYLE[level].chip)}>
        <Bell className="size-4 flex-none" aria-hidden />
        お知らせ
        {now.length > 0 && <span className="num rounded-full bg-dark/10 px-1.5 text-xs">{now.length}</span>}
      </button>
      <ClientAlertsSheet {...props} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
