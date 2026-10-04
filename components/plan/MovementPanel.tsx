'use client'

import { useState } from 'react'
import { Check, ChevronDown, ClipboardCheck, Loader2, Trash2 } from 'lucide-react'
import { deleteMovementCheckAction, saveMovementCheckAction } from '@/app/(app)/clients/[id]/plan/actions'
import { Field, buttonClass, inputClass } from '@/components/ui'
import type { MovementCheckRow } from '@/lib/data/plan'
import { diffDays, md, type Ymd } from '@/lib/dates'
import { MOVEMENTS, MOVEMENT_STATUS, sidesStatus, type Movement, type MovementStatus } from '@/lib/movements'
import { cn } from '@/lib/utils'
import { MovementChip } from './Chips'

const STATUS_KEYS = Object.keys(MOVEMENT_STATUS) as MovementStatus[]
const sideLabel = { left: '左', right: '右' } as const

/** 確認項目の答えを1行に（左右・かかとの接地など） */
function checksText(m: Movement, r: MovementCheckRow): string {
  const parts: string[] = []
  if (m.sides) for (const side of ['left', 'right'] as const) if (r.checks[side]) parts.push(`${sideLabel[side]} ${MOVEMENT_STATUS[r.checks[side] as MovementStatus]?.label ?? '—'}`)
  for (const f of m.fields) if (r.checks[f.key]) parts.push(`${f.label.replace(/（.*?）/g, '')}：${r.checks[f.key]}`)
  return parts.join('・')
}

/** 押して選ぶボタン（もう一度押すと外れる） */
function Choice({ options, value, onChange, label }: { options: Array<{ value: string; label: string }>; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(value === o.value ? '' : o.value)} aria-pressed={value === o.value} className={cn('h-11 rounded-full px-4 text-sm font-bold ring-1', value === o.value ? 'bg-dark text-white ring-dark' : 'bg-white text-ink-2 ring-line-2 hover:bg-soft')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

const statusOptions = STATUS_KEYS.map((k) => ({ value: k, label: MOVEMENT_STATUS[k].label }))

/**
 * 動作の評価（ピラティスの達成状況）。6つの動きごとに「未評価・練習中・達成」と確認項目を記録する。
 * 評価のたびに1件ふえるので、前の段階へ戻ったことも残る。目安の期間は参考として出すだけで、「遅れ」とは判定しない。
 * 全部達成しないと移行できない、という判定もしない（必須条件は正式な指導基準に合わせて決める）。
 */
export function MovementPanel({ clientId, base, rows }: { clientId: string; base: Ymd; rows: MovementCheckRow[] }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [history, setHistory] = useState<string | null>(null)
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const list = rows.filter((r) => !removed.has(r.id) && r.date <= base)

  async function remove(r: MovementCheckRow) {
    if (!confirm(`${md(r.date)}の評価を削除しますか？`)) return
    setRemoved((s) => new Set(s).add(r.id))
    const res = await deleteMovementCheckAction(clientId, r.id)
    if (!res.ok)
      setRemoved((s) => {
        const n = new Set(s)
        n.delete(r.id)
        return n
      })
  }

  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-white">
      {MOVEMENTS.map((m) => {
        const mine = list.filter((r) => r.movement === m.key)
        const latest = mine.at(-1)
        const practiceFrom = mine.find((r) => r.status !== 'untested')?.date
        const detail = latest ? checksText(m, latest) : ''
        return (
          <li key={m.key} className="px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <div className="min-w-[12rem] flex-1">
                <p className="text-[15px] font-black">{m.label}</p>
                <p className="text-xs text-ink-3">確認に使う種目：{m.exercises}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {latest && <span className="num text-xs text-ink-3">{md(latest.date)}</span>}
                <MovementChip status={latest?.status} className="text-sm" />
                <button type="button" onClick={() => setEditing(editing === m.key ? null : m.key)} className={buttonClass.small} aria-expanded={editing === m.key}>
                  <ClipboardCheck className="size-4" aria-hidden />
                  評価を記録
                </button>
              </div>
            </div>
            {(detail || latest?.condition || latest?.note || m.guide || practiceFrom) && (
              <div className="mt-1.5 space-y-0.5 text-sm text-ink-2">
                {detail && <p>{detail}</p>}
                {latest?.condition && <p>実施条件：{latest.condition}</p>}
                {latest?.note && <p>メモ：{latest.note}</p>}
                <p className="text-xs text-ink-3">
                  {practiceFrom && latest?.status !== 'achieved' && `練習を始めて${Math.max(1, Math.round(diffDays(practiceFrom, base) / 7))}週。`}
                  {m.guide && `目安（会議）：${m.guide}`}
                </p>
              </div>
            )}
            {editing === m.key && <CheckForm clientId={clientId} base={base} m={m} latest={latest} onDone={() => setEditing(null)} />}
            {mine.length > 0 && (
              <div className="mt-1.5">
                <button type="button" onClick={() => setHistory(history === m.key ? null : m.key)} className="inline-flex min-h-9 items-center gap-1 text-sm font-bold text-ink-2" aria-expanded={history === m.key}>
                  これまでの評価 {mine.length}件
                  <ChevronDown className={cn('size-4 transition', history === m.key && 'rotate-180')} aria-hidden />
                </button>
                {history === m.key && (
                  <ul className="mt-1 divide-y divide-line rounded-lg bg-soft">
                    {[...mine].reverse().map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-1.5 text-sm">
                        <span className="num w-12 flex-none text-ink-2">{md(r.date)}</span>
                        <MovementChip status={r.status} />
                        <span className="min-w-0 flex-1 text-ink-2">{[checksText(m, r), r.condition ? `条件：${r.condition}` : '', r.note ?? ''].filter(Boolean).join('／')}</span>
                        <button type="button" onClick={() => void remove(r)} className={cn(buttonClass.danger, 'h-9 min-w-9')} aria-label={`${md(r.date)}の評価を削除`}>
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function CheckForm({ clientId, base, m, latest, onDone }: { clientId: string; base: Ymd; m: Movement; latest?: MovementCheckRow; onDone: () => void }) {
  const [date, setDate] = useState(base)
  const [status, setStatus] = useState<string>(latest?.status ?? '')
  const [checks, setChecks] = useState<Record<string, string>>(m.sides ? { left: latest?.checks.left ?? '', right: latest?.checks.right ?? '' } : {})
  const [condition, setCondition] = useState(latest?.condition ?? '')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setCheck = (k: string, v: string) => setChecks((c) => ({ ...c, [k]: v }))
  const overall = m.sides && checks.left && checks.right ? sidesStatus(checks.left as MovementStatus, checks.right as MovementStatus) : null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    const r = await saveMovementCheckAction(clientId, { date, movement: m.key, status, checks, condition, note })
    setPending(false)
    if (!r.ok) return setError(r.message)
    onDone()
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-xl border border-line bg-soft p-4">
      <div className="grid gap-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
        <Field label="評価日" required>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
        </Field>
        {m.sides ? (
          <div className="space-y-2">
            {(['left', 'right'] as const).map((side) => (
              <div key={side}>
                <span className="text-sm font-bold">{sideLabel[side]}</span>
                <div className="mt-1">
                  <Choice options={statusOptions} value={checks[side] ?? ''} onChange={(v) => setCheck(side, v)} label={`${sideLabel[side]}の達成状況`} />
                </div>
              </div>
            ))}
            {overall && <p className="text-xs text-ink-3">全体：{MOVEMENT_STATUS[overall].label}（左右とも達成で「達成」）</p>}
          </div>
        ) : (
          <div>
            <span className="text-sm font-bold">達成状況</span>
            <div className="mt-1.5">
              <Choice options={statusOptions} value={status} onChange={setStatus} label="達成状況" />
            </div>
          </div>
        )}
      </div>
      {m.fields.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {m.fields.map((f) =>
            f.type === 'choice' ? (
              <div key={f.key}>
                <span className="text-sm font-bold">{f.label}</span>
                <div className="mt-1.5">
                  <Choice options={f.options.map((o) => ({ value: o, label: o }))} value={checks[f.key] ?? ''} onChange={(v) => setCheck(f.key, v)} label={f.label} />
                </div>
              </div>
            ) : (
              <Field key={f.key} label={f.label}>
                <input value={checks[f.key] ?? ''} onChange={(e) => setCheck(f.key, e.target.value)} maxLength={100} placeholder={f.placeholder} className={inputClass} />
              </Field>
            ),
          )}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="実施条件" hint="正式な名前・条件が分からないものは、聞いたまま書く">
          <input value={condition} onChange={(e) => setCondition(e.target.value)} maxLength={100} placeholder="例：補助あり・5回" className={inputClass} />
        </Field>
        <Field label="メモ">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="例：戻るときに腰が反りやすい" className={inputClass} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
          評価を保存
        </button>
        <button type="button" onClick={onDone} className={buttonClass.ghost}>
          やめる
        </button>
        {error && (
          <p role="alert" className="w-full text-sm font-bold text-danger">
            {error}
          </p>
        )}
      </div>
    </form>
  )
}
