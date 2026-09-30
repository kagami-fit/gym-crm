'use client'

import { useActionState } from 'react'
import { FormMessage, SubmitButton, type ActionState } from '@/components/SubmitButton'
import { LEVEL_STYLE } from '@/components/alerts/Level'
import type { AlertSettings } from '@/lib/alerts/settings'
import { cn } from '@/lib/utils'

const numClass = 'h-11 w-24 rounded-xl border border-line-2 bg-white px-3 text-right text-base outline-none focus:border-brand-deep focus:ring-2 focus:ring-brand-soft disabled:bg-soft'

function Block({ name, title, description, enabled, disabled, children }: { name: string; title: string; description: string; enabled: boolean; disabled: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <label className="flex items-start gap-3">
        <input type="checkbox" name={`${name}.enabled`} defaultChecked={enabled} disabled={disabled} className="mt-1 size-5 accent-[var(--color-dark)]" />
        <span>
          <span className="block font-black">{title}</span>
          <span className="block text-sm text-ink-2">{description}</span>
        </span>
      </label>
      <div className="mt-3 pl-8">{children}</div>
    </section>
  )
}

/** 黄・橙・赤の3段階の値 */
function Steps({ name, values, unit, step, disabled }: { name: string; values: [number, number, number]; unit: string; step: number; disabled: boolean }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {(['info', 'warn', 'alert'] as const).map((lv, i) => {
        const { icon: Icon, label, chip } = LEVEL_STYLE[lv]
        return (
          <label key={lv} className="block text-sm font-bold">
            <span className={cn('mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs', chip)}>
              <Icon className="size-3.5" aria-hidden />
              {label}
            </span>
            <span className="flex items-center gap-1.5">
              <input type="number" name={`${name}.${i}`} defaultValue={values[i]} step={step} min={0} inputMode="decimal" disabled={disabled} className={numClass} />
              <span className="text-ink-2">{unit}</span>
            </span>
          </label>
        )
      })}
    </div>
  )
}

/** お知らせの条件と段階（オーナーだけ変更できる） */
export function AlertSettingsForm({ settings, canEdit, action }: { settings: AlertSettings; canEdit: boolean; action: (p: ActionState, fd: FormData) => Promise<ActionState> }) {
  const [state, formAction] = useActionState(action, null)
  const d = !canEdit
  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-ink-2">お知らせは3段階で出します（黄＝気づき：帯に小さく／橙＝要対応：一覧の上と顧客一覧に印／赤＝相談：オーナーと相談）。値が大きくなるほど重い段階です。</p>
      <Block name="plateau" title="体重の停滞" description="最低体重を何日更新していないか（減量の目標があるお客様。最近10日の記録がないときは出さない）" enabled={settings.plateau.enabled} disabled={d}>
        <Steps name="plateau.days" values={settings.plateau.days} unit="日" step={1} disabled={d} />
      </Block>
      <Block name="noProgress" title="伸びていない種目" description="今やっている種目で、同じ重さ×回数が何回続いたか" enabled={settings.noProgress.enabled} disabled={d}>
        <Steps name="noProgress.counts" values={settings.noProgress.counts} unit="回" step={1} disabled={d} />
        <label className="mt-3 flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" name="noProgress.skipBodyweight" defaultChecked={settings.noProgress.skipBodyweight} disabled={d} className="size-5 accent-[var(--color-dark)]" />
          自重の種目は数えない
        </label>
      </Block>
      <Block name="dietFlat" title="食事の変化なし" description="体重が停滞していて、週ごとの食事の数字（平均カロリー・PFC）がほぼ同じとき。橙で出す" enabled={settings.dietFlat.enabled} disabled={d}>
        <div className="flex flex-wrap items-end gap-4">
          <label className="block text-sm font-bold">
            何週間
            <span className="mt-1 flex items-center gap-1.5">
              <input type="number" name="dietFlat.weeks" defaultValue={settings.dietFlat.weeks} min={2} max={8} step={1} disabled={d} className={numClass} />
              <span className="text-ink-2">週</span>
            </span>
          </label>
          <label className="block text-sm font-bold">
            差がこの割合以内
            <span className="mt-1 flex items-center gap-1.5">
              <input type="number" name="dietFlat.pct" defaultValue={settings.dietFlat.pct} min={1} max={20} step={1} disabled={d} className={numClass} />
              <span className="text-ink-2">%</span>
            </span>
          </label>
        </div>
      </Block>
      <Block name="noVisit" title="来店があいている" description="最後の来店から何日たったか（在籍中のお客様）" enabled={settings.noVisit.enabled} disabled={d}>
        <Steps name="noVisit.days" values={settings.noVisit.days} unit="日" step={1} disabled={d} />
      </Block>
      <Block name="behindPace" title="予定ペースより遅れ" description="目標の減量ペースどおりなら今この体重、との差" enabled={settings.behindPace.enabled} disabled={d}>
        <Steps name="behindPace.kg" values={settings.behindPace.kg} unit="kg" step={0.1} disabled={d} />
      </Block>
      <Block name="talk" title="気になる会話メモ" description="「ネガティブ」「身体の変化」の会話メモを、書いてから何日間知らせるか（黄で出す）" enabled={settings.talk.enabled} disabled={d}>
        <label className="block text-sm font-bold">
          <span className="flex items-center gap-1.5">
            <input type="number" name="talk.days" defaultValue={settings.talk.days} min={1} max={60} step={1} disabled={d} className={numClass} />
            <span className="text-ink-2">日間</span>
          </span>
        </label>
      </Block>
      {canEdit && (
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <SubmitButton pendingText="保存しています">保存</SubmitButton>
          <FormMessage state={state} />
        </div>
      )}
    </form>
  )
}
