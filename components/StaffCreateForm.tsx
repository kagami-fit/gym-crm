'use client'

import { useActionState } from 'react'
import { UserPlus } from 'lucide-react'
import { Field, inputClass } from '@/components/ui'
import { FormMessage, SubmitButton, type ActionState } from '@/components/SubmitButton'

export function StaffCreateForm({ action }: { action: (p: ActionState, fd: FormData) => Promise<ActionState> }) {
  const [state, formAction] = useActionState(action, null)
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="名前">
          <input name="name" required maxLength={40} className={inputClass} autoComplete="off" />
        </Field>
        <Field label="メールアドレス">
          <input name="email" type="email" required className={inputClass} autoComplete="off" />
        </Field>
        <Field label="パスワード" hint="10文字以上">
          <input name="password" type="password" required minLength={10} className={inputClass} autoComplete="new-password" />
        </Field>
        <Field label="権限">
          <select name="role" className={inputClass} defaultValue="staff">
            <option value="staff">スタッフ（顧客の閲覧・記録）</option>
            <option value="owner">オーナー（設定・スタッフ管理も可）</option>
          </select>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="作成しています">
          <UserPlus className="size-4" aria-hidden />
          アカウントを作成
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  )
}
