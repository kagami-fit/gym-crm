import { Trash2 } from 'lucide-react'
import { ClientForm } from '@/components/ClientForm'
import { ConfirmSubmit } from '@/components/ConfirmSubmit'
import { Card } from '@/components/ui'
import { getClient, listStaff } from '@/lib/data/clients'
import { fromDbDate } from '@/lib/dates'
import { requireUser } from '@/lib/session'
import { deleteClientAction, updateClientAction } from '../../actions'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return { title: `${(await getClient(id)).name}｜台帳` }
}

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  const { id } = await params
  const [c, staff] = await Promise.all([getClient(id), listStaff()])
  const ymd = (d: Date | null) => (d ? fromDbDate(d) : null)
  return (
    <div className="space-y-5">
      <ClientForm
        action={updateClientAction.bind(null, id)}
        staff={staff}
        submitLabel="台帳を保存"
        defaults={{
          ...c,
          birthDate: ymd(c.birthDate),
          joinedOn: ymd(c.joinedOn),
          leftOn: ymd(c.leftOn),
        }}
      />
      {user.role === 'owner' && (
        <Card title="顧客の削除" description="体重・目標・トレーニング・食事メモ・問診票もすべて消えます。退会の場合は削除せず、ステータスを「退会」にしてください。">
          <ConfirmSubmit action={deleteClientAction.bind(null, id)} message={`${c.name} さんのデータをすべて削除します。元に戻せません。よろしいですか？`} className="inline-flex h-10 items-center gap-2 rounded-full border border-danger/40 px-4 text-sm font-bold text-danger hover:bg-danger-soft">
            <Trash2 className="size-4" aria-hidden />
            この顧客を削除する
          </ConfirmSubmit>
        </Card>
      )}
    </div>
  )
}
