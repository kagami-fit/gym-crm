'use client'

import { useActionState } from 'react'
import { Card, Field, inputClass } from '@/components/ui'
import { Pills } from '@/components/ClientForm'
import { FormMessage, SubmitButton, type ActionState } from '@/components/SubmitButton'
import { QUESTIONNAIRE, detailKey, type QAnswers } from '@/lib/questionnaire'

export function QuestionnaireForm({ action, answers, answeredOn }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; answers: QAnswers; answeredOn: string }) {
  const [state, formAction] = useActionState(action, null)
  const text = (k: string) => (typeof answers[k] === 'string' ? (answers[k] as string) : '')
  return (
    <form action={formAction} className="space-y-5">
      <Card>
        <Field label="記入日" className="max-w-xs">
          <input type="date" name="answeredOn" defaultValue={answeredOn} className={inputClass} />
        </Field>
      </Card>
      {QUESTIONNAIRE.map((section) => (
        <Card key={section.key} title={section.title}>
          <div className="space-y-5">
            {section.fields.map((f) => {
              if (f.type === 'checkbox')
                return (
                  <div key={f.key}>
                    <p className="text-sm font-bold">{f.label}</p>
                    <div className="mt-2">
                      <Pills type="checkbox" name={f.key} defaultValue={Array.isArray(answers[f.key]) ? (answers[f.key] as string[]) : []} options={f.options.map((o) => ({ value: o, label: o }))} />
                    </div>
                  </div>
                )
              if (f.type === 'radio')
                return (
                  <div key={f.key}>
                    <p className="text-sm font-bold">{f.label}</p>
                    <div className="mt-2">
                      <Pills name={f.key} defaultValue={text(f.key)} options={f.options.map((o) => ({ value: o, label: o }))} />
                    </div>
                  </div>
                )
              if (f.type === 'yesno')
                return (
                  <div key={f.key} className="grid gap-2 sm:grid-cols-[minmax(14rem,22rem)_1fr] sm:items-start">
                    <div>
                      <p className="text-sm font-bold">{f.label}</p>
                      <div className="mt-2">
                        <Pills name={f.key} defaultValue={text(f.key)} options={[{ value: 'なし', label: 'なし' }, { value: 'あり', label: 'あり' }]} />
                      </div>
                    </div>
                    <input name={detailKey(f.key)} defaultValue={text(detailKey(f.key))} maxLength={500} className={`${inputClass} sm:mt-7`} placeholder={`「あり」の場合：${f.detailPlaceholder ?? '詳細'}`} aria-label={`${f.label}の詳細`} />
                  </div>
                )
              if (f.type === 'textarea')
                return (
                  <Field key={f.key} label={f.label}>
                    <textarea name={f.key} defaultValue={text(f.key)} rows={3} maxLength={2000} className={inputClass} placeholder={f.placeholder} />
                  </Field>
                )
              return (
                <Field key={f.key} label={f.label}>
                  <input name={f.key} defaultValue={text(f.key)} maxLength={300} className={inputClass} placeholder={f.placeholder} />
                </Field>
              )
            })}
          </div>
        </Card>
      ))}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white/95 px-4 py-3 backdrop-blur">
        <SubmitButton pendingText="保存しています">問診票を保存</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  )
}
