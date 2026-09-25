import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { ClientForm } from '@/components/ClientForm'
import { PageHeader, buttonClass } from '@/components/ui'
import { createClientAction } from '../actions'
import { listStaff } from '@/lib/data/clients'
import { getCalcSettings } from '@/lib/data/settings'
import { todayYmd } from '@/lib/dates'
import { requireUser } from '@/lib/session'

export const metadata = { title: '新規登録' }

type Prefill = { name?: string; gender?: string; h?: string; w?: string; bf?: string; t?: string; pace?: string; act?: string; birth?: string; status?: string }

export default async function NewClientPage({ searchParams }: { searchParams: Promise<Prefill> }) {
  const user = await requireUser()
  const [staff, settings, sp] = await Promise.all([listStaff(), getCalcSettings(), searchParams])
  return (
    <>
      <Link href="/clients" className={`${buttonClass.ghost} -ml-2 mb-2`}>
        <ChevronLeft className="size-4" aria-hidden />
        顧客一覧
      </Link>
      <PageHeader title="新規登録" description="氏名以外はあとから入力できます" />
      <ClientForm
        action={createClientAction}
        staff={staff}
        submitLabel="登録する"
        defaults={{
          name: sp.name ?? '',
          gender: sp.gender ?? null,
          heightCm: sp.h ? Number(sp.h) || null : null,
          birthDate: sp.birth ?? null,
          status: sp.status ?? 'active',
          joinedOn: sp.status === 'trial' ? null : todayYmd(),
          trainerId: user.id,
        }}
        initialGoal={{
          today: todayYmd(),
          paces: settings.paces,
          activityFactors: settings.activityFactors,
          prefill: { weightKg: sp.w, bodyFatPct: sp.bf, targetWeightKg: sp.t, paceKey: sp.pace, activityFactor: sp.act },
        }}
      />
    </>
  )
}
