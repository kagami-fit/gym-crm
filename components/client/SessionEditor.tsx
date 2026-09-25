'use client'

import { useActionState, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, Copy, Minus, NotebookPen, Plus, Trash2, X } from 'lucide-react'
import { Field, buttonClass, inputClass } from '@/components/ui'
import { FormMessage, SubmitButton, type ActionState } from '@/components/SubmitButton'
import { estimate1RM } from '@/lib/calc/training'
import type { OneRmMethod } from '@/lib/calc/settings'
import { mdw } from '@/lib/dates'
import { int, num } from '@/lib/format'
import { cn } from '@/lib/utils'

type SetRow = { bodyPart: string; exercise: string; weightKg: number; reps: number; sets: number; note?: string | null }
type Row = { key: string; bodyPart: string; exercise: string; custom: boolean; weightKg: string; reps: string; sets: string; note: string }
type HistorySession = { id: string; date: string; rows: SetRow[] }

const CUSTOM = '__custom__'
let seq = 0
const newKey = () => `r${Date.now().toString(36)}${(seq++).toString(36)}`

function toRow(r: SetRow, known: Set<string>): Row {
  return {
    key: newKey(),
    bodyPart: r.bodyPart,
    exercise: r.exercise,
    custom: !known.has(`${r.bodyPart}::${r.exercise}`),
    weightKg: String(r.weightKg),
    reps: String(r.reps),
    sets: String(r.sets),
    note: r.note ?? '',
  }
}

const n = (v: string) => {
  const x = Number(v.replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)))
  return v.trim() === '' || !Number.isFinite(x) ? null : x
}
const clean = (v: number) => String(Math.round(v * 100) / 100)

/** −／＋ で増減できる数値入力（iPad でキーボードを出さずに入力できる） */
function Stepper({ label, unit, value, onChange, step, inputMode }: { label: string; unit?: string; value: string; onChange: (v: string) => void; step: number; inputMode: 'decimal' | 'numeric' }) {
  const bump = (d: number) => onChange(clean(Math.max(0, (n(value) ?? 0) + d)))
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-bold text-ink-3">{label}</p>
      <div className="flex h-11 items-stretch overflow-hidden rounded-xl border border-line-2 bg-white focus-within:border-brand-deep focus-within:ring-2 focus-within:ring-brand-soft">
        <button type="button" onClick={() => bump(-step)} className="grid w-11 flex-none place-items-center text-ink-2 active:bg-brand-soft" aria-label={`${label}を${step}減らす`}>
          <Minus className="size-4" aria-hidden />
        </button>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode={inputMode}
          className="num w-full min-w-0 flex-1 border-x border-line bg-transparent text-center text-base font-semibold outline-none"
          aria-label={label}
        />
        {unit && <span className="self-center px-1.5 text-xs font-bold text-ink-3">{unit}</span>}
        <button type="button" onClick={() => bump(step)} className="grid w-11 flex-none place-items-center text-ink-2 active:bg-brand-soft" aria-label={`${label}を${step}増やす`}>
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}

export function SessionEditor({
  action,
  deleteAction,
  sessionId,
  initial,
  bodyParts,
  exercises,
  history,
  method,
  cancelHref,
  memoHref,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>
  deleteAction?: () => Promise<void>
  sessionId: string | null
  initial: { date: string; memo: string; rows: SetRow[] }
  bodyParts: string[]
  exercises: Array<{ bodyPart: string; name: string }>
  history: HistorySession[]
  method: OneRmMethod
  cancelHref: string
  memoHref?: string | null
}) {
  const known = useMemo(() => new Set(exercises.map((e) => `${e.bodyPart}::${e.name}`)), [exercises])
  const [state, formAction] = useActionState(action, null)
  const [date, setDate] = useState(initial.date)
  const [memo, setMemo] = useState(initial.memo)
  const [rows, setRows] = useState<Row[]>(() =>
    initial.rows.length ? initial.rows.map((r) => toRow(r, known)) : [{ key: newKey(), bodyPart: bodyParts[0] ?? '', exercise: '', custom: false, weightKg: '', reps: '', sets: '3', note: '' }],
  )

  const before = useMemo(() => history.filter((s) => s.date < date && s.id !== sessionId && s.rows.length > 0).sort((a, b) => (a.date < b.date ? -1 : 1)), [history, date, sessionId])
  const lastByExercise = useMemo(() => {
    const m = new Map<string, { date: string; r: SetRow }>()
    for (const s of before) for (const r of s.rows) m.set(r.exercise, { date: s.date, r })
    return m
  }, [before])
  const previousSession = before.at(-1)

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const remove = (key: string) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs))
  const move = (key: string, d: -1 | 1) =>
    setRows((rs) => {
      const i = rs.findIndex((r) => r.key === key)
      const j = i + d
      if (i < 0 || j < 0 || j >= rs.length) return rs
      const next = [...rs]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  const add = () => setRows((rs) => [...rs, { key: newKey(), bodyPart: rs.at(-1)?.bodyPart ?? bodyParts[0] ?? '', exercise: '', custom: false, weightKg: '', reps: '', sets: rs.at(-1)?.sets || '3', note: '' }])
  const loadPrevious = () => {
    if (!previousSession) return
    const blank = rows.every((r) => !r.exercise && !r.weightKg && !r.reps)
    if (!blank && !confirm(`${mdw(previousSession.date)}の内容で置き換えますか？（いま入力している内容は消えます）`)) return
    setRows(previousSession.rows.map((r) => toRow(r, known)))
  }

  const totals = rows.reduce(
    (a, r) => {
      const w = n(r.weightKg), rp = n(r.reps), st = n(r.sets)
      if (w != null && rp != null && st != null) a.volume += w * rp * st
      if (st != null) a.sets += st
      return a
    },
    { volume: 0, sets: 0 },
  )

  const payload = JSON.stringify({
    date,
    memo: memo.trim() || null,
    rows: rows
      .filter((r) => r.exercise.trim() || r.weightKg || r.reps)
      .map((r) => ({ bodyPart: r.bodyPart, exercise: r.exercise.trim(), weightKg: n(r.weightKg) ?? NaN, reps: n(r.reps) ?? NaN, sets: n(r.sets) ?? NaN, note: r.note.trim() || null })),
  })

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="payload" value={payload} />
      <div className="grid gap-4 md:grid-cols-[13rem_1fr]">
        <Field label="日付（来店日）">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
        </Field>
        <Field label="メモ（文字）">
          <input value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={1000} className={inputClass} placeholder="例：右膝に違和感あり、スクワットは浅めに" />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={loadPrevious} disabled={!previousSession} className={buttonClass.secondary}>
          <Copy className="size-4" aria-hidden />
          {previousSession ? `前回（${mdw(previousSession.date)}）の内容を読み込む` : '前回の記録はありません'}
        </button>
        {memoHref && (
          <Link href={memoHref} className={buttonClass.secondary}>
            <NotebookPen className="size-4" aria-hidden />
            この回の手書きメモ
          </Link>
        )}
      </div>

      <div className="space-y-2.5">
        {rows.map((r, i) => {
          const w = n(r.weightKg), rp = n(r.reps), st = n(r.sets)
          const vol = w != null && rp != null && st != null ? w * rp * st : null
          const rm = w != null && rp != null ? estimate1RM(method, w, rp) : null
          const options = exercises.filter((e) => e.bodyPart === r.bodyPart)
          const last = r.exercise ? lastByExercise.get(r.exercise) : undefined
          return (
            <div key={r.key} className="rounded-2xl border border-line bg-soft p-3">
              <div className="flex items-center gap-2">
                <span className="num grid size-8 flex-none place-items-center rounded-full bg-white text-sm font-semibold text-ink-2 ring-1 ring-line">{i + 1}</span>
                <select
                  value={r.bodyPart}
                  onChange={(e) => update(r.key, { bodyPart: e.target.value, exercise: '', custom: false })}
                  className={cn(inputClass, 'w-28 flex-none')}
                  aria-label={`${i + 1}行目の部位`}
                >
                  {[...bodyParts, ...(bodyParts.includes(r.bodyPart) || !r.bodyPart ? [] : [r.bodyPart])].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <div className="min-w-0 flex-1">
                  {r.custom ? (
                    <div className="flex gap-1">
                      <input value={r.exercise} onChange={(e) => update(r.key, { exercise: e.target.value })} maxLength={60} className={inputClass} placeholder="種目名を入力" aria-label={`${i + 1}行目の種目`} />
                      <button type="button" onClick={() => update(r.key, { custom: false, exercise: '' })} className={buttonClass.ghost} aria-label="一覧から選ぶ">
                        <X className="size-4" aria-hidden />
                      </button>
                    </div>
                  ) : (
                    <select
                      value={r.exercise}
                      onChange={(e) => (e.target.value === CUSTOM ? update(r.key, { custom: true, exercise: '' }) : update(r.key, { exercise: e.target.value }))}
                      className={inputClass}
                      aria-label={`${i + 1}行目の種目`}
                    >
                      <option value="">種目を選ぶ</option>
                      {options.map((o) => (
                        <option key={o.name} value={o.name}>
                          {o.name}
                        </option>
                      ))}
                      <option value={CUSTOM}>その他（自由入力）</option>
                    </select>
                  )}
                </div>
                <div className="flex flex-none">
                  <button type="button" onClick={() => move(r.key, -1)} disabled={i === 0} className={buttonClass.ghost} aria-label="上へ">
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                  <button type="button" onClick={() => move(r.key, 1)} disabled={i === rows.length - 1} className={buttonClass.ghost} aria-label="下へ">
                    <ArrowDown className="size-4" aria-hidden />
                  </button>
                  <button type="button" onClick={() => remove(r.key)} disabled={rows.length === 1} className={buttonClass.danger} aria-label="この行を削除">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-3 gap-2 md:grid-cols-[1fr_1fr_1fr_9rem]">
                <Stepper label="重さ" unit="kg" value={r.weightKg} onChange={(v) => update(r.key, { weightKg: v })} step={(n(r.weightKg) ?? 0) >= 20 ? 2.5 : 1} inputMode="decimal" />
                <Stepper label="回数" unit="回" value={r.reps} onChange={(v) => update(r.key, { reps: v })} step={1} inputMode="numeric" />
                <Stepper label="セット" value={r.sets} onChange={(v) => update(r.key, { sets: v })} step={1} inputMode="numeric" />
                <div className="col-span-3 flex items-end justify-between gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-line md:col-span-1 md:flex-col md:items-stretch md:justify-center md:gap-0.5">
                  <p className="text-xs text-ink-3">
                    総負荷量 <span className="num ml-1 text-base font-semibold text-ink">{vol != null ? int(vol) : '—'}</span>
                  </p>
                  <p className="text-xs text-ink-3">
                    推定1RM <span className="num ml-1 font-semibold text-ink-2">{rm != null && w ? `${num(rm)}kg` : '—'}</span>
                  </p>
                </div>
              </div>

              {last && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-3">
                  <span>
                    前回 <span className="num">{mdw(last.date)}</span>：
                    <span className="num font-semibold text-ink-2">
                      {last.r.weightKg === 0 ? '自重' : `${num(last.r.weightKg, last.r.weightKg % 1 === 0 ? 0 : 1)}kg`} × {last.r.reps}回 × {last.r.sets}セット
                    </span>
                  </span>
                  <button type="button" onClick={() => update(r.key, { weightKg: String(last.r.weightKg), reps: String(last.r.reps), sets: String(last.r.sets) })} className={buttonClass.small}>
                    前回と同じ
                  </button>
                </div>
              )}
            </div>
          )
        })}
        <button type="button" onClick={add} className={cn(buttonClass.secondary, 'w-full md:w-auto')}>
          <Plus className="size-4" aria-hidden />
          種目を追加
        </button>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <p className="text-sm text-ink-2">
          合計 <span className="num font-semibold text-ink">{totals.sets}</span> セット ／ 総負荷量 <span className="num font-semibold text-ink">{int(totals.volume)}</span> kg
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <FormMessage state={state} />
          <Link href={cancelHref} className={buttonClass.secondary}>
            やめる
          </Link>
          <SubmitButton pendingText="保存しています">{sessionId ? '変更を保存' : 'この内容で記録'}</SubmitButton>
        </div>
      </div>
      {deleteAction && (
        <div className="text-right">
          <button
            type="submit"
            formAction={deleteAction}
            formNoValidate
            onClick={(e) => {
              if (!confirm('このトレーニング記録を削除しますか？（手書きメモも消えます）')) e.preventDefault()
            }}
            className={buttonClass.danger}
          >
            <Trash2 className="size-4" aria-hidden />
            この記録を削除
          </button>
        </div>
      )}
    </form>
  )
}
