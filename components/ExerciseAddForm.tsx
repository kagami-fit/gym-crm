'use client'

import { useActionState } from 'react'
import { Plus } from 'lucide-react'
import { inputClass } from '@/components/ui'
import { FormMessage, SubmitButton, type ActionState } from '@/components/SubmitButton'

export function ExerciseAddForm({ action, bodyParts }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; bodyParts: string[] }) {
  const [state, formAction] = useActionState(action, null)
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="text-sm font-bold">
        部位
        <select name="bodyPart" className={`${inputClass} mt-1 w-32`}>
          {bodyParts.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      <label className="min-w-64 flex-1 text-sm font-bold">
        種目名
        <input name="name" required maxLength={60} className={`${inputClass} mt-1`} placeholder="例：ヒップスラスト" />
      </label>
      <SubmitButton pendingText="追加しています">
        <Plus className="size-4" aria-hidden />
        追加
      </SubmitButton>
      <div className="w-full">
        <FormMessage state={state} />
      </div>
    </form>
  )
}
