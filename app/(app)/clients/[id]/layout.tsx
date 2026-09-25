import { Suspense } from 'react'
import Link from 'next/link'
import { AlertTriangle, ChevronLeft } from 'lucide-react'
import { BaseDateBar } from '@/components/client/BaseDateBar'
import { ClientTabs } from '@/components/client/ClientTabs'
import { Badge, StatusBadge, buttonClass } from '@/components/ui'
import { getClient, getVisitDates } from '@/lib/data/clients'
import { getQuestionnaire } from '@/lib/data/questionnaire'
import { ageAt, diffDays, fromDbDate, todayYmd, ymdJa } from '@/lib/dates'
import { num } from '@/lib/format'
import { GENDERS, isGender } from '@/lib/labels'
import { alertsOf } from '@/lib/questionnaire'
import { requireUser } from '@/lib/session'

export default async function ClientLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  await requireUser()
  const { id } = await params
  const [client, visits, q] = await Promise.all([getClient(id), getVisitDates(id, 10), getQuestionnaire(id)])
  const today = todayYmd()
  const age = ageAt(client.birthDate ? fromDbDate(client.birthDate) : null, today)
  const alerts = q ? alertsOf(q.answers) : []
  const joined = client.joinedOn ? fromDbDate(client.joinedOn) : null
  const months = joined ? Math.max(0, Math.floor(diffDays(joined, today) / 30.4)) : null

  const meta = [
    age != null ? `${age}歳` : null,
    client.gender && isGender(client.gender) ? GENDERS[client.gender] : null,
    client.heightCm ? `身長 ${num(client.heightCm)}cm` : null,
    client.trainer ? `担当 ${client.trainer.name}` : null,
    joined ? `入会 ${ymdJa(joined, false)}${months != null ? `（${months}ヶ月目）` : ''}` : null,
  ].filter(Boolean)

  return (
    <>
      <Link href="/clients" className={`${buttonClass.ghost} -ml-3 mb-1 no-print`}>
        <ChevronLeft className="size-4" aria-hidden />
        顧客一覧
      </Link>
      <header className="rounded-2xl border border-line bg-white shadow-[0_4px_18px_rgba(80,60,0,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-[16rem] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight">{client.name}</h1>
              <StatusBadge status={client.status} />
              {client.memberNo && (
                <Badge tone="neutral">
                  会員番号 <span className="num">{client.memberNo}</span>
                </Badge>
              )}
            </div>
            {client.kana && <p className="mt-0.5 text-sm text-ink-3">{client.kana}</p>}
            {meta.length > 0 && <p className="mt-2 text-sm text-ink-2">{meta.join('　/　')}</p>}
            {alerts.length > 0 && (
              <Link href={`/clients/${id}/questionnaire`} className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-warn-soft px-3 py-2 text-sm font-bold text-warn hover:brightness-95">
                <AlertTriangle className="size-4 flex-none" aria-hidden />
                問診での注意事項 {alerts.length}件：{alerts.map((a) => a.label.replace(/（.*?）/g, '')).slice(0, 3).join('・')}
                {alerts.length > 3 ? ' ほか' : ''}
              </Link>
            )}
          </div>
          <div className="no-print w-full lg:w-auto lg:flex-none">
            <Suspense>
              <BaseDateBar visits={visits} />
            </Suspense>
          </div>
        </div>
      </header>
      {/* タブは画面の上に固定（長いページを下までスクロールしても、すぐ切り替えられる） */}
      <div className="no-print sticky top-0 z-30 -mx-4 mt-3 border-b border-line bg-page/95 px-4 backdrop-blur sm:-mx-6 sm:px-6 xl:-mx-8 xl:px-8">
        <div className="flex items-center gap-4">
          <span className="hidden max-w-44 flex-none truncate text-sm font-black text-ink md:block">{client.name}</span>
          <Suspense>
            <ClientTabs clientId={id} />
          </Suspense>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </>
  )
}
