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
import { purposeOptionsWith } from '@/lib/purposes'
import { EQUIPMENT, RATINGS, SPRING_QUICK, detailText, detailVolume, normalizeSprings, parseSprings, springColorHex, springsText, type Rating, type SetDetail } from '@/lib/log'
import { cn } from '@/lib/utils'

type SetRow = {
  bodyPart: string
  exercise: string
  weightKg: number
  reps: number
  sets: number
  note?: string | null
  purpose?: string | null
  equipment?: string | null
  springs?: string | null
  detail?: SetDetail[] | null
  rating?: string | null
}
/** セットごとの入力の1行（amount は回数か秒。unit で切り替え） */
type DetailRow = { key: string; w: string; amount: string; unit: 'r' | 's'; side: '' | 'R' | 'L' }
/**
 * autoPurpose：目的を自動で入れた・読み込んだ（種目を変えたら、新しい種目の目的に入れ替える）。この画面で自分で選んだ目的は種目を変えても残す。
 * mode：simple＝重さ×回数×セットでまとめて／detail＝セットごと（左右・秒・セットごとに違う重さ）
 */
type Row = {
  key: string
  bodyPart: string
  exercise: string
  custom: boolean
  weightKg: string
  reps: string
  sets: string
  note: string
  purpose: string
  autoPurpose: boolean
  equipment: string
  springs: string
  rating: string
  mode: 'simple' | 'detail'
  detail: DetailRow[]
  springPicker: boolean
}
type HistorySession = { id: string; date: string; rows: SetRow[] }

const CUSTOM = '__custom__'
const n = (v: string) => {
  const x = Number(v.replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)))
  return v.trim() === '' || !Number.isFinite(x) ? null : x
}
const clean = (v: number) => String(Math.round(v * 100) / 100)
let seq = 0
const newKey = () => `r${Date.now().toString(36)}${(seq++).toString(36)}`

const toDetailRows = (d: SetDetail[]): DetailRow[] =>
  d.map((x) => ({ key: newKey(), w: x.w ? String(x.w) : '', amount: x.r ? String(x.r) : x.s ? String(x.s) : '', unit: x.r ? 'r' : x.s ? 's' : 'r', side: x.side ?? '' }))

/** 前回の内容（セットごと・器具・バネ）をそのまま写す分 */
const logPart = (r: SetRow) => ({
  equipment: r.equipment ?? '',
  springs: r.springs ?? '',
  mode: (r.detail?.length ? 'detail' : 'simple') as Row['mode'],
  detail: r.detail?.length ? toDetailRows(r.detail) : [],
})

function blankRow(bodyPart: string, sets = '3'): Row {
  return { key: newKey(), bodyPart, exercise: '', custom: false, weightKg: '', reps: '', sets, note: '', purpose: '', autoPurpose: false, equipment: '', springs: '', rating: '', mode: 'simple', detail: [], springPicker: false }
}

function toRow(r: SetRow, known: Set<string>): Row {
  return {
    ...blankRow(r.bodyPart),
    exercise: r.exercise,
    custom: !known.has(`${r.bodyPart}::${r.exercise}`),
    weightKg: String(r.weightKg),
    reps: String(r.reps),
    sets: String(r.sets),
    note: r.note ?? '',
    purpose: r.purpose ?? '',
    autoPurpose: true,
    rating: r.rating ?? '',
    ...logPart(r),
  }
}

/** セットごとの入力を保存する形に（回数か秒が入っているセットだけ） */
const toDetail = (rows: DetailRow[]): SetDetail[] =>
  rows.flatMap((x) => {
    const a = n(x.amount)
    if (!a) return []
    const w = n(x.w)
    return [{ ...(w ? { w } : {}), ...(x.unit === 'r' ? { r: a } : { s: a }), ...(x.side ? { side: x.side } : {}) }]
  })


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
  purposes,
  history,
  method,
  cancelHref,
  memoHref,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>
  deleteAction?: () => Promise<void>
  sessionId: string | null
  initial: { date: string; memo: string; theme: string; rows: SetRow[] }
  bodyParts: string[]
  /** purpose：種目マスタの「いつもの目的」 */
  exercises: Array<{ bodyPart: string; name: string; purpose?: string | null }>
  /** 目的の選択肢（設定 → 種目マスタ） */
  purposes: string[]
  history: HistorySession[]
  method: OneRmMethod
  cancelHref: string
  memoHref?: string | null
}) {
  const known = useMemo(() => new Set(exercises.map((e) => `${e.bodyPart}::${e.name}`)), [exercises])
  const masterPurpose = useMemo(() => new Map(exercises.filter((e) => e.purpose).map((e) => [`${e.bodyPart}::${e.name}`, e.purpose!])), [exercises])
  const [state, formAction] = useActionState(action, null)
  const [date, setDate] = useState(initial.date)
  const [memo, setMemo] = useState(initial.memo)
  const [theme, setTheme] = useState(initial.theme)
  const [rows, setRows] = useState<Row[]>(() => (initial.rows.length ? initial.rows.map((r) => toRow(r, known)) : [blankRow(bodyParts[0] ?? '')]))

  const before = useMemo(() => history.filter((s) => s.date < date && s.id !== sessionId && s.rows.length > 0).sort((a, b) => (a.date < b.date ? -1 : 1)), [history, date, sessionId])
  const lastByExercise = useMemo(() => {
    const m = new Map<string, { date: string; r: SetRow }>()
    for (const s of before) for (const r of s.rows) m.set(r.exercise, { date: s.date, r })
    return m
  }, [before])
  const previousSession = before.at(-1)
  /** 種目を選んだときに入れる目的：このお客様の前回の目的 → 種目マスタの「いつもの目的」 */
  const suggestPurpose = (bodyPart: string, exercise: string) => lastByExercise.get(exercise)?.r.purpose || masterPurpose.get(`${bodyPart}::${exercise}`) || ''
  const pickExercise = (r: Row, exercise: string) => {
    if (r.purpose && !r.autoPurpose) return update(r.key, { exercise })
    const s = exercise ? suggestPurpose(r.bodyPart, exercise) : ''
    update(r.key, { exercise, purpose: s, autoPurpose: !!s })
  }

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
  const add = () => setRows((rs) => [...rs, { ...blankRow(rs.at(-1)?.bodyPart ?? bodyParts[0] ?? '', rs.at(-1)?.sets || '3'), equipment: rs.at(-1)?.equipment ?? '' }])
  /** セットごとの入力 */
  const updateSet = (r: Row, key: string, patch: Partial<DetailRow>) => update(r.key, { detail: r.detail.map((x) => (x.key === key ? { ...x, ...patch } : x)) })
  const addSet = (r: Row, sides?: boolean) => {
    const last = r.detail.at(-1) ?? { key: '', w: r.weightKg, amount: r.reps, unit: 'r' as const, side: '' as const }
    const copy = (side: DetailRow['side']) => ({ ...last, key: newKey(), side })
    update(r.key, { detail: [...r.detail, ...(sides ? [copy('R'), copy('L')] : [copy(last.side)])] })
  }
  /** まとめて ⇔ セットごと。セットごとにするときは、いまの重さ×回数をセット数ぶん並べる */
  const switchMode = (r: Row, mode: Row['mode']) => {
    if (mode === r.mode) return
    if (mode === 'detail' && !r.detail.length) {
      const count = Math.min(10, Math.max(1, n(r.sets) ?? 1))
      return update(r.key, { mode, detail: Array.from({ length: count }, () => ({ key: newKey(), w: r.weightKg, amount: r.reps, unit: 'r' as const, side: '' as const })) })
    }
    update(r.key, { mode })
  }
  const addSpring = (r: Row, token: string) => update(r.key, { springs: token === 'なし' ? 'なし' : normalizeSprings(r.springs && r.springs !== 'なし' ? `${r.springs}＋${token}` : token) })
  const loadPrevious = () => {
    if (!previousSession) return
    const blank = rows.every((r) => !r.exercise && !r.weightKg && !r.reps)
    if (!blank && !confirm(`${mdw(previousSession.date)}の内容で置き換えますか？（いま入力している内容は消えます）`)) return
    setRows(previousSession.rows.map((r) => toRow(r, known)))
  }

  const totals = rows.reduce(
    (a, r) => {
      if (r.mode === 'detail') {
        const d = toDetail(r.detail)
        a.volume += detailVolume(d)
        a.sets += d.length
        return a
      }
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
    theme: theme.trim() || null,
    rows: rows
      .filter((r) => r.exercise.trim() || r.weightKg || r.reps || (r.mode === 'detail' && toDetail(r.detail).length))
      .map((r) => ({
        bodyPart: r.bodyPart,
        exercise: r.exercise.trim(),
        ...(r.mode === 'detail' ? { detail: toDetail(r.detail) } : { weightKg: n(r.weightKg), reps: n(r.reps), sets: n(r.sets) }),
        note: r.note.trim() || null,
        purpose: r.purpose || null,
        equipment: r.equipment || null,
        springs: r.springs.trim() || null,
        rating: r.rating || null,
      })),
  })

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="payload" value={payload} />
      <div className="grid gap-4 md:grid-cols-[13rem_14rem_1fr]">
        <Field label="日付（来店日）">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
        </Field>
        <Field label="この回のテーマ">
          <input value={theme} onChange={(e) => setTheme(e.target.value)} maxLength={60} className={inputClass} placeholder="例：伸展" />
        </Field>
        <Field label="メモ（文字）">
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={1000} rows={1} className={cn(inputClass, 'min-h-11 [field-sizing:content]')} placeholder="例：右膝に違和感あり、スクワットは浅めに" />
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
              <div className="flex flex-wrap items-center gap-2">
                <span className="num grid size-8 flex-none place-items-center rounded-full bg-white text-sm font-semibold text-ink-2 ring-1 ring-line">{i + 1}</span>
                <select
                  value={r.bodyPart}
                  onChange={(e) => update(r.key, { bodyPart: e.target.value, exercise: '', custom: false, ...(r.autoPurpose ? { purpose: '', autoPurpose: false } : {}) })}
                  className={cn(inputClass, 'w-28 flex-none')}
                  aria-label={`${i + 1}行目の部位`}
                >
                  {[...bodyParts, ...(bodyParts.includes(r.bodyPart) || !r.bodyPart ? [] : [r.bodyPart])].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <div className="min-w-0 flex-1 basis-40">
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
                      onChange={(e) => (e.target.value === CUSTOM ? update(r.key, { custom: true, exercise: '' }) : pickExercise(r, e.target.value))}
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
                <label className="order-last flex w-full items-center gap-2 pl-10 lg:order-none lg:w-60 lg:pl-0">
                  <span className="flex-none text-xs font-bold text-ink-3">目的</span>
                  <select
                    value={r.purpose}
                    onChange={(e) => update(r.key, { purpose: e.target.value, autoPurpose: false })}
                    className={cn(inputClass, 'min-w-0 flex-1 lg:flex-1', !r.purpose && 'text-ink-3')}
                    aria-label={`${i + 1}行目の目的`}
                  >
                    <option value="">目的を選ぶ</option>
                    {purposeOptionsWith(purposes, r.purpose).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
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

              {/* 入れ方：まとめて（重さ×回数×セット）／セットごと（左右・秒・セットごとに違う重さ） */}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full bg-white p-0.5 ring-1 ring-line" role="group" aria-label={`${i + 1}行目の入れ方`}>
                  {(
                    [
                      ['simple', '重さ×回数×セット'],
                      ['detail', 'セットごと（左右・秒）'],
                    ] as const
                  ).map(([m, label]) => (
                    <button key={m} type="button" onClick={() => switchMode(r, m)} aria-pressed={r.mode === m} className={cn('h-9 rounded-full px-3 text-sm font-bold', r.mode === m ? 'bg-dark text-white' : 'text-ink-2 hover:bg-soft')}>
                      {label}
                    </button>
                  ))}
                </span>
                {r.mode === 'detail' && <span className="text-sm text-ink-2">{detailText(toDetail(r.detail)) || 'セットを足してください'}</span>}
              </div>

              {r.mode === 'simple' ? (
                <div className="mt-2 grid grid-cols-3 gap-2 md:grid-cols-[1fr_1fr_1fr_9rem]">
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
              ) : (
                <div className="mt-2 space-y-1.5">
                  {r.detail.map((x, k) => (
                    <div key={x.key} className="flex flex-wrap items-center gap-1.5 rounded-xl bg-white px-2 py-1.5 ring-1 ring-line">
                      <span className="num w-6 flex-none text-center text-sm font-semibold text-ink-3">{k + 1}</span>
                      <span className="inline-flex rounded-full bg-soft p-0.5" role="group" aria-label={`${k + 1}セット目の左右`}>
                        {(
                          [
                            ['', '両方'],
                            ['R', '右'],
                            ['L', '左'],
                          ] as const
                        ).map(([sd, label]) => (
                          <button key={sd || 'both'} type="button" onClick={() => updateSet(r, x.key, { side: sd })} aria-pressed={x.side === sd} className={cn('h-9 min-w-10 rounded-full px-2.5 text-sm font-bold', x.side === sd ? 'bg-dark text-white' : 'text-ink-2')}>
                            {label}
                          </button>
                        ))}
                      </span>
                      <label className="flex items-center gap-1">
                        <input value={x.w} onChange={(e) => updateSet(r, x.key, { w: e.target.value })} inputMode="decimal" placeholder="—" className={cn(inputClass, 'num h-10 min-h-10 w-20 text-right')} aria-label={`${k + 1}セット目の重さ`} />
                        <span className="text-xs font-bold text-ink-3">kg</span>
                      </label>
                      <input value={x.amount} onChange={(e) => updateSet(r, x.key, { amount: e.target.value })} inputMode="numeric" className={cn(inputClass, 'num h-10 min-h-10 w-20 text-right')} aria-label={`${k + 1}セット目の${x.unit === 'r' ? '回数' : '秒数'}`} />
                      <span className="inline-flex rounded-full bg-soft p-0.5" role="group" aria-label={`${k + 1}セット目の単位`}>
                        {(
                          [
                            ['r', '回'],
                            ['s', '秒'],
                          ] as const
                        ).map(([u, label]) => (
                          <button key={u} type="button" onClick={() => updateSet(r, x.key, { unit: u })} aria-pressed={x.unit === u} className={cn('h-9 min-w-10 rounded-full px-2.5 text-sm font-bold', x.unit === u ? 'bg-dark text-white' : 'text-ink-2')}>
                            {label}
                          </button>
                        ))}
                      </span>
                      <button type="button" onClick={() => update(r.key, { detail: r.detail.filter((y) => y.key !== x.key) })} className={cn(buttonClass.danger, 'ml-auto h-9 min-w-9')} aria-label={`${k + 1}セット目を消す`}>
                        <X className="size-4" aria-hidden />
                      </button>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => addSet(r)} className={buttonClass.small}>
                      <Plus className="size-4" aria-hidden />
                      セットを足す
                    </button>
                    <button type="button" onClick={() => addSet(r, true)} className={buttonClass.small}>
                      <Plus className="size-4" aria-hidden />
                      右と左を足す
                    </button>
                    {detailVolume(toDetail(r.detail)) > 0 && (
                      <span className="self-center text-xs text-ink-3">
                        総負荷量 <span className="num font-semibold text-ink-2">{int(detailVolume(toDetail(r.detail)))}</span>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 器具・バネ・できばえ・メモ */}
              <div className="mt-2.5 grid gap-2 md:grid-cols-[10rem_minmax(0,1fr)_auto]">
                <select value={r.equipment} onChange={(e) => update(r.key, { equipment: e.target.value })} className={cn(inputClass, !r.equipment && 'text-ink-3')} aria-label={`${i + 1}行目の器具`}>
                  <option value="">器具</option>
                  {[...EQUIPMENT, ...(r.equipment && !(EQUIPMENT as readonly string[]).includes(r.equipment) ? [r.equipment] : [])].map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
                <div className="flex min-w-0 items-center gap-1.5">
                  <input value={r.springs} onChange={(e) => update(r.key, { springs: e.target.value })} onBlur={() => update(r.key, { springs: normalizeSprings(r.springs) })} maxLength={40} placeholder="バネ（例：1R＋1Y）" className={cn(inputClass, 'num min-w-0 flex-1')} aria-label={`${i + 1}行目のバネ`} />
                  <button type="button" onClick={() => update(r.key, { springPicker: !r.springPicker })} aria-expanded={r.springPicker} className={buttonClass.small}>
                    選ぶ
                  </button>
                </div>
                <span className="inline-flex flex-wrap gap-1" role="group" aria-label={`${i + 1}行目のできばえ`}>
                  {(Object.keys(RATINGS) as Rating[]).map((k) => (
                    <button key={k} type="button" onClick={() => update(r.key, { rating: r.rating === k ? '' : k })} aria-pressed={r.rating === k} title={RATINGS[k].label} className={cn('h-11 min-w-11 rounded-full px-2.5 text-base font-black ring-1', r.rating === k ? 'bg-dark text-white ring-dark' : 'bg-white text-ink-2 ring-line-2 hover:bg-soft')}>
                      {RATINGS[k].mark}
                      <span className="sr-only">{RATINGS[k].label}</span>
                    </button>
                  ))}
                </span>
              </div>
              {r.springPicker && (
                <div className="mt-2 rounded-xl bg-white p-2.5 ring-1 ring-line">
                  <div className="flex flex-wrap gap-1.5">
                    {[...SPRING_QUICK, 'なし'].map((t) => {
                      const tok = parseSprings(t)[0]
                      return (
                        <button key={t} type="button" onClick={() => addSpring(r, t)} className="num inline-flex h-10 items-center gap-1.5 rounded-full bg-soft px-3 text-sm font-bold ring-1 ring-line hover:bg-brand-soft">
                          {tok && <span className="size-3 rounded-full ring-1 ring-black/10" style={{ background: springColorHex(tok.color) }} aria-hidden />}
                          {t}
                        </button>
                      )
                    })}
                    <button type="button" onClick={() => update(r.key, { springs: '' })} className={buttonClass.ghost}>
                      消す
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-ink-3">押すと「＋」でつながります。数字が先＝本数（1R＝レッド1本）、色のあと＝強度1〜4（B2＝ブルー強度2）</p>
                </div>
              )}
              {r.springs && <p className="mt-1 text-xs text-ink-3">バネ：{springsText(r.springs)}</p>}
              <input value={r.note} onChange={(e) => update(r.key, { note: e.target.value })} maxLength={200} placeholder="様子・注意（例：腰痛なし、前ももに効く、左2〜3回で崩れる）" className={cn(inputClass, 'mt-2')} aria-label={`${i + 1}行目の様子・注意`} />

              {last && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-3">
                  <span>
                    前回 <span className="num">{mdw(last.date)}</span>：
                    <span className="num font-semibold text-ink-2">
                      {last.r.springs ? `${last.r.springs} ` : ''}
                      {last.r.detail?.length ? detailText(last.r.detail) : `${last.r.weightKg === 0 ? '自重' : `${num(last.r.weightKg, last.r.weightKg % 1 === 0 ? 0 : 1)}kg`} × ${last.r.reps}回 × ${last.r.sets}セット`}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      update(r.key, {
                        weightKg: String(last.r.weightKg),
                        reps: String(last.r.reps),
                        sets: String(last.r.sets),
                        ...logPart(last.r),
                        ...(!r.purpose && last.r.purpose ? { purpose: last.r.purpose, autoPurpose: true } : {}),
                      })
                    }
                    className={buttonClass.small}
                  >
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
