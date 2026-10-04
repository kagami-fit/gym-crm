'use client'

import { useActionState, useState } from 'react'
import { Check, ExternalLink, FileText, Image as ImageIcon, Loader2, Pencil, Trash2 } from 'lucide-react'
import { deleteAnsAction, updateAnsAction } from '@/app/(app)/clients/[id]/plan/actions'
import { AnsLevelChip } from '@/components/plan/Chips'
import { FormMessage, SubmitButton, type ActionState } from '@/components/SubmitButton'
import { Field, buttonClass, inputClass, numInputClass } from '@/components/ui'
import type { AnsRow } from '@/lib/data/ans'
import { md, ymdJa, type Ymd } from '@/lib/dates'
import { num, signed } from '@/lib/format'
import { ANS_LEVELS, ANS_TYPES, type AnsLevel } from '@/lib/labels'
import { ansState } from '@/lib/plan'
import { cn } from '@/lib/utils'

const size = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(b / 1024))}KB`)
const NERVES = [
  { key: 'sympathetic', label: '交感神経', bar: 'オレンジの棒' },
  { key: 'parasympathetic', label: '副交感神経', bar: '青の棒' },
] as const
const LEVEL_KEYS = Object.keys(ANS_LEVELS) as AnsLevel[]

type Eval = { sympathetic: string; sympatheticLevel: string; parasympathetic: string; parasympatheticLevel: string; ansType: string; note: string }
const emptyEval: Eval = { sympathetic: '', sympatheticLevel: '', parasympathetic: '', parasympatheticLevel: '', ansType: '', note: '' }
const evalOf = (r: AnsRow): Eval => ({
  sympathetic: r.sympathetic != null ? String(r.sympathetic) : '',
  sympatheticLevel: r.sympatheticLevel ?? '',
  parasympathetic: r.parasympathetic != null ? String(r.parasympathetic) : '',
  parasympatheticLevel: r.parasympatheticLevel ?? '',
  ansType: r.ansType ?? '',
  note: r.note ?? '',
})
const asLevel = (v: string): AnsLevel | null => (v in ANS_LEVELS ? (v as AnsLevel) : null)

/** 交感神経・副交感神経の数値と位置（測定票を見て、低い・基準内・高いを選ぶ）、型（仮）、評価メモ。name をつけるとフォームでも送れる */
function EvalFields({ v, set, named }: { v: Eval; set: (p: Partial<Eval>) => void; named?: boolean }) {
  const st = ansState({ sympatheticLevel: asLevel(v.sympatheticLevel), parasympatheticLevel: asLevel(v.parasympatheticLevel) })
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-2">測定票の「活性度」の2本の棒を見て、数値と、グレーゾーンとの位置を選びます（総合点やバランスの点数ではなく、この2本で見ます）。</p>
      {NERVES.map((n) => {
        const lk = `${n.key}Level` as const
        return (
          <div key={n.key} className="grid gap-2 sm:grid-cols-[9rem_7rem_minmax(0,1fr)] sm:items-end">
            <p className="text-sm font-bold sm:pb-3">
              {n.label}
              <span className="block text-xs font-normal text-ink-3">{n.bar}</span>
            </p>
            <Field label="数値">
              <input name={named ? n.key : undefined} value={v[n.key]} onChange={(e) => set({ [n.key]: e.target.value })} inputMode="decimal" placeholder="例：4.96" className={numInputClass} aria-label={`${n.label}の数値`} />
            </Field>
            <div>
              <span className="text-sm font-bold">グレーゾーンとの位置</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label={`${n.label}の位置`}>
                {[...LEVEL_KEYS, ''].map((lv) => (
                  <label key={lv || 'none'} className={cn('inline-flex h-11 cursor-pointer items-center rounded-full px-4 text-sm font-bold ring-1', v[lk] === lv ? 'bg-dark text-white ring-dark' : 'bg-white text-ink-2 ring-line-2 hover:bg-soft')}>
                    <input type="radio" name={named ? lk : undefined} value={lv} checked={v[lk] === lv} onChange={() => set({ [lk]: lv })} className="sr-only" />
                    {lv ? ANS_LEVELS[lv as AnsLevel].label : '未確認'}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )
      })}
      <p className={cn('rounded-lg px-3 py-2 text-sm font-bold', st.state === 'good' ? 'bg-ok-soft text-ok' : st.state === 'out' ? 'bg-warn-soft text-warn' : 'bg-soft text-ink-2')}>評価：{st.text}</p>
      <div className="grid gap-3 md:grid-cols-[16rem_minmax(0,1fr)]">
        <Field label="型（A〜D・仮）" hint="対応が確定するまでは仮。空でも保存できます">
          <select name={named ? 'ansType' : undefined} value={v.ansType} onChange={(e) => set({ ansType: e.target.value })} className={inputClass}>
            <option value="">未確定</option>
            {Object.entries(ANS_TYPES).map(([k, label]) => (
              <option key={k} value={k}>
                {k}：{label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="評価メモ" hint="疲労や症状など、数値と合わせて見た内容">
          <input name={named ? 'note' : undefined} value={v.note} onChange={(e) => set({ note: e.target.value })} maxLength={500} placeholder="例：疲労感が強い。副交感神経はまだ低い" className={inputClass} />
        </Field>
      </div>
    </div>
  )
}

/**
 * 自律神経の測定（condiView の測定票の PDF・写真）を測定日ごとに保存し、「活性度」の2本の棒を記録する。
 * 両方がそれぞれのグレーゾーン内にあるときだけ「良い状態」。数値だけでの自動判定・A〜Dの自動分類はしない（上下限・対応が確定してから）。
 */
export function AnsPanel({ clientId, action, base, rows }: { clientId: string; action: (p: ActionState, fd: FormData) => Promise<ActionState>; base: Ymd; rows: AnsRow[] }) {
  const [state, formAction] = useActionState(action, null)
  const [v, setV] = useState<Eval>(emptyEval)
  const [savedAt, setSavedAt] = useState<number | undefined>(undefined)
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<string | null>(null)
  const list = rows.filter((r) => !removed.has(r.id))
  // 保存できたら、数値・位置の入力を空に戻す（ファイルと日付はフォームが自分で戻す）
  if (state?.ok && state.at !== savedAt) {
    setSavedAt(state.at)
    setV(emptyEval)
  }

  async function remove(r: AnsRow) {
    if (!confirm(`${ymdJa(r.measuredOn, false)}の測定結果（${r.fileName}）を削除しますか？`)) return
    setRemoved((s) => new Set(s).add(r.id))
    const res = await deleteAnsAction(clientId, r.id)
    if (!res.ok)
      setRemoved((s) => {
        const n = new Set(s)
        n.delete(r.id)
        return n
      })
  }

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4 rounded-xl border border-line bg-soft p-4">
        <p className="text-sm font-black">測定結果を入れる</p>
        <div className="grid gap-3 md:grid-cols-[11rem_minmax(0,1fr)]">
          <Field label="測定日" required>
            <input type="date" name="measuredOn" defaultValue={base} required className={inputClass} />
          </Field>
          <Field label="測定票" hint="PDF か写真（JPEG・PNG）。3.5MBまで" required>
            <input type="file" name="file" accept="application/pdf,image/jpeg,image/png,image/heic,image/webp" required className={cn(inputClass, 'py-2 file:mr-3 file:rounded-full file:border-0 file:bg-dark file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-white')} />
          </Field>
        </div>
        <EvalFields v={v} set={(p) => setV((x) => ({ ...x, ...p }))} named />
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pendingText="保存しています">測定結果を保存</SubmitButton>
          <FormMessage state={state} />
        </div>
      </form>

      {list.length ? (
        <ul className="divide-y divide-line rounded-xl border border-line bg-white">
          {list.map((r, i) => {
            const Icon = r.mimeType === 'application/pdf' ? FileText : ImageIcon
            const prev = list[i + 1] ?? null
            const st = ansState(r)
            return (
              <li key={r.id} className="space-y-2 px-3 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Icon className="size-5 flex-none text-ink-3" aria-hidden />
                  <span className="num text-[15px] font-black">{ymdJa(r.measuredOn)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-2">
                    {r.fileName}
                    <span className="num ml-1.5 text-xs text-ink-3">{size(r.size)}</span>
                  </span>
                  <a href={`/api/ans/${r.id}`} target="_blank" rel="noreferrer" className={buttonClass.small}>
                    <ExternalLink className="size-4" aria-hidden />
                    開く
                  </a>
                  <button type="button" onClick={() => setEditing(editing === r.id ? null : r.id)} className={buttonClass.small} aria-expanded={editing === r.id}>
                    <Pencil className="size-4" aria-hidden />
                    評価を入れる・直す
                  </button>
                  <button type="button" onClick={() => void remove(r)} className={buttonClass.danger} aria-label={`${ymdJa(r.measuredOn, false)}の測定結果を削除`}>
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
                {editing === r.id ? (
                  <EditForm clientId={clientId} row={r} onDone={() => setEditing(null)} />
                ) : (
                  <div className="space-y-1 pl-8 text-sm">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {NERVES.map((n) => (
                        <span key={n.key} className="inline-flex items-center gap-1.5">
                          {n.label}
                          <span className="num font-semibold">{r[n.key] != null ? num(r[n.key], 2) : '—'}</span>
                          <AnsLevelChip level={r[`${n.key}Level`]} />
                          {prev && r[n.key] != null && prev[n.key] != null && <span className="num text-xs text-ink-3">（前回から {signed(r[n.key]! - prev[n.key]!, 2)}）</span>}
                        </span>
                      ))}
                    </p>
                    <p className={cn('font-bold', st.state === 'good' ? 'text-ok' : st.state === 'out' ? 'text-warn' : 'text-ink-3')}>
                      評価：{st.text}
                      {r.ansType && <span className="ml-2 font-normal text-ink-2">型 {r.ansType}（仮）</span>}
                    </p>
                    {prev && (prev.sympatheticLevel !== r.sympatheticLevel || prev.parasympatheticLevel !== r.parasympatheticLevel) && (
                      <p className="text-xs text-ink-3">
                        前回（{md(prev.measuredOn)}）からの位置の変化：
                        {NERVES.filter((n) => prev[`${n.key}Level`] !== r[`${n.key}Level`])
                          .map((n) => `${n.label} ${levelText(prev[`${n.key}Level`])} → ${levelText(r[`${n.key}Level`])}`)
                          .join('、')}
                      </p>
                    )}
                    {r.note && <p className="text-ink-2">メモ：{r.note}</p>}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line-2 bg-white/60 px-4 py-5 text-center text-sm text-ink-2">まだ測定結果はありません</p>
      )}
    </div>
  )
}

const levelText = (lv: AnsLevel | null) => (lv ? ANS_LEVELS[lv].label : '未確認')

/** 保存済みの測定に、あとから評価を入れる・直す */
function EditForm({ clientId, row, onDone }: { clientId: string; row: AnsRow; onDone: () => void }) {
  const [v, setV] = useState<Eval>(evalOf(row))
  const [measuredOn, setMeasuredOn] = useState(row.measuredOn)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    const r = await updateAnsAction(clientId, row.id, { ...v, measuredOn })
    setPending(false)
    if (!r.ok) return setError(r.message)
    onDone()
  }
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-line bg-soft p-4">
      <Field label="測定日" className="max-w-[11rem]">
        <input type="date" value={measuredOn} onChange={(e) => setMeasuredOn(e.target.value)} className={inputClass} />
      </Field>
      <EvalFields v={v} set={(p) => setV((x) => ({ ...x, ...p }))} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
          保存
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
