import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { ConfirmSubmit } from '@/components/ConfirmSubmit'
import { ExerciseAddForm } from '@/components/ExerciseAddForm'
import { Badge, Card, Section, buttonClass, inputClass } from '@/components/ui'
import { getCalcSettings } from '@/lib/data/settings'
import { getExercises } from '@/lib/data/training'
import { requireUser } from '@/lib/session'
import { cn } from '@/lib/utils'
import { addExerciseAction, deleteExerciseAction, moveExerciseAction, updateExerciseAction } from './actions'

export const metadata = { title: '種目マスタ' }

export default async function ExercisesPage() {
  const user = await requireUser()
  const canEdit = user.role === 'owner'
  const [settings, exercises] = await Promise.all([getCalcSettings(), getExercises(false)])
  const parts = [...settings.bodyParts, ...[...new Set(exercises.map((e) => e.bodyPart))].filter((p) => !settings.bodyParts.includes(p))]

  return (
    <div className="space-y-5">
      {canEdit && (
        <Card title="種目を追加" description="トレーニング記録の「種目」の選択肢になります。一覧にない種目は、記録画面で「その他（自由入力）」でも入れられます">
          <ExerciseAddForm action={addExerciseAction} bodyParts={settings.bodyParts} />
        </Card>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        {parts.map((part) => {
          const list = exercises.filter((e) => e.bodyPart === part)
          return (
            <Section key={part} title={part} aside={<span className="text-white/80">{list.length}種目</span>} bodyClassName="p-3">
              <ul className="divide-y divide-line">
                {list.map((e, i) => (
                  <li key={e.id} className={cn('flex items-center gap-2 py-1.5', !e.active && 'opacity-60')}>
                    {canEdit ? (
                      <>
                        <form action={updateExerciseAction.bind(null, e.id)} className="flex min-w-0 flex-1 items-center gap-2">
                          <input name="name" defaultValue={e.name} maxLength={60} className={cn(inputClass, 'py-1 text-sm')} aria-label="種目名" />
                          <label className="flex flex-none items-center gap-1 text-xs font-bold text-ink-2">
                            <input type="checkbox" name="active" defaultChecked={e.active} className="accent-[#c98500]" />
                            使用中
                          </label>
                          <button type="submit" className={buttonClass.small}>
                            保存
                          </button>
                        </form>
                        <form action={moveExerciseAction.bind(null, e.id, -1)}>
                          <button type="submit" disabled={i === 0} className={cn(buttonClass.ghost, 'px-1.5')} aria-label="上へ">
                            <ArrowUp className="size-4" aria-hidden />
                          </button>
                        </form>
                        <form action={moveExerciseAction.bind(null, e.id, 1)}>
                          <button type="submit" disabled={i === list.length - 1} className={cn(buttonClass.ghost, 'px-1.5')} aria-label="下へ">
                            <ArrowDown className="size-4" aria-hidden />
                          </button>
                        </form>
                        <ConfirmSubmit action={deleteExerciseAction.bind(null, e.id)} message={`「${e.name}」を種目マスタから削除しますか？（過去の記録は残ります）`} className={cn(buttonClass.danger, 'px-1.5')}>
                          <Trash2 className="size-4" aria-hidden />
                        </ConfirmSubmit>
                      </>
                    ) : (
                      <span className="flex-1 px-1 text-sm">
                        {e.name}
                        {!e.active && (
                          <Badge tone="muted" className="ml-2">
                            使用停止
                          </Badge>
                        )}
                      </span>
                    )}
                  </li>
                ))}
                {list.length === 0 && <li className="py-3 text-center text-sm text-ink-3">種目がありません</li>}
              </ul>
            </Section>
          )
        })}
      </div>
    </div>
  )
}
