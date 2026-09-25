import { Trash2 } from 'lucide-react'
import { ConfirmSubmit } from '@/components/ConfirmSubmit'
import { StaffCreateForm } from '@/components/StaffCreateForm'
import { Badge, Card, buttonClass, inputClass } from '@/components/ui'
import { listStaff } from '@/lib/data/clients'
import { requireUser } from '@/lib/session'
import { cn } from '@/lib/utils'
import { createStaffAction, deleteStaffAction, updateStaffAction } from './actions'

export const metadata = { title: 'スタッフ' }

export default async function StaffPage() {
  const user = await requireUser()
  const canEdit = user.role === 'owner'
  const staff = await listStaff()
  return (
    <div className="space-y-5">
      {canEdit && (
        <Card title="アカウントを作成" description="この画面から作ったアカウントだけがログインできます（誰でも登録できる入口はありません）">
          <StaffCreateForm action={createStaffAction} />
        </Card>
      )}
      <Card title="スタッフ一覧">
        <ul className="divide-y divide-line">
          {staff.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-48 flex-1">
                <p className="font-bold">
                  {s.name}
                  {s.id === user.id && (
                    <Badge tone="brand" className="ml-2">
                      自分
                    </Badge>
                  )}
                </p>
                <p className="text-sm text-ink-3">{s.email}</p>
              </div>
              {canEdit ? (
                <>
                  <form action={updateStaffAction.bind(null, s.id)} className="flex flex-wrap items-center gap-2">
                    <select name="role" defaultValue={s.role} disabled={s.id === user.id} className={cn(inputClass, 'w-36 py-1.5 text-sm')} aria-label="権限">
                      <option value="staff">スタッフ</option>
                      <option value="owner">オーナー</option>
                    </select>
                    <input name="password" type="password" minLength={10} placeholder="新しいパスワード（変更時のみ）" className={cn(inputClass, 'w-60 py-1.5 text-sm')} autoComplete="new-password" aria-label="新しいパスワード" />
                    <button type="submit" className={buttonClass.small}>
                      保存
                    </button>
                  </form>
                  {s.id !== user.id && (
                    <ConfirmSubmit action={deleteStaffAction.bind(null, s.id)} message={`${s.name} さんのアカウントを削除しますか？`} className={buttonClass.danger}>
                      <Trash2 className="size-4" aria-hidden />
                    </ConfirmSubmit>
                  )}
                </>
              ) : (
                <Badge tone={s.role === 'owner' ? 'dark' : 'neutral'}>{s.role === 'owner' ? 'オーナー' : 'スタッフ'}</Badge>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
