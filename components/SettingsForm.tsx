'use client'

import { useActionState, useMemo, useState } from 'react'
import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Card, Field, Notice, buttonClass, inputClass, numInputClass } from '@/components/ui'
import { FormMessage, SubmitButton, type ActionState } from '@/components/SubmitButton'
import { plan } from '@/lib/calc/body'
import { estimate1RM } from '@/lib/calc/training'
import { BMR_METHODS, DEFAULT_SETTINGS, ONE_RM_METHODS, PROTEIN_BASES, type BmrMethod, type CalcSettings, type OneRmMethod } from '@/lib/calc/settings'
import { int, num } from '@/lib/format'
import { cn } from '@/lib/utils'

const toNum = (v: string) => {
  const x = Number(v)
  return v.trim() !== '' && Number.isFinite(x) ? x : NaN
}
const newId = () => `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`

function fromSettings(s: CalcSettings) {
  return {
    bmrMethod: s.bmrMethod,
    bmrLbmFactor: String(s.bmrLbmFactor),
    proteinBasis: s.proteinBasis,
    proteinPerKg: String(s.proteinPerKg),
    fatRatioPct: String(s.fatRatioPct),
    kcalPerKgFat: String(s.kcalPerKgFat),
    waterMlPerKg: String(s.waterMlPerKg),
    meatProteinPer100g: String(s.meatProteinPer100g),
    riceCarbsPer100g: String(s.riceCarbsPer100g),
    oneRmMethod: s.oneRmMethod,
    recentSessionCount: String(s.recentSessionCount),
    paces: s.paces.map((p) => ({ key: p.key, name: p.name, percentPerMonth: String(p.percentPerMonth), note: p.note })),
    activity: s.activityFactors.map((a) => ({ id: newId(), value: String(a.value), label: a.label })),
  }
}

export function SettingsForm({ settings, canEdit, action }: { settings: CalcSettings; canEdit: boolean; action: (p: ActionState, fd: FormData) => Promise<ActionState> }) {
  const [state, formAction] = useActionState(action, null)
  const [f, setF] = useState(() => fromSettings(settings))
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))

  const draft: CalcSettings = useMemo(
    () => ({
      ...settings,
      bmrMethod: f.bmrMethod as BmrMethod,
      bmrLbmFactor: toNum(f.bmrLbmFactor),
      proteinBasis: f.proteinBasis as 'lbm' | 'weight',
      proteinPerKg: toNum(f.proteinPerKg),
      fatRatioPct: toNum(f.fatRatioPct),
      kcalPerKgFat: toNum(f.kcalPerKgFat),
      waterMlPerKg: toNum(f.waterMlPerKg),
      meatProteinPer100g: toNum(f.meatProteinPer100g),
      riceCarbsPer100g: toNum(f.riceCarbsPer100g),
      oneRmMethod: f.oneRmMethod as OneRmMethod,
      recentSessionCount: toNum(f.recentSessionCount),
      paces: f.paces.map((p) => ({ key: p.key, name: p.name.trim(), percentPerMonth: toNum(p.percentPerMonth), note: p.note.trim() })),
      activityFactors: f.activity.map((a) => ({ value: toNum(a.value), label: a.label.trim() })),
    }),
    [f, settings],
  )

  // 見本（参考シートのデモの数値）で、設定を変えると何が変わるかをその場で確認する
  const samplePace = draft.paces[0]
  const sampleAct = draft.activityFactors[0]
  const preview = useMemo(() => {
    const pace = draft.paces[0]
    const act = draft.activityFactors[0]
    try {
      return plan(draft, { weightKg: 67.2, bodyFatPct: 17.6, heightCm: 175.5, age: 37, gender: 'male' }, {
        targetWeightKg: 65,
        pace: pace && Number.isFinite(pace.percentPerMonth) ? pace : null,
        activityFactor: act && Number.isFinite(act.value) ? act.value : null,
      })
    } catch {
      return null
    }
  }, [draft])
  const rm = estimate1RM(draft.oneRmMethod, 60, 10)

  const radio = (name: string, value: string, current: string, onChange: (v: string) => void, label: string, note?: string) => (
    <label key={value} className={cn('flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5', current === value ? 'border-brand-deep bg-brand-soft' : 'border-line bg-white hover:bg-soft')}>
      <input type="radio" name={name} value={value} checked={current === value} onChange={() => onChange(value)} disabled={!canEdit} className="mt-1 accent-[#c98500]" />
      <span>
        <span className="block text-sm font-bold">{label}</span>
        {note && <span className="block text-xs text-ink-3">{note}</span>}
      </span>
    </label>
  )

  return (
    <form action={formAction} className="grid gap-5 xl:grid-cols-[1fr_22rem]">
      <input type="hidden" name="payload" value={JSON.stringify(draft)} />
      <div className="space-y-5">
        {!canEdit && <Notice tone="info">閲覧のみです。変更はオーナーのアカウントで行ってください。</Notice>}
        <fieldset disabled={!canEdit} className="space-y-5">
          <Card title="基礎代謝の計算式">
            <div className="grid gap-2 sm:grid-cols-2">{Object.entries(BMR_METHODS).map(([k, m]) => radio('bmr', k, f.bmrMethod, (v) => set('bmrMethod', v as BmrMethod), m.label, m.note))}</div>
            {f.bmrMethod === 'lbm' && (
              <Field label="係数（除脂肪体重1kgあたりのkcal）" className="mt-4 max-w-xs">
                <input value={f.bmrLbmFactor} onChange={(e) => set('bmrLbmFactor', e.target.value)} inputMode="decimal" className={numInputClass} />
              </Field>
            )}
          </Card>

          <Card title="目標の栄養バランス" description="炭水化物は「目標カロリー − たんぱく質 − 脂質」の残りで自動計算します">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="たんぱく質の基準">
                <select value={f.proteinBasis} onChange={(e) => set('proteinBasis', e.target.value as 'lbm' | 'weight')} className={inputClass}>
                  {Object.entries(PROTEIN_BASES).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="たんぱく質（g／kg）">
                <input value={f.proteinPerKg} onChange={(e) => set('proteinPerKg', e.target.value)} inputMode="decimal" className={numInputClass} />
              </Field>
              <Field label="脂質（目標カロリーの%）">
                <input value={f.fatRatioPct} onChange={(e) => set('fatRatioPct', e.target.value)} inputMode="decimal" className={numInputClass} />
              </Field>
              <Field label="水分（ml／体重kg）">
                <input value={f.waterMlPerKg} onChange={(e) => set('waterMlPerKg', e.target.value)} inputMode="decimal" className={numInputClass} />
              </Field>
              <Field label="肉・魚100gのたんぱく質（g）" hint="食材の目安量の計算用">
                <input value={f.meatProteinPer100g} onChange={(e) => set('meatProteinPer100g', e.target.value)} inputMode="decimal" className={numInputClass} />
              </Field>
              <Field label="炊いたご飯100gの炭水化物（g）" hint="食材の目安量の計算用">
                <input value={f.riceCarbsPer100g} onChange={(e) => set('riceCarbsPer100g', e.target.value)} inputMode="decimal" className={numInputClass} />
              </Field>
            </div>
          </Card>

          <Card title="減量ペース" description="1日の削減カロリー ＝ 現体重 × ペース(%) × 体脂肪1kgのカロリー ÷ 30">
            <div className="space-y-2">
              <div className="hidden grid-cols-[8rem_7rem_1fr_2.5rem] gap-2 px-1 text-xs font-bold text-ink-3 sm:grid">
                <span>名前</span>
                <span className="text-right">現体重の%／月</span>
                <span>説明</span>
                <span />
              </div>
              {f.paces.map((p, i) => (
                <div key={p.key} className="grid grid-cols-[1fr_6rem_2.5rem] gap-2 sm:grid-cols-[8rem_7rem_1fr_2.5rem]">
                  <input value={p.name} onChange={(e) => set('paces', f.paces.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} maxLength={20} className={inputClass} aria-label="ペースの名前" />
                  <input value={p.percentPerMonth} onChange={(e) => set('paces', f.paces.map((x, j) => (j === i ? { ...x, percentPerMonth: e.target.value } : x)))} inputMode="decimal" className={numInputClass} aria-label="月あたりの%" />
                  <input value={p.note} onChange={(e) => set('paces', f.paces.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} maxLength={60} className={cn(inputClass, 'col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto')} placeholder="例：リスク小" aria-label="説明" />
                  <button type="button" onClick={() => set('paces', f.paces.filter((_, j) => j !== i))} disabled={f.paces.length <= 1} className={buttonClass.danger} aria-label={`${p.name}を削除`}>
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => set('paces', [...f.paces, { key: newId(), name: '', percentPerMonth: '', note: '' }])} className={buttonClass.secondary}>
                <Plus className="size-4" aria-hidden />
                ペースを追加
              </button>
            </div>
          </Card>

          <Card title="活動係数の選択肢" description="消費カロリー ＝ 基礎代謝 × 活動係数">
            <div className="space-y-2">
              {f.activity.map((a, i) => (
                <div key={a.id} className="grid grid-cols-[6rem_1fr_2.5rem] gap-2">
                  <input value={a.value} onChange={(e) => set('activity', f.activity.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} inputMode="decimal" className={numInputClass} aria-label="係数" />
                  <input value={a.label} onChange={(e) => set('activity', f.activity.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} maxLength={80} className={inputClass} aria-label="説明" />
                  <button type="button" onClick={() => set('activity', f.activity.filter((_, j) => j !== i))} disabled={f.activity.length <= 1} className={buttonClass.danger} aria-label="この係数を削除">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => set('activity', [...f.activity, { id: newId(), value: '', label: '' }])} className={buttonClass.secondary}>
                <Plus className="size-4" aria-hidden />
                係数を追加
              </button>
            </div>
          </Card>

          <Card title="その他">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="体脂肪1kgあたりのカロリー（kcal）">
                <input value={f.kcalPerKgFat} onChange={(e) => set('kcalPerKgFat', e.target.value)} inputMode="numeric" className={numInputClass} />
              </Field>
              <Field label="トレーニングのグラフに出す回数" hint="直近何回分を表示するか">
                <input value={f.recentSessionCount} onChange={(e) => set('recentSessionCount', e.target.value)} inputMode="numeric" className={numInputClass} />
              </Field>
            </div>
            <p className="mt-5 text-sm font-bold">推定1RM（最大挙上重量）の式</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">{Object.entries(ONE_RM_METHODS).map(([k, m]) => radio('onerm', k, f.oneRmMethod, (v) => set('oneRmMethod', v as OneRmMethod), m.label, m.note))}</div>
          </Card>
        </fieldset>
      </div>

      <aside className="space-y-3 xl:sticky xl:top-6 xl:self-start">
        <Card title="計算の見本" description={`身長175.5cm・体重67.2kg・体脂肪率17.6%・37歳男性・目標65kg・${samplePace?.name || '（ペース）'}・活動係数${sampleAct ? num(sampleAct.value) : '—'} の場合`}>
          <dl className="space-y-1.5 text-sm">
            {[
              ['基礎代謝', preview?.bmr, 'kcal', 0],
              ['消費カロリー', preview?.tdee, 'kcal', 0],
              ['1日の削減カロリー', preview?.dailyDeficit, 'kcal', 0],
              ['目標カロリー', preview?.targetKcal, 'kcal', 0],
              ['たんぱく質', preview?.proteinG, 'g', 1],
              ['脂質', preview?.fatG, 'g', 1],
              ['炭水化物', preview?.carbsG, 'g', 1],
              ['水分', preview?.waterMl, 'ml', 0],
              ['目標達成まで', preview?.daysToGoal != null ? Math.ceil(preview.daysToGoal) : null, '日', 0],
            ].map(([label, v, unit, d]) => (
              <div key={String(label)} className={cn('flex items-baseline justify-between rounded-lg px-3 py-1.5', label === '目標カロリー' ? 'bg-brand-soft' : 'bg-soft')}>
                <dt className="font-bold text-ink-2">{label as string}</dt>
                <dd>
                  <span className="num font-semibold">{d === 0 ? int(v as number | null) : num(v as number | null, 1)}</span>
                  <span className="ml-0.5 text-xs text-ink-3">{unit as string}</span>
                </dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between rounded-lg bg-soft px-3 py-1.5">
              <dt className="font-bold text-ink-2">60kg×10回の推定1RM</dt>
              <dd>
                <span className="num font-semibold">{num(rm)}</span>
                <span className="ml-0.5 text-xs text-ink-3">kg</span>
              </dd>
            </div>
          </dl>
          {preview?.warnings.map((w) => (
            <p key={w} className="mt-2 text-xs text-danger">
              {w}
            </p>
          ))}
        </Card>
        {canEdit && (
          <div className="space-y-2 rounded-2xl border border-line bg-white p-4">
            <SubmitButton className="w-full" pendingText="保存しています">
              設定を保存
            </SubmitButton>
            <button type="button" onClick={() => confirm('初期値（参考シートと同じ設定）に戻しますか？保存するまで反映されません') && setF(fromSettings(DEFAULT_SETTINGS))} className={cn(buttonClass.secondary, 'w-full')}>
              <RotateCcw className="size-4" aria-hidden />
              初期値に戻す
            </button>
            <FormMessage state={state} />
          </div>
        )}
      </aside>
    </form>
  )
}

