import { SimulatorForm } from '@/components/SimulatorForm'
import { PageHeader } from '@/components/ui'
import { getCalcSettings } from '@/lib/data/settings'
import { todayYmd } from '@/lib/dates'
import { requireUser } from '@/lib/session'

export const metadata = { title: '体験シミュレーター' }

export default async function SimulatorPage() {
  await requireUser()
  const settings = await getCalcSettings()
  return (
    <>
      <PageHeader title="体験シミュレーター" description="体験に来たお客様に、目標カロリーと「いつ・どこまで」の見込みをその場で見せる画面です（計算は設定画面の式・減量ペースと同じ）" />
      <SimulatorForm settings={settings} today={todayYmd()} />
    </>
  )
}
