'use client'

import { useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { addHomeworkAction, checkHomeworkAction, deleteHomeworkAction } from '@/app/(app)/clients/[id]/steps/actions'
import { Badge, buttonClass, inputClass } from '@/components/ui'
import type { HomeworkBoard, HomeworkRow } from '@/lib/data/homework'
import { md, type Ymd } from '@/lib/dates'
import { HOMEWORK_STATUS } from '@/lib/labels'
import { cn } from '@/lib/utils'

const RESULTS = [
  { status: 'done', label: 'できた', cls: 'text-ok ring-ok/40 hover:bg-ok-soft active:bg-ok-soft' },
  { status: 'partial', label: '一部', cls: 'text-warn ring-warn/40 hover:bg-warn-soft active:bg-warn-soft' },
  { status: 'not_done', label: 'できなかった', cls: 'text-danger ring-danger/40 hover:bg-danger-soft active:bg-danger-soft' },
] as const

/**
 * 宿題（Todo）。出した宿題を次の来店で「できた／一部／できなかった」で確認する。
 * 「次回も」にチェックすると、同じ宿題をもう一度出す。
 */
export function HomeworkPanel({ clientId, board, base }: { clientId: string; board: HomeworkBoard; base: Ymd }) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())

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

  const open = board.open.filter((h) => !checked.has(h.id))
  const rate = board.stats.total ? Math.round((board.stats.done / board.stats.total) * 100) : null

  return (
    <div className="space-y-3">
      {open.length ? (
        <ul className="space-y-2">
          {open.map((h) => (
            <OpenItem
              key={h.id}
              clientId={clientId}
              h={h}
              base={base}
              onChecked={() => setChecked((s) => new Set(s).add(h.id))}
              onFail={() =>
                setChecked((s) => {
                  const n = new Set(s)
                  n.delete(h.id)
                  return n
                })
              }
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line-2 bg-white/60 px-4 py-4 text-center text-sm text-ink-2">確認する宿題はありません</p>
      )}

      <form onSubmit={add} className="flex flex-wrap items-center gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="例：寝る前ストレッチ5分（週5日）" aria-label="宿題の内容" className={cn(inputClass, 'h-11 min-w-0 flex-1')} />
        <button type="submit" disabled={pending || !text.trim()} className={buttonClass.primary}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          宿題を出す
        </button>
        {error && <p className="w-full text-sm font-bold text-danger">{error}</p>}
      </form>

      {board.history.length > 0 && (
        <div>
          <p className="mb-1.5 flex flex-wrap items-center gap-2 text-sm font-black">
            これまでの宿題
            {rate != null && (
              <span className="text-xs font-bold text-ink-2">
                できた {board.stats.done}／{board.stats.total}件（<span className="num">{rate}%</span>）
              </span>
            )}
          </p>
          <ul className="divide-y divide-line rounded-xl border border-line bg-white">
            {board.history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-2 text-sm">
                <Badge tone={HOMEWORK_STATUS[h.status].tone}>{HOMEWORK_STATUS[h.status].label}</Badge>
                <span className="min-w-0 flex-1">{h.text}</span>
                <span className="num text-xs text-ink-3">
                  {md(h.assignedOn)}→{h.checkedOn ? md(h.checkedOn) : '—'}
                </span>
                {h.note && <span className="w-full text-xs text-ink-2">「{h.note}」</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function OpenItem({ clientId, h, base, onChecked, onFail }: { clientId: string; h: HomeworkRow; base: Ymd; onChecked: () => void; onFail: () => void }) {
  const [again, setAgain] = useState(false)
  const [busy, setBusy] = useState(false)
  async function check(status: string) {
    setBusy(true)
    onChecked()
    const r = await checkHomeworkAction(clientId, h.id, status, { again, on: base })
    setBusy(false)
    if (!r.ok) onFail()
  }
  async function remove() {
    if (!confirm(`宿題「${h.text}」を削除しますか？`)) return
    onChecked()
    const r = await deleteHomeworkAction(clientId, h.id)
    if (!r.ok) onFail()
  }
  return (
    <li className="rounded-xl border border-l-4 border-line border-l-dark bg-white px-3 py-2.5">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-[15px] font-bold leading-snug">{h.text}</p>
        <span className="num flex-none text-xs text-ink-3">{md(h.assignedOn)}に出した</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {RESULTS.map((r) => (
          <button key={r.status} type="button" disabled={busy} onClick={() => void check(r.status)} className={cn('inline-flex h-10 items-center rounded-full bg-white px-3.5 text-sm font-bold ring-1', r.cls)}>
            {r.label}
          </button>
        ))}
        <label className="ml-1 inline-flex items-center gap-1.5 text-sm text-ink-2">
          <input type="checkbox" checked={again} onChange={(e) => setAgain(e.target.checked)} className="size-4 accent-[var(--color-dark)]" />
          次回も出す
        </label>
        <button type="button" onClick={() => void remove()} className="ml-auto inline-flex h-10 min-w-10 items-center justify-center rounded-full text-danger hover:bg-danger-soft" aria-label="削除">
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
    </li>
  )
}
