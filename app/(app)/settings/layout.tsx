import { PageHeader } from '@/components/ui'
import { SettingsTabs } from '@/components/SettingsTabs'
import { requireUser } from '@/lib/session'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  return (
    <>
      <PageHeader title="設定" description={user.role === 'owner' ? '変更すると、すべての顧客の計算と画面に同じ設定で反映されます' : '設定の変更はオーナーのみできます（スタッフは閲覧のみ）'} />
      <SettingsTabs />
      <div className="mt-5">{children}</div>
    </>
  )
}
