'use client'

import { useState } from 'react'
import { Check, Loader2, Plus, Trash2 } from 'lucide-react'
import { deletePolicyAction, savePolicyAction, type PolicyInput } from '@/app/(app)/clients/[id]/plan/actions'
import { Badge, Field, Notice, buttonClass, inputClass, numInputClass } from '@/components/ui'
import type { GoalRow } from '@/lib/data/body'
import { diffDays, md, ymdJa, type Ymd } from '@/lib/dates'
import { num } from '@/lib/format'
import { DIET_POLICIES, PHASE_PRESETS, isDietPolicy, policyLabel, type DietPolicy } from '@/lib/labels'
import { reversePeriods } from '@/lib/plan'
import { cn } from '@/lib/utils'

type PaceOpt = { key: string; name: string; percentPerMonth: number; note: string }
type ActOpt = { value: number; label: string }

const POLICY_KEYS = Object.keys(DIET_POLICIES) as DietPolicy[]
const left = (base: Ymd, d: Ymd) => {
  const n = diffDays(base, d)
  return n > 0 ? `あと${n}日` : n === 0 ? '今日' : `${-n}日過ぎ`
}

/**
 * 食事方針と目標。フェーズ1：回復食・バランス食・そのほか／フェーズ2：コーフラックス・減量・維持。
 * 方針によって入れる欄が変わる。変えるたびに履歴に1件ふえる（方針変更の履歴）。
 */
export function PolicyEditor({
  clientId,
  base,
  goals,
  current,
  paces,
  activityFactors,
  phaseName,
}: {
  clientId: string
  base: Ymd
  /** 新しい順 */
  goals: GoalRow[]
  current: GoalRow | null
  paces: PaceOpt[]
  activityFactors: ActOpt[]
  phaseName: string | null
}) {
  const [formOpen, setFormOpen] = useState(!current)
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const list = goals.filter((g) => !removed.has(g.id))
  const inPhase2 = phaseName === PHASE_PRESETS[1].name
  const currentPhase = current && isDietPolicy(current.policy) ? DIET_POLICIES[current.policy].phase : null

  async function remove(g: GoalRow) {
    if (!confirm(`${md(g.startDate)}の「${policyLabel(g.policy, g.policyName)}」を履歴から削除しますか？`)) return
    setRemoved((s) => new Set(s).add(g.id))
    const r = await deletePolicyAction(clientId, g.id)
    if (!r.ok)
      setRemoved((s) => {
        const n = new Set(s)
        n.delete(g.id)
        return n
      })
  }

  return (
    <div className="space-y-4">
      {inPhase2 && currentPhase === 1 && <Notice tone="info">フェーズ2に入っています。コーフラックス・減量・維持から、食事方針を選んでください。</Notice>}
      {current ? <Current g={current} base={base} paces={paces} /> : <p className="rounded-xl border border-dashed border-line-2 bg-soft px-4 py-5 text-center text-sm text-ink-2">まだ食事方針がありません</p>}

      {formOpen ? (
        <div className="rounded-xl border border-line bg-soft p-4">
          <p className="mb-3 text-sm font-black">{current ? '食事方針を変える（履歴に追加されます）' : '食事方針を決める'}</p>
          <PolicyForm clientId={clientId} base={base} current={current} paces={paces} activityFactors={activityFactors} phaseName={phaseName} onDone={() => setFormOpen(false)} onCancel={current ? () => setFormOpen(false) : undefined} />
        </div>
      ) : (
        <button type="button" onClick={() => setFormOpen(true)} className={buttonClass.secondary}>
          <Plus className="size-4" aria-hidden />
          食事方針を変える
        </button>
      )}

      {list.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-black">食事方針の履歴</h3>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-tint text-left text-xs text-ink-2">
                <tr>
                  <th className="px-3 py-2 font-bold">開始日</th>
                  <th className="px-3 py-2 font-bold">方針</th>
                  <th className="px-3 py-2 font-bold">体重</th>
                  <th className="px-3 py-2 font-bold">予定日</th>
                  <th className="px-3 py-2 font-bold">理由・メモ</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((g) => (
                  <tr key={g.id}>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className="num">{ymdJa(g.startDate, false)}</span>
                      {g.id === current?.id && (
                        <Badge tone="brand" className="ml-2">
                          いま
                        </Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-bold">
                      {policyLabel(g.policy, g.policyName)}
                      {g.policy === 'loss' && g.paceKey && <span className="ml-1 text-xs font-normal text-ink-3">{paces.find((p) => p.key === g.paceKey)?.name ?? ''}</span>}
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2">
                      {g.startWeightKg != null ? `${num(g.startWeightKg)}kg` : '—'}
                      {g.targetWeightKg != null && <span className="text-ink-3"> → {num(g.targetWeightKg)}kg</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-2">
                      {[g.endDate ? `終了予定 ${md(g.endDate)}` : null, g.targetDate ? `目標日 ${md(g.targetDate)}` : null, g.reviewDate ? `見直し ${md(g.reviewDate)}` : null].filter(Boolean).join('・') || '—'}
                    </td>
                    <td className="px-3 py-2 text-ink-2">{g.note ?? ''}</td>
                    <td className="px-2 py-1">
                      <button type="button" onClick={() => void remove(g)} className={buttonClass.danger} aria-label={`${md(g.startDate)}の食事方針を削除`}>
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function Current({ g, base, paces }: { g: GoalRow; base: Ymd; paces: PaceOpt[] }) {
  const pace = g.policy === 'loss' ? paces.find((p) => p.key === g.paceKey) : null
  const items: Array<{ label: string; value: string; sub?: string; warn?: boolean }> = [
    { label: '食事方針', value: policyLabel(g.policy, g.policyName), sub: `${ymdJa(g.startDate, false)}から` },
  ]
  if (g.policy === 'reverse' && g.endDate) items.push({ label: '終了予定日', value: ymdJa(g.endDate, false), sub: left(base, g.endDate), warn: g.endDate < base })
  if (g.policy === 'loss') {
    items.push({ label: '目標体重', value: g.targetWeightKg != null ? `${num(g.targetWeightKg)} kg` : '—' })
    items.push({ label: '減量ペース', value: pace ? `${pace.name}（−${pace.percentPerMonth}%／月）` : '—' })
  }
  if (g.policy === 'maintain') items.push({ label: '維持したい体重', value: g.targetWeightKg != null ? `${num(g.targetWeightKg)} kg` : '—' })
  if (g.policy !== 'loss' && g.policy !== 'maintain' && g.targetWeightKg != null) items.push({ label: '目標体重', value: `${num(g.targetWeightKg)} kg` })
  if (g.targetDate) items.push({ label: '目標日', value: ymdJa(g.targetDate, false), sub: left(base, g.targetDate), warn: g.targetDate < base })
  if (g.reviewDate) items.push({ label: '見直し予定日', value: ymdJa(g.reviewDate, false), sub: left(base, g.reviewDate), warn: g.reviewDate < base })
  if (g.activityFactor != null) items.push({ label: '活動係数', value: num(g.activityFactor) })
  const rp = g.policy === 'reverse' ? reversePeriods(base, g.endDate, g.targetDate) : null
  return (
    <div className="space-y-2">
      <div className="grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.label}>
            <p className="text-xs font-bold text-ink-3">{it.label}</p>
            <p className="num mt-0.5 font-semibold text-ink">{it.value}</p>
            {it.sub && <p className={cn('text-xs', it.warn ? 'font-bold text-warn' : 'text-ink-3')}>{it.sub}</p>}
          </div>
        ))}
      </div>
      {rp?.afterEnd != null && (
        <p className="text-sm text-ink-2">
          {DIET_POLICIES.reverse.label}の終了予定から目標日まで <span className="num font-bold">{rp.afterEnd}</span>日（約<span className="num font-bold">{Math.round(rp.afterEnd / 7)}</span>週）を減量に使えます
        </p>
      )}
      {g.note && <p className="text-sm text-ink-2">理由・メモ：{g.note}</p>}
    </div>
  )
}

function PolicyForm({
  clientId,
  base,
  current,
  paces,
  activityFactors,
  phaseName,
  onDone,
  onCancel,
}: {
  clientId: string
  base: Ymd
  current: GoalRow | null
  paces: PaceOpt[]
  activityFactors: ActOpt[]
  phaseName: string | null
  onDone: () => void
  onCancel?: () => void
}) {
  const inPhase2 = phaseName === PHASE_PRESETS[1].name
  const initial: DietPolicy = current && isDietPolicy(current.policy) && (!inPhase2 || DIET_POLICIES[current.policy].phase === 2) ? current.policy : inPhase2 ? 'loss' : 'recovery'
  const [v, setV] = useState<Required<PolicyInput>>({
    policy: initial,
    policyName: '',
    startDate: base,
    targetWeightKg: current?.targetWeightKg != null ? String(current.targetWeightKg) : '',
    paceKey: current?.paceKey ?? paces[0]?.key ?? '',
    activityFactor: current?.activityFactor != null ? String(current.activityFactor) : '',
    targetDate: current?.targetDate ?? '',
    endDate: '',
    reviewDate: '',
    note: '',
  })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<PolicyInput>) => setV((x) => ({ ...x, ...patch }))
  const p = v.policy as DietPolicy
  const rp = p === 'reverse' && v.endDate ? reversePeriods(v.startDate, v.endDate, v.targetDate || null) : null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    const r = await savePolicyAction(clientId, v)
    setPending(false)
    if (!r.ok) return setError(r.message)
    onDone()
  }

  const chip = (k: DietPolicy) => (
    <button key={k} type="button" onClick={() => set({ policy: k })} aria-pressed={p === k} className={cn('h-11 rounded-full px-4 text-sm font-bold ring-1', p === k ? 'bg-dark text-white ring-dark' : 'bg-white text-ink-2 ring-line-2 hover:bg-soft')}>
      {DIET_POLICIES[k].label}
    </button>
  )
  const activity = (
    <Field label={p === 'loss' ? '活動係数' : '活動係数（任意）'} required={p === 'loss'}>
      <select value={v.activityFactor} onChange={(e) => set({ activityFactor: e.target.value })} className={inputClass}>
        <option value="">{p === 'loss' ? '選んでください' : '入れない'}</option>
        {activityFactors.map((a) => (
          <option key={a.value} value={String(a.value)}>
            {a.value}（{a.label}）
          </option>
        ))}
      </select>
    </Field>
  )
  const date = (key: 'targetDate' | 'endDate' | 'reviewDate', label: string, hint?: string, required?: boolean) => (
    <Field label={label} hint={hint} required={required}>
      <input type="date" value={v[key]} min={v.startDate} onChange={(e) => set({ [key]: e.target.value })} className={inputClass} />
    </Field>
  )
  const weight = (label: string, required?: boolean) => (
    <Field label={label} required={required}>
      <input value={v.targetWeightKg} onChange={(e) => set({ targetWeightKg: e.target.value })} inputMode="decimal" placeholder="kg" className={numInputClass} />
    </Field>
  )

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        {[1, 2].map((ph) => (
          <div key={ph} className="flex flex-wrap items-center gap-1.5">
            <span className="w-20 flex-none text-xs font-black text-ink-3">フェーズ{ph}</span>
            {POLICY_KEYS.filter((k) => DIET_POLICIES[k].phase === ph).map(chip)}
          </div>
        ))}
        <p className="text-sm text-ink-2">{DIET_POLICIES[p].hint}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {p === 'other' && (
          <Field label="方針の名前" required>
            <input value={v.policyName} onChange={(e) => set({ policyName: e.target.value })} maxLength={30} placeholder="例：消化にやさしい食事" className={inputClass} />
          </Field>
        )}
        <Field label="開始日" required>
          <input type="date" value={v.startDate} onChange={(e) => set({ startDate: e.target.value })} required className={inputClass} />
        </Field>
        {p === 'reverse' && date('endDate', '終了予定日', '目標日から逆算して決める', true)}
        {p === 'loss' && weight('目標体重（kg）', true)}
        {p === 'loss' && (
          <Field label="減量ペース" required>
            <select value={v.paceKey} onChange={(e) => set({ paceKey: e.target.value })} className={inputClass}>
              {paces.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.name}（現体重の−{x.percentPerMonth}%／月{x.note ? `・${x.note}` : ''}）
                </option>
              ))}
            </select>
          </Field>
        )}
        {p === 'maintain' && weight('維持したい体重（kg）')}
        {p !== 'maintain' && date('targetDate', '目標日', 'お客様の目標の日（方針を変えても引き継ぎます）')}
        {date('reviewDate', '見直し予定日', '過ぎるとお知らせに出ます')}
        {(p === 'loss' || p === 'maintain') && activity}
        {p !== 'loss' && p !== 'maintain' && weight('目標体重（任意）')}
        {p !== 'loss' && p !== 'maintain' && activity}
      </div>

      {rp && (
        <p className="rounded-lg bg-white px-3 py-2 text-sm text-ink-2 ring-1 ring-line">
          開始から終了予定まで <span className="num font-bold">{diffDays(v.startDate, v.endDate)}</span>日
          {rp.afterEnd != null && (
            <>
              。終了予定から目標日まで <span className="num font-bold">{rp.afterEnd}</span>日（約<span className="num font-bold">{Math.round(rp.afterEnd / 7)}</span>週）を減量に使えます
            </>
          )}
        </p>
      )}

      <Field label={p === 'maintain' ? '維持したい状態・理由・メモ' : '理由・メモ'} hint={p === 'maintain' ? '維持したい体重を入れないときは、ここに維持したい状態を書きます' : undefined}>
        <textarea value={v.note} onChange={(e) => set({ note: e.target.value })} maxLength={300} rows={2} placeholder={p === 'reverse' ? '例：1,200kcalで体重が止まっているので、増やさずに摂取カロリーを上げる' : '例：胃腸の調子が戻ったのでバランス食へ'} className={inputClass} />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
          この方針で保存
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={buttonClass.ghost}>
            やめる
          </button>
        )}
        {error && (
          <p role="alert" className="w-full text-sm font-bold text-danger">
            {error}
          </p>
        )}
      </div>
    </form>
  )
}
