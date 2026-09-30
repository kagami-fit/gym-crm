'use client'

import { useState } from 'react'
import { Check, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { deletePhaseAction, savePhaseAction } from '@/app/(app)/clients/[id]/steps/actions'
import { Badge, Field, buttonClass, inputClass } from '@/components/ui'
import { addDays, diffDays, md, ymdJa, type Ymd } from '@/lib/dates'
import { PHASE_PRESETS } from '@/lib/labels'
import { phaseAt, phaseDays, type PhaseRow } from '@/lib/steps'
import { cn } from '@/lib/utils'

type Draft = { id?: string; name: string; start: Ymd; end: string; note: string }

const span = (days: number) => (days >= 14 ? `${days}日・約${Math.round(days / 7)}週` : `${days}日`)

/**
 * 期（自律神経期・ピラティス期など）。お客様がいまどの段階にいるかを、帯とリストで見せて、追加・変更する。
 * 終わりの日は空でよい（次の期の前日まで。最後の期なら続いている扱い）。
 */
export function PhaseEditor({ clientId, phases, base, joinedOn }: { clientId: string; phases: PhaseRow[]; base: Ymd; joinedOn: Ymd | null }) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const list = phases.filter((p) => !removed.has(p.id))
  const now = phaseAt(list, base)

  const newDraft = (): Draft => {
    const last = list[list.length - 1]
    // 最後の期に終わりの日があればその翌日、なければ基準日（その日から切り替える）
    const start = last ? (last.end ? addDays(last.end, 1) : base > last.start ? base : addDays(last.start, 1)) : (joinedOn ?? base)
    const used = new Set(list.map((p) => p.name))
    const name = PHASE_PRESETS.find((p) => !used.has(p.name))?.name ?? ''
    return { name, start, end: '', note: '' }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!draft || pending) return
    setPending(true)
    setError(null)
    const r = await savePhaseAction(clientId, { id: draft.id, name: draft.name, start: draft.start, end: draft.end || undefined, note: draft.note })
    setPending(false)
    if (!r.ok) return setError(r.message)
    setDraft(null)
  }

  async function remove(p: PhaseRow) {
    if (!confirm(`「${p.name}」（${md(p.start)}〜）を削除しますか？`)) return
    setRemoved((s) => new Set(s).add(p.id))
    const r = await deletePhaseAction(clientId, p.id)
    if (!r.ok)
      setRemoved((s) => {
        const n = new Set(s)
        n.delete(p.id)
        return n
      })
  }

  return (
    <div className="space-y-4">
      {list.length > 0 ? <Timeline phases={list} base={base} /> : <p className="rounded-xl border border-dashed border-line-2 bg-soft px-4 py-5 text-center text-sm text-ink-2">まだ期がありません。「期を追加」から、いまの段階を入れてください。</p>}

      {list.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line bg-white">
          {[...list].reverse().map((p) =>
            draft?.id === p.id ? (
              <li key={p.id} className="p-3">
                <DraftForm draft={draft} setDraft={setDraft} onSubmit={save} pending={pending} error={error} onCancel={() => setDraft(null)} />
              </li>
            ) : (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                <span className="size-3.5 flex-none rounded-sm" style={{ background: p.color }} aria-hidden />
                <span className="text-[15px] font-black">{p.name}</span>
                {now?.id === p.id && <Badge tone="dark">いま</Badge>}
                <span className="num text-sm text-ink-2">
                  {md(p.start)}〜{p.until ? md(p.until) : '続いている'}
                  <span className="ml-1.5 text-xs text-ink-3">（{span(phaseDays(p, base))}）</span>
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <button type="button" onClick={() => setDraft({ id: p.id, name: p.name, start: p.start, end: p.end ?? '', note: p.note ?? '' })} className={buttonClass.ghost} aria-label={`${p.name}を変更`}>
                    <Pencil className="size-4" aria-hidden />
                    変更
                  </button>
                  <button type="button" onClick={() => void remove(p)} className={buttonClass.danger} aria-label={`${p.name}を削除`}>
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </span>
                {p.note && <p className="w-full pl-6 text-sm text-ink-2">{p.note}</p>}
              </li>
            ),
          )}
        </ul>
      )}

      {draft && !draft.id ? (
        <div className="rounded-xl border border-line bg-soft p-4">
          <p className="mb-3 text-sm font-black">期を追加</p>
          <DraftForm draft={draft} setDraft={setDraft} onSubmit={save} pending={pending} error={error} onCancel={() => setDraft(null)} />
        </div>
      ) : (
        <button type="button" onClick={() => (setError(null), setDraft(newDraft()))} className={buttonClass.secondary}>
          <Plus className="size-4" aria-hidden />
          期を追加
        </button>
      )}
    </div>
  )
}

function DraftForm({ draft, setDraft, onSubmit, pending, error, onCancel }: { draft: Draft; setDraft: (d: Draft) => void; onSubmit: (e: React.FormEvent) => void; pending: boolean; error: string | null; onCancel: () => void }) {
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <span className="text-sm font-bold">期の名前</span>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {PHASE_PRESETS.map((p) => (
            <button key={p.name} type="button" onClick={() => set({ name: p.name })} aria-pressed={draft.name === p.name} className={cn('inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold ring-1', draft.name === p.name ? 'bg-dark text-white ring-dark' : 'bg-white text-ink-2 ring-line-2 hover:bg-soft')}>
              <span className="size-2.5 rounded-full" style={{ background: p.color }} aria-hidden />
              {p.name}
            </button>
          ))}
          <input value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={30} placeholder="ほかの名前（自由に入力）" aria-label="期の名前" className={cn(inputClass, 'h-10 min-h-10 w-56 flex-1 py-1')} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="開始日" required>
          <input type="date" value={draft.start} onChange={(e) => set({ start: e.target.value })} required className={inputClass} />
        </Field>
        <Field label="終わりの日" hint="空なら次の期の前日まで（最後の期なら続いている）">
          <input type="date" value={draft.end} min={draft.start} onChange={(e) => set({ end: e.target.value })} className={inputClass} />
        </Field>
      </div>
      <Field label="メモ（任意）">
        <input value={draft.note} onChange={(e) => set({ note: e.target.value })} maxLength={200} placeholder="例：睡眠が整ってきたらピラティス期へ" className={inputClass} />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending || !draft.name.trim() || !draft.start} className={buttonClass.primary}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
          保存
        </button>
        <button type="button" onClick={onCancel} className={buttonClass.ghost}>
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

/** 期の帯（最初の期の開始日〜基準日。長さは日数に比例。基準日に線を引く） */
function Timeline({ phases, base }: { phases: PhaseRow[]; base: Ymd }) {
  const from = phases[0].start
  const to = [base, ...phases.map((p) => p.until ?? p.start)].reduce((a, b) => (a > b ? a : b))
  const total = diffDays(from, to) + 1
  // 期と期のあいだの空き（終わりの日を決めて、次の期までがあいているとき）も灰色で入れる
  const segs: Array<{ key: string; start: Ymd; end: Ymd; phase: PhaseRow | null }> = []
  let cursor = from
  for (const p of phases) {
    if (p.start > cursor) segs.push({ key: `gap-${cursor}`, start: cursor, end: addDays(p.start, -1), phase: null })
    const end = p.until ?? to
    if (end >= p.start) segs.push({ key: p.id, start: p.start, end, phase: p })
    if (addDays(end, 1) > cursor) cursor = addDays(end, 1)
  }
  if (cursor <= to) segs.push({ key: `gap-${cursor}`, start: cursor, end: to, phase: null })
  const baseAt = ((diffDays(from, base) + 0.5) / total) * 100
  return (
    <div>
      <div className="relative pt-5">
        {base >= from && base <= to && (
          <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left: `${baseAt}%` }}>
            {/* 端に近いときは、ラベルが枠からはみ出ないよう内側に寄せる */}
            <span className={cn('num absolute -top-0.5 whitespace-nowrap rounded bg-dark px-1.5 text-[11px] font-bold leading-4 text-white', baseAt > 88 ? '-translate-x-full' : baseAt < 12 ? '' : '-translate-x-1/2')}>基準日 {md(base)}</span>
            <span className="absolute bottom-0 top-4 w-0.5 -translate-x-1/2 bg-dark" />
          </div>
        )}
        <div className="flex h-12 overflow-hidden rounded-xl ring-1 ring-line">
          {segs.map((s) => {
            const days = diffDays(s.start, s.end) + 1
            return (
              <div key={s.key} className="flex min-w-0 flex-col justify-center border-l-4 px-2 first:border-l-4" style={{ flexGrow: days, flexBasis: 0, background: s.phase ? `${s.phase.color}26` : 'var(--color-soft)', borderLeftColor: s.phase?.color ?? 'var(--color-line-2)' }} title={`${s.phase?.name ?? '期なし'}：${ymdJa(s.start, false)}〜${ymdJa(s.end, false)}`}>
                <span className={cn('truncate text-sm font-black', !s.phase && 'font-bold text-ink-3')}>{s.phase?.name ?? '期なし'}</span>
                <span className="num truncate text-[11px] text-ink-2">
                  {md(s.start)}〜{s.phase && !s.phase.until ? '' : md(s.end)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
