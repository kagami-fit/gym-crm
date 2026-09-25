'use client'

import { useActionState } from 'react'
import { Card, Field, inputClass, numInputClass } from '@/components/ui'
import { FormMessage, SubmitButton, type ActionState } from '@/components/SubmitButton'
import { GENDERS, PURPOSES, REFERRALS, STATUSES } from '@/lib/labels'
import { cn } from '@/lib/utils'

export type ClientDefaults = {
  name?: string
  kana?: string | null
  memberNo?: string | null
  gender?: string | null
  birthDate?: string | null
  heightCm?: number | null
  phone?: string | null
  email?: string | null
  address?: string | null
  occupation?: string | null
  emergencyName?: string | null
  emergencyRelation?: string | null
  emergencyPhone?: string | null
  status?: string
  joinedOn?: string | null
  leftOn?: string | null
  trainerId?: string | null
  referral?: string | null
  purposes?: string[]
  note?: string | null
}

export type InitialGoalOptions = {
  today: string
  paces: Array<{ key: string; name: string; percentPerMonth: number; note: string }>
  activityFactors: Array<{ value: number; label: string }>
  prefill?: { weightKg?: string; bodyFatPct?: string; targetWeightKg?: string; paceKey?: string; activityFactor?: string }
}

export const pillClass =
  'inline-flex min-h-10 cursor-pointer items-center rounded-full border border-line-2 bg-white px-4 py-2 text-sm font-bold text-ink-2 has-[:checked]:border-brand-deep has-[:checked]:bg-brand has-[:checked]:text-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand'

export function Pills({ name, options, defaultValue, type = 'radio' }: { name: string; options: Array<{ value: string; label: string }>; defaultValue?: string | string[] | null; type?: 'radio' | 'checkbox' }) {
  const selected = Array.isArray(defaultValue) ? defaultValue : defaultValue ? [defaultValue] : []
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label key={o.value} className={pillClass}>
          <input type={type} name={name} value={o.value} defaultChecked={selected.includes(o.value)} className="sr-only" />
          {o.label}
        </label>
      ))}
    </div>
  )
}

export function ClientForm({
  action,
  defaults = {},
  staff,
  initialGoal,
  submitLabel,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  defaults?: ClientDefaults
  staff: Array<{ id: string; name: string }>
  initialGoal?: InitialGoalOptions
  submitLabel: string
}) {
  const [state, formAction] = useActionState(action, null)
  const d = defaults

  return (
    <form action={formAction} className="space-y-5">
      <Card title="基本情報">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="氏名" required>
            <input name="name" required maxLength={60} defaultValue={d.name ?? ''} className={inputClass} autoComplete="off" />
          </Field>
          <Field label="ふりがな">
            <input name="kana" maxLength={60} defaultValue={d.kana ?? ''} className={inputClass} autoComplete="off" />
          </Field>
          <Field label="会員番号" hint="空欄でも登録できます">
            <input name="memberNo" maxLength={30} defaultValue={d.memberNo ?? ''} className={inputClass} autoComplete="off" />
          </Field>
          <Field label="性別" className="sm:col-span-2 lg:col-span-1">
            <Pills name="gender" defaultValue={d.gender} options={Object.entries(GENDERS).map(([value, label]) => ({ value, label }))} />
          </Field>
          <Field label="生年月日">
            <input type="date" name="birthDate" defaultValue={d.birthDate ?? ''} className={inputClass} />
          </Field>
          <Field label="身長（cm）">
            <input name="heightCm" inputMode="decimal" defaultValue={d.heightCm ?? ''} className={numInputClass} placeholder="165.0" />
          </Field>
        </div>
      </Card>

      <Card title="利用状況">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="ステータス">
            <select name="status" defaultValue={d.status ?? 'active'} className={inputClass}>
              {Object.entries(STATUSES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="入会日">
            <input type="date" name="joinedOn" defaultValue={d.joinedOn ?? ''} className={inputClass} />
          </Field>
          <Field label="退会日">
            <input type="date" name="leftOn" defaultValue={d.leftOn ?? ''} className={inputClass} />
          </Field>
          <Field label="担当トレーナー">
            <select name="trainerId" defaultValue={d.trainerId ?? ''} className={inputClass}>
              <option value="">未設定</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="来店のきっかけ">
            <select name="referral" defaultValue={d.referral ?? ''} className={inputClass}>
              <option value="">未設定</option>
              {REFERRALS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="text-sm font-bold text-ink">目的（複数可）</p>
            <div className="mt-1.5">
              <Pills type="checkbox" name="purposes" defaultValue={d.purposes ?? []} options={PURPOSES.map((p) => ({ value: p, label: p }))} />
            </div>
          </div>
        </div>
      </Card>

      <Card title="連絡先">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="電話番号">
            <input name="phone" type="tel" defaultValue={d.phone ?? ''} className={inputClass} autoComplete="off" />
          </Field>
          <Field label="メールアドレス">
            <input name="email" type="email" defaultValue={d.email ?? ''} className={inputClass} autoComplete="off" />
          </Field>
          <Field label="職業">
            <input name="occupation" defaultValue={d.occupation ?? ''} className={inputClass} placeholder="例：会社員（デスクワーク）" />
          </Field>
          <Field label="住所" className="sm:col-span-2 lg:col-span-3">
            <input name="address" defaultValue={d.address ?? ''} className={inputClass} autoComplete="off" />
          </Field>
          <Field label="緊急連絡先（氏名）">
            <input name="emergencyName" defaultValue={d.emergencyName ?? ''} className={inputClass} autoComplete="off" />
          </Field>
          <Field label="続柄">
            <input name="emergencyRelation" defaultValue={d.emergencyRelation ?? ''} className={inputClass} placeholder="例：配偶者" />
          </Field>
          <Field label="緊急連絡先（電話）">
            <input name="emergencyPhone" type="tel" defaultValue={d.emergencyPhone ?? ''} className={inputClass} autoComplete="off" />
          </Field>
        </div>
      </Card>

      <Card title="メモ">
        <textarea name="note" rows={3} maxLength={2000} defaultValue={d.note ?? ''} className={inputClass} placeholder="来店しやすい曜日・時間帯、配慮が必要なことなど" />
      </Card>

      {initialGoal && (
        <Card title="最初の測定と目標" description="あとから「体重・目標」タブでも入力できます">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="測定日">
              <input type="date" name="measuredOn" defaultValue={initialGoal.today} className={inputClass} />
            </Field>
            <Field label="体重（kg）">
              <input name="weightKg" inputMode="decimal" defaultValue={initialGoal.prefill?.weightKg ?? ''} className={numInputClass} placeholder="65.0" />
            </Field>
            <Field label="体脂肪率（%）">
              <input name="bodyFatPct" inputMode="decimal" defaultValue={initialGoal.prefill?.bodyFatPct ?? ''} className={numInputClass} placeholder="25.0" />
            </Field>
            <Field label="目標体重（kg）">
              <input name="targetWeightKg" inputMode="decimal" defaultValue={initialGoal.prefill?.targetWeightKg ?? ''} className={numInputClass} placeholder="60.0" />
            </Field>
            <Field label="減量ペース">
              <select name="paceKey" defaultValue={initialGoal.prefill?.paceKey ?? initialGoal.paces[0]?.key} className={inputClass}>
                {initialGoal.paces.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name}（現体重の−{p.percentPerMonth}%／月{p.note ? `・${p.note}` : ''}）
                  </option>
                ))}
              </select>
            </Field>
            <Field label="活動係数">
              <select name="activityFactor" defaultValue={initialGoal.prefill?.activityFactor ?? String(initialGoal.activityFactors[0]?.value)} className={inputClass}>
                {initialGoal.activityFactors.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.value}（{a.label}）
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Card>
      )}

      <div className={cn('sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white/95 px-4 py-3 backdrop-blur')}>
        <SubmitButton pendingText="保存しています">{submitLabel}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  )
}
