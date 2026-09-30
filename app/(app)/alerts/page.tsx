import Link from 'next/link'
import { Settings } from 'lucide-react'
import { AlertList, MutedList } from '@/components/alerts/AlertList'
import { ReminderForm } from '@/components/alerts/ReminderForm'
import { Card, PageHeader, Section } from '@/components/ui'
import { RULES } from '@/lib/alerts/rules'
import { defaultScope, getAlertBoard, getAlertSettings } from '@/lib/data/alerts'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'
import { cn } from '@/lib/utils'

export const metadata = { title: 'お知らせ' }

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const user = await requireUser()
  const sp = await searchParams
  const scope = sp.scope === 'mine' || sp.scope === 'all' ? sp.scope : defaultScope(user)
  const [board, settings, clients] = await Promise.all([
    getAlertBoard(user.id, scope),
    getAlertSettings(),
    prisma.client.findMany({ where: { status: { not: 'left' } }, select: { id: true, name: true }, orderBy: [{ kana: 'asc' }, { name: 'asc' }] }),
  ])
  const tab = (key: 'mine' | 'all', label: string) => (
    <Link href={`/alerts?scope=${key}`} className={cn('rounded-full px-3.5 py-1.5 text-sm font-bold text-ink-3 hover:text-ink', scope === key && 'bg-brand text-ink')} aria-current={scope === key ? 'page' : undefined}>
      {label}
    </Link>
  )
  const rules = [
    { on: settings.plateau.enabled, label: RULES.plateau.label, text: `最低体重を ${settings.plateau.days.join('／')} 日更新していない` },
    { on: settings.noProgress.enabled, label: RULES.noProgress.label, text: `同じ重さ×回数が ${settings.noProgress.counts.join('／')} 回続いた` },
    { on: settings.dietFlat.enabled, label: RULES.dietFlat.label, text: `体重が停滞し、食事の数字が ${settings.dietFlat.weeks} 週間ほぼ同じ（差 ${settings.dietFlat.pct}% 以内）` },
    { on: settings.noVisit.enabled, label: RULES.noVisit.label, text: `最後の来店から ${settings.noVisit.days.join('／')} 日（在籍中）` },
    { on: settings.behindPace.enabled, label: RULES.behindPace.label, text: `予定ペースより ${settings.behindPace.kg.join('／')} kg 遅れ` },
    { on: settings.talk.enabled, label: RULES.talk.label, text: `ネガティブ・身体の変化の会話メモから ${settings.talk.days} 日間` },
  ]

  return (
    <>
      <PageHeader title="お知らせ" description="体重の停滞や来店のあきなどを自動で知らせます。自分で作ったお知らせもここに出ます">
        <nav className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-line" aria-label="表示するお客様">
          {tab('mine', '自分の担当')}
          {tab('all', '全員')}
        </nav>
      </PageHeader>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-5">
          <Section title={`対応が必要（${board.open.length}件）`} en="Alerts">
            <AlertList items={board.open} empty="いま対応が必要なお知らせはありません" />
          </Section>
          {board.nextVisit.length > 0 && (
            <Section title={`次の来店時に知らせる（${board.nextVisit.length}件）`} en="Next Visit">
              <AlertList items={board.nextVisit} mode="nextVisit" />
            </Section>
          )}
          {board.upcoming.length > 0 && (
            <Section title={`予定（${board.upcoming.length}件）`} en="Upcoming">
              <AlertList items={board.upcoming} mode="upcoming" />
            </Section>
          )}
          {board.snoozed.length > 0 && (
            <Section title={`あとでにしたもの（${board.snoozed.length}件）`} en="Snoozed">
              <AlertList items={board.snoozed} mode="snoozed" />
            </Section>
          )}
          <Section title="最近対応したもの（14日）" en="Done">
            {board.done.length ? (
              <ul className="divide-y divide-line text-sm">
                {board.done.map((d) => (
                  <li key={d.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 first:pt-0 last:pb-0">
                    <span className="num w-28 flex-none text-ink-3">{new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d.at))}</span>
                    <span className="font-bold">{d.clientName} さん</span>
                    <span className="text-ink-2">{d.title}</span>
                    {d.note && <span className="w-full text-ink-2 sm:w-auto">「{d.note}」</span>}
                    {d.byName && <span className="ml-auto text-xs text-ink-3">{d.byName}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-3">まだありません</p>
            )}
          </Section>
        </div>

        <div className="space-y-5">
          <Card title="お知らせを作る" description="お客様ごとに、次の来店時か日付を決めて知らせます（例：体組成を測る、目標を見直す）">
            <ReminderForm clients={clients} />
          </Card>
          {board.muted.length > 0 && (
            <Card title="止めているお知らせ" description="お客様ごとに止めた種類です。再開するとまた出ます">
              <MutedList items={board.muted} />
            </Card>
          )}
          <Card
            title="自動で知らせること"
            description="黄＝気づき・橙＝要対応・赤＝相談 の順の目安"
            actions={
              user.role === 'owner' ? (
                <Link href="/settings/alerts" className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-ink-2 ring-1 ring-line-2 hover:bg-soft">
                  <Settings className="size-4" aria-hidden />
                  変える
                </Link>
              ) : undefined
            }
          >
            <ul className="space-y-2 text-sm">
              {rules.map((r) => (
                <li key={r.label} className={cn(!r.on && 'text-ink-3 line-through')}>
                  <span className="font-bold">{r.label}</span>
                  <span className="block text-ink-2">{r.on ? r.text : '止めています'}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  )
}
