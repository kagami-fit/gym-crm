import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
import { Badge, EmptyState, Notice, PageHeader, StatusBadge, Value, buttonClass, inputClass } from '@/components/ui'
import { listClients, countByStatus } from '@/lib/data/clients'
import { GENDERS, STATUSES, isGender, isStatus } from '@/lib/labels'
import { diffDays, md, todayYmd } from '@/lib/dates'
import { num, signed } from '@/lib/format'
import { requireUser } from '@/lib/session'
import { cn } from '@/lib/utils'

export const metadata = { title: '顧客一覧' }

const TABS = [
  { key: 'current', label: '退会以外' },
  { key: 'active', label: STATUSES.active },
  { key: 'trial', label: STATUSES.trial },
  { key: 'paused', label: STATUSES.paused },
  { key: 'left', label: STATUSES.left },
  { key: 'all', label: 'すべて' },
] as const

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; denied?: string; deleted?: string }> }) {
  await requireUser()
  const sp = await searchParams
  const tab = TABS.some((t) => t.key === sp.status) ? (sp.status as (typeof TABS)[number]['key']) : 'current'
  const q = sp.q?.slice(0, 50) ?? ''
  const [all, counts] = await Promise.all([listClients({ q, status: isStatus(tab) ? tab : 'all' }), countByStatus()])
  const rows = tab === 'current' ? all.filter((c) => c.status !== 'left') : all
  const today = todayYmd()
  const countOf = (key: string) =>
    key === 'all' ? Object.values(counts).reduce((a, b) => a + b, 0) : key === 'current' ? (counts.active ?? 0) + (counts.trial ?? 0) + (counts.paused ?? 0) : (counts[key] ?? 0)

  return (
    <>
      <PageHeader title="顧客一覧" description="お客様を選ぶと、1人ずつのページ（体重・目標・トレーニング・食事メモ）が開きます">
        <Link href="/clients/new" className={buttonClass.primary}>
          <Plus className="size-4" aria-hidden />
          新規登録
        </Link>
      </PageHeader>

      {sp.denied && <Notice tone="warn" className="mb-4">この操作はオーナーのみできます</Notice>}
      {sp.deleted && <Notice tone="ok" className="mb-4">顧客を削除しました</Notice>}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form className="relative w-full max-w-xs" role="search">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input name="q" defaultValue={q} placeholder="氏名・ふりがな・会員番号" className={cn(inputClass, 'pl-9')} aria-label="顧客を検索" />
          {tab !== 'current' && <input type="hidden" name="status" value={tab} />}
        </form>
        <nav className="flex flex-wrap gap-1 rounded-full bg-white p-1 ring-1 ring-line" aria-label="ステータスで絞り込み">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={{ pathname: '/clients', query: { ...(q ? { q } : {}), ...(t.key !== 'current' ? { status: t.key } : {}) } }}
              className={cn('rounded-full px-3.5 py-1.5 text-sm font-bold text-ink-3 hover:text-ink', tab === t.key && 'bg-brand text-ink')}
              aria-current={tab === t.key ? 'page' : undefined}
            >
              {t.label}
              <span className="num ml-1.5 text-xs opacity-80">{countOf(t.key)}</span>
            </Link>
          ))}
        </nav>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={q ? `「${q}」に当てはまるお客様はいません` : 'まだお客様が登録されていません'} action={{ href: '/clients/new', label: '新規登録' }} />
      ) : (
        <>
        {/* iPad 縦・スマホ：1人ずつのカード（どこを押してもその人のページへ） */}
        <ul className="grid gap-3 sm:grid-cols-2 lg:hidden">
          {rows.map((c) => {
            const toGo = c.latestWeight && c.targetWeight != null ? c.latestWeight.value - c.targetWeight : null
            const since = c.lastVisit ? diffDays(c.lastVisit, today) : null
            return (
              <li key={c.id}>
                <Link href={`/clients/${c.id}`} className="block h-full rounded-2xl border border-line bg-white p-4 shadow-[0_4px_18px_rgba(80,60,0,0.05)] active:bg-brand-soft/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-black">{c.name}</p>
                      <p className="truncate text-xs text-ink-3">
                        {[c.kana, c.age != null ? `${c.age}歳` : null, c.gender && isGender(c.gender) ? GENDERS[c.gender].replace('その他・回答しない', 'その他') : null].filter(Boolean).join('　')}
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-soft p-2.5 text-center">
                    <div>
                      <p className="text-[11px] font-bold text-ink-3">現体重</p>
                      <p className="text-base">{c.latestWeight ? <Value value={num(c.latestWeight.value)} unit="kg" /> : '—'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-ink-3">目標</p>
                      <p className="text-base">{c.targetWeight != null ? <Value value={num(c.targetWeight)} unit="kg" /> : '—'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-ink-3">目標まで</p>
                      <p className="text-base">{toGo == null ? '—' : toGo <= 0 ? <Badge tone="ok">達成</Badge> : <Value value={signed(toGo)} unit="kg" />}</p>
                    </div>
                  </div>
                  <p className="mt-2.5 flex flex-wrap items-center gap-2 text-sm text-ink-2">
                    <span>
                      最終来店 {c.lastVisit ? <span className="num font-semibold">{md(c.lastVisit)}</span> : <span className="text-ink-3">記録なし</span>}
                    </span>
                    {since != null && (since >= 14 ? <Badge tone="warn">{since}日前</Badge> : <span className="text-xs text-ink-3">{since === 0 ? '今日' : `${since}日前`}</span>)}
                    {c.trainerName && <span className="ml-auto text-xs text-ink-3">担当 {c.trainerName}</span>}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
        <div className="hidden overflow-x-auto rounded-2xl border border-line bg-white shadow-[0_4px_18px_rgba(80,60,0,0.05)] lg:block">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-dark text-left text-xs text-white">
              <tr>
                <th className="px-4 py-3 font-bold">氏名</th>
                <th className="px-3 py-3 font-bold">ステータス</th>
                <th className="px-3 py-3 font-bold">年齢・性別</th>
                <th className="px-3 py-3 font-bold">担当</th>
                <th className="px-3 py-3 font-bold">最終来店日</th>
                <th className="px-3 py-3 text-right font-bold">現体重</th>
                <th className="px-3 py-3 text-right font-bold">目標体重</th>
                <th className="px-3 py-3 text-right font-bold">目標まで</th>
                <th className="px-4 py-3 font-bold">会員番号</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => {
                const toGo = c.latestWeight && c.targetWeight != null ? c.latestWeight.value - c.targetWeight : null
                const since = c.lastVisit ? diffDays(c.lastVisit, today) : null
                return (
                  <tr key={c.id} className="group relative hover:bg-soft">
                    <td className="px-4 py-3.5">
                      <Link href={`/clients/${c.id}`} className="font-bold text-ink after:absolute after:inset-0 group-hover:underline decoration-brand-deep decoration-2 underline-offset-4">
                        {c.name}
                      </Link>
                      {c.kana && <p className="text-xs text-ink-3">{c.kana}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-3 py-3 text-ink-2">
                      {c.age != null ? <span className="num">{c.age}</span> : '—'}
                      {c.age != null && '歳'}
                      {c.gender && isGender(c.gender) && <span className="ml-1.5 text-ink-3">{GENDERS[c.gender].replace('その他・回答しない', 'その他')}</span>}
                    </td>
                    <td className="px-3 py-3 text-ink-2">{c.trainerName ?? '—'}</td>
                    <td className="px-3 py-3">
                      {c.lastVisit ? (
                        <span className="text-ink-2">
                          <span className="num">{md(c.lastVisit)}</span>
                          {since != null && since >= 14 ? (
                            <Badge tone="warn" className="ml-2">
                              {since}日前
                            </Badge>
                          ) : (
                            since != null && <span className="ml-2 text-xs text-ink-3">{since === 0 ? '今日' : `${since}日前`}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-ink-3">記録なし</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">{c.latestWeight ? <Value value={num(c.latestWeight.value)} unit="kg" /> : <span className="text-ink-3">—</span>}</td>
                    <td className="px-3 py-3 text-right">{c.targetWeight != null ? <Value value={num(c.targetWeight)} unit="kg" /> : <span className="text-ink-3">—</span>}</td>
                    <td className="px-3 py-3 text-right">
                      {toGo == null ? (
                        <span className="text-ink-3">—</span>
                      ) : toGo <= 0 ? (
                        <Badge tone="ok">達成</Badge>
                      ) : (
                        <Value value={signed(toGo)} unit="kg" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-3">
                      <span className="num">{c.memberNo ?? '—'}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </>
  )
}
