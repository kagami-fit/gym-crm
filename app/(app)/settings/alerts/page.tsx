import { AlertSettingsForm } from '@/components/AlertSettingsForm'
import { getAlertSettings } from '@/lib/data/alerts'
import { requireUser } from '@/lib/session'
import { saveAlertSettingsAction } from './actions'

export const metadata = { title: 'お知らせの設定' }

export default async function AlertSettingsPage() {
  const user = await requireUser()
  const settings = await getAlertSettings()
  return <AlertSettingsForm key={JSON.stringify(settings)} settings={settings} canEdit={user.role === 'owner'} action={saveAlertSettingsAction} />
}
