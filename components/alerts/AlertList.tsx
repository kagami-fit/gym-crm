'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BellOff, Check, Clock3, Loader2, RotateCcw, Trash2, UserRound } from 'lucide-react'
import { alertDoneAction, alertMuteAction, alertSnoozeAction, deleteReminderAction, reminderDoneAction, reminderSnoozeAction } from '@/app/(app)/alerts/actions'
import { buttonClass, inputClass } from '@/components/ui'
import type { AlertItem } from '@/lib/data/alerts'
import { md, mdw } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { LEVEL_STYLE, LevelBadge } from './Level'

type Mode = 'open' | 'nextVisit' | 'upcoming' | 'snoozed'

const SNOOZE = [
  { days: 3, label: '3日後' },
  { days: 7, label: '1週間後' },
  { days: 14, label: '2週間後' },
]

/**
 * お知らせの一覧（1件ずつ「対応した」「あとで」「止める」を押せる）。
 * 押したらすぐ一覧から消し、裏で保存して画面を読み直す（ベルの件数も変わる）。
 */
export function AlertList({ items, mode = 'open', showClient = true, empty }: { items: AlertItem[]; mode?: Mode; showClient?: boolean; empty?: string }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const visible = items.filter((a) => !hidden.has(a.key))
  const hide = (key: string) => setHidden((s) => new Set(s).add(key))
  const unhide = (key: string) =>
    setHidden((s) => {
      const n = new Set(s)
      n.delete(key)
      return n
    })
  if (!visible.length) return empty ? <p className="rounded-xl border border-dashed border-line-2 bg-white/60 px-4 py-5 text-center text-sm text-ink-2">{empty}</p> : null
  return (
    <ul className="space-y-2">
      {visible.map((a) => (
        <AlertRow key={a.key} a={a} mode={mode} showClient={showClient} onHide={() => hide(a.key)} onFail={() => unhide(a.key)} />
      ))}
    </ul>
  )
}

function AlertRow({ a, mode, showClient, onHide, onFail }: { a: AlertItem; mode: Mode; showClient: boolean; onHide: () => void; onFail: () => void }) {
  const [panel, setPanel] = useState<'none' | 'done' | 'snooze'>('none')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setPending(true)
    setError(null)
    onHide()
    const r = await fn()
    setPending(false)
    if (!r.ok) {
      onFail()
      setError(r.message ?? '保存できませんでした')
    }
  }

  const done = () =>
    run(() => (a.source === 'auto' ? alertDoneAction({ clientId: a.clientId, rule: a.rule!, fingerprint: a.fingerprint!, note }) : reminderDoneAction(a.reminderId!, note)))
  const snooze = (days: number) =>
    run(() => (a.source === 'auto' ? alertSnoozeAction({ clientId: a.clientId, rule: a.rule!, fingerprint: a.fingerprint!, days }) : reminderSnoozeAction(a.reminderId!, days)))
  const mute = () => {
    if (!confirm(`${a.clientName}さんでは「${a.title}」の種類のお知らせを止めますか？（お知らせの画面から再開できます）`)) return
    void run(() => alertMuteAction({ clientId: a.clientId, rule: a.rule!, mute: true }))
  }
  const remove = () => {
    if (!confirm('このお知らせを削除しますか？')) return
    void run(() => deleteReminderAction(a.reminderId!))
  }

  const small = 'inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold'
  const when =
    mode === 'snoozed' && a.snoozeUntil
      ? `${md(a.snoozeUntil)}にまた出す`
      : a.source === 'manual'
        ? a.trigger === 'next_visit'
          ? '次の来店時'
          : a.date
            ? `${mdw(a.date)}`
            : ''
        : a.date
          ? `${md(a.date)}から`
          : ''

  return (
    <li className={cn('rounded-xl border border-l-4 border-line bg-white px-3 py-2.5', LEVEL_STYLE[a.level].bar)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <LevelBadge level={a.level} />
        {showClient && (
          <Link href={a.href} className="text-sm font-black text-ink underline-offset-2 hover:underline">
            {a.clientName} さん
          </Link>
        )}
        {showClient && a.trainerName && <span className="text-xs text-ink-3">担当 {a.trainerName}</span>}
        {a.source === 'manual' && (
          <span className="inline-flex items-center gap-1 text-xs text-ink-3">
            <UserRound className="size-3.5" aria-hidden />
            {a.createdByName ? `${a.createdByName}が作成` : '手動'}
          </span>
        )}
        {when && <span className="num ml-auto text-xs font-bold text-ink-3">{when}</span>}
      </div>
      <p className="mt-1 text-[15px] font-bold leading-snug">{a.title}</p>
      {a.detail && <p className="mt-0.5 text-sm text-ink-2">{a.detail}</p>}

      {panel === 'done' ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="ひとこと（任意）例：食事の設定を-100kcalに変更" aria-label="対応のメモ" className={cn(inputClass, 'h-10 min-h-10 min-w-0 flex-1 py-1')} autoFocus />
          <button type="button" onClick={() => void done()} disabled={pending} className={cn(buttonClass.primary, 'h-10')}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            対応した
          </button>
          <button type="button" onClick={() => setPanel('none')} className={cn(small, 'text-ink-3 hover:bg-soft')}>
            やめる
          </button>
        </div>
      ) : panel === 'snooze' ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-ink-2">いつまた出す？</span>
          {SNOOZE.map((s) => (
            <button key={s.days} type="button" onClick={() => void snooze(s.days)} className={cn(small, 'bg-white ring-1 ring-line-2 hover:bg-soft')}>
              {s.label}
            </button>
          ))}
          <button type="button" onClick={() => setPanel('none')} className={cn(small, 'text-ink-3 hover:bg-soft')}>
            やめる
          </button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {mode === 'snoozed' ? (
            <button type="button" onClick={() => void snooze(0)} className={cn(small, 'bg-white ring-1 ring-line-2 hover:bg-soft')}>
              <RotateCcw className="size-4" aria-hidden />
              今すぐ戻す
            </button>
          ) : mode !== 'upcoming' ? (
            <>
              <button type="button" onClick={() => setPanel('done')} className={cn(small, 'bg-dark text-white hover:bg-dark-2')}>
                <Check className="size-4" aria-hidden />
                対応した
              </button>
              <button type="button" onClick={() => setPanel('snooze')} className={cn(small, 'bg-white ring-1 ring-line-2 hover:bg-soft')}>
                <Clock3 className="size-4" aria-hidden />
                あとで
              </button>
            </>
          ) : null}
          <Link href={a.href} className={cn(small, 'text-ink-2 hover:bg-brand-soft')}>
            開く
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          {a.source === 'auto' ? (
            mode !== 'snoozed' && (
              <button type="button" onClick={mute} className={cn(small, 'ml-auto text-ink-3 hover:bg-soft')}>
                <BellOff className="size-4" aria-hidden />
                このお客様では止める
              </button>
            )
          ) : (
            <button type="button" onClick={remove} className={cn(small, 'ml-auto text-danger hover:bg-danger-soft')} aria-label="削除">
              <Trash2 className="size-4" aria-hidden />
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-1 text-sm font-bold text-danger">
          {error}
        </p>
      )}
    </li>
  )
}

/** 止めているお知らせ（再開できる） */
export function MutedList({ items }: { items: Array<{ clientId: string; clientName: string; rule: string; label: string }> }) {
  const [gone, setGone] = useState<Set<string>>(new Set())
  const rows = items.filter((m) => !gone.has(`${m.clientId}:${m.rule}`))
  if (!rows.length) return null
  return (
    <ul className="space-y-1.5">
      {rows.map((m) => (
        <li key={`${m.clientId}:${m.rule}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm">
          <BellOff className="size-4 text-ink-3" aria-hidden />
          <span className="font-bold">{m.clientName} さん</span>
          <span className="text-ink-2">{m.label}</span>
          <button
            type="button"
            onClick={async () => {
              setGone((s) => new Set(s).add(`${m.clientId}:${m.rule}`))
              await alertMuteAction({ clientId: m.clientId, rule: m.rule, mute: false })
            }}
            className="ml-auto inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-bold text-ink-2 ring-1 ring-line-2 hover:bg-soft"
          >
            <RotateCcw className="size-4" aria-hidden />
            再開
          </button>
        </li>
      ))}
    </ul>
  )
}
