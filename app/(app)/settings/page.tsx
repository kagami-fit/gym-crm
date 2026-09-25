import { SettingsForm } from '@/components/SettingsForm'
import { getCalcSettings } from '@/lib/data/settings'
import { requireUser } from '@/lib/session'
import { saveSettingsAction } from './actions'

export const metadata = { title: '設定' }

export default async function SettingsPage() {
  const user = await requireUser()
  const settings = await getCalcSettings()
  return <SettingsForm key={JSON.stringify(settings)} settings={settings} canEdit={user.role === 'owner'} action={saveSettingsAction} />
}
