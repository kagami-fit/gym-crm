'use client'

import { useState } from 'react'
import { Check, Loader2, Minus, Plus, Trash2, X } from 'lucide-react'
import { addHomeworkAction, checkHomeworkAction, deleteHomeworkAction } from '@/app/(app)/clients/[id]/steps/actions'
import { buttonClass, inputClass } from '@/components/ui'
import type { HomeworkBoard, HomeworkRow } from '@/lib/data/homework'
import { diffDays, md, mdw, type Ymd } from '@/lib/dates'
import { HOMEWORK_STATUS, type HomeworkStatus } from '@/lib/labels'
import { cn } from '@/lib/utils'

/** 結果のボタンと、これまでの宿題の印（色だけでなく、アイコンと文字でも区別する） */
const RESULT_STYLE = {
  done: { icon: Check, cls: 'bg-ok-soft text-ok ring-ok/35' },
  partial: { icon: Minus, cls: 'bg-warn-soft text-warn ring-warn/35' },
  not_done: { icon: X, cls: 'bg-danger-soft text-danger ring-danger/35' },
} as const
const RESULTS = ['done', 'partial', 'not_done'] as const

const ago = (from: Ymd, base: Ymd) => {
  const d = diffDays(from, base)
  return d <= 0 ? '今日' : `${d}日前`
}

/**
 * 宿題（Todo）。
 * 1. 前回までに出した宿題：次の来店で「できた／一部できた／できなかった」をつける（「次回も同じ宿題を出す」で続ける）
 * 2. 新しい宿題を出す（前に出した宿題からも選べる）。今日出した宿題はここに並ぶ
 * 3. これまでの宿題と、できた率
 */
export function HomeworkPanel({ clientId, board, base }: { clientId: string; board: HomeworkBoard; base: Ymd }) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const hide = (id: string) => setHidden((s) => new Set(s).add(id))
  const unhide = (id: string) =>
    setHidden((s) => {
      const n = new Set(s)
      n.delete(id)
      return n
    })

  const open = board.open.filter((h) => !hidden.has(h.id))
  const toCheck = open.filter((h) => h.assignedOn < base)
  const today = open.filter((h) => h.assignedOn >= base)
  const openTexts = new Set(open.map((h) => h.text))
  const suggestions = [...new Set(board.history.map((h) => h.text))].filter((t) => !openTexts.has(t)).slice(0, 6)
  const { total, done, partial, notDone } = board.stats
  const rate = total ? Math.round((done / total) * 100) : null

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || pending) return
    setPending(true)
    setError(null)
    const r = await addHomeworkAction(clientId, { text, assignedOn: base })
    setPending(false)
    if (!r.ok) return setError(r.message)
    setText('')
  }

  async function remove(h: HomeworkRow) {
    if (!confirm(`宿題「${h.text}」を削除しますか？`)) return
    hide(h.id)
    const r = await deleteHomeworkAction(clientId, h.id)
    if (!r.ok) unhide(h.id)
  }

  return (
    <div className="space-y-6">
      <section>
        <h4 className="mb-2 text-base font-black">
          前回までに出した宿題
          <span className="ml-2 text-sm font-bold text-ink-2">結果をつけてください</span>
        </h4>
        {toCheck.length ? (
          <ul className="space-y-3">
            {toCheck.map((h) => (
              <CheckItem key={h.id} clientId={clientId} h={h} base={base} onHide={() => hide(h.id)} onFail={() => unhide(h.id)} onRemove={() => void remove(h)} />
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-line-2 bg-white/60 px-4 py-5 text-center text-[15px] text-ink-2">確認する宿題はありません</p>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white p-4">
        <h4 className="mb-2.5 text-base font-black">新しい宿題を出す</h4>
        <form onSubmit={add} className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="例：寝る前ストレッチ5分（週5日）" aria-label="宿題の内容" className={cn(inputClass, 'h-12 min-w-0 flex-1')} />
          <button type="submit" disabled={pending || !text.trim()} className={cn(buttonClass.primary, 'h-12 flex-none')}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            出す
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-2 text-sm font-bold text-danger">
            {error}
          </p>
        )}
        {suggestions.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-bold text-ink-3">前に出した宿題から選ぶ</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {suggestions.map((t) => (
                <button key={t} type="button" onClick={() => setText(t)} className="inline-flex min-h-9 items-center rounded-full bg-soft px-3 text-left text-sm font-bold text-ink-2 ring-1 ring-line hover:bg-brand-soft">
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
        {today.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-sm font-black">今日出した宿題（次の来店で結果をつける）</p>
            <ul className="mt-1.5 space-y-1.5">
              {today.map((h) => (
                <li key={h.id} className="flex items-center gap-2 rounded-xl bg-soft px-3 py-2">
                  <span className="min-w-0 flex-1 text-[15px] font-bold">{h.text}</span>
                  <button type="button" onClick={() => void remove(h)} className={cn(buttonClass.danger, 'h-9 min-w-9 px-2')} aria-label={`宿題「${h.text}」を削除`}>
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {board.history.length > 0 && (
        <section>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h4 className="text-base font-black">これまでの宿題</h4>
            {rate != null && (
              <p className="text-sm text-ink-2">
                できた率 <span className="num text-lg font-black text-ink">{rate}%</span>
                <span className="ml-1">
                  （{total}件中 できた{done}・一部{partial}・できなかった{notDone}）
                </span>
              </p>
            )}
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {board.history.map((h) => (
              <li key={h.id} className="flex items-start gap-3 px-4 py-3">
                <StatusMark status={h.status} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold leading-snug">{h.text}</p>
                  <p className="num mt-0.5 text-sm text-ink-3">
                    {md(h.assignedOn)}に出す → {h.checkedOn ? `${md(h.checkedOn)}に確認` : '確認なし'}
                  </p>
                  {h.note && <p className="mt-1.5 rounded-lg bg-soft px-3 py-1.5 text-sm text-ink-2">{h.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/** これまでの宿題の結果の印 */
function StatusMark({ status }: { status: HomeworkStatus }) {
  if (status === 'open') return null
  const { icon: Icon, cls } = RESULT_STYLE[status]
  return (
    <span className={cn('inline-flex h-7 w-[7.5rem] flex-none items-center justify-center gap-1 rounded-full text-sm font-bold', cls)}>
      <Icon className="size-4" aria-hidden />
      {HOMEWORK_STATUS[status].label}
    </span>
  )
}

/** 前回までに出した宿題1件：大きな結果ボタン3つ */
function CheckItem({ clientId, h, base, onHide, onFail, onRemove }: { clientId: string; h: HomeworkRow; base: Ymd; onHide: () => void; onFail: () => void; onRemove: () => void }) {
  const [again, setAgain] = useState(false)
  const [busy, setBusy] = useState(false)
  async function check(status: (typeof RESULTS)[number]) {
    setBusy(true)
    onHide()
    const r = await checkHomeworkAction(clientId, h.id, status, { again, on: base })
    setBusy(false)
    if (!r.ok) onFail()
  }
  return (
    <li className="rounded-2xl border border-line bg-white p-4 shadow-[0_2px_10px_rgba(80,60,0,0.05)]">
      <p className="text-lg font-black leading-snug">{h.text}</p>
      <p className="num mt-0.5 text-sm text-ink-2">
        {mdw(h.assignedOn)}に出した（{ago(h.assignedOn, base)}）
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {RESULTS.map((s) => {
          const { icon: Icon, cls } = RESULT_STYLE[s]
          return (
            <button key={s} type="button" disabled={busy} onClick={() => void check(s)} className={cn('flex h-12 items-center justify-center gap-1.5 rounded-xl text-[15px] font-black ring-1 transition hover:brightness-95 active:scale-[0.98] disabled:opacity-50', cls)}>
              <Icon className="size-5 flex-none" aria-hidden />
              {HOMEWORK_STATUS[s].label}
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <label className="inline-flex min-h-10 items-center gap-2 text-[15px] font-bold text-ink-2">
          <input type="checkbox" checked={again} onChange={(e) => setAgain(e.target.checked)} className="size-5 accent-[var(--color-dark)]" />
          次回も同じ宿題を出す
        </label>
        <button type="button" onClick={onRemove} className={cn(buttonClass.danger, 'h-10 px-3 text-sm')}>
          <Trash2 className="size-4" aria-hidden />
          削除
        </button>
      </div>
    </li>
  )
}
