import Link from 'next/link'
import { NotebookPen, PenLine, Plus } from 'lucide-react'
import { SessionEditor } from '@/components/client/SessionEditor'
import { SessionTable } from '@/components/client/SessionTable'
import { DrawingView } from '@/components/drawing/DrawingView'
import { MetricCharts, VolumeCharts } from '@/components/charts/TrainingCharts'
import { Badge, EmptyState, Notice, Section, buttonClass } from '@/components/ui'
import { resolveBaseDate } from '@/lib/base-date'
import { summarize } from '@/lib/calc/training'
import { getClient } from '@/lib/data/clients'
import { getCalcSettings } from '@/lib/data/settings'
import { getDrawing, getExercises, getSessions, lastRecordsBefore } from '@/lib/data/training'
import { mdw, todayYmd, ymdJa } from '@/lib/dates'
import { int } from '@/lib/format'
import { requireUser } from '@/lib/session'
import { cn } from '@/lib/utils'
import { deleteSessionAction, openMemoAction, saveSessionAction } from './actions'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return { title: `${(await getClient(id)).name}｜トレーニング` }
}

type SP = { date?: string; edit?: string; saved?: string; deleted?: string }

const headBtn = 'inline-flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-black text-ink hover:bg-brand-deep'
const headBtnLight = 'inline-flex h-10 items-center gap-1.5 rounded-full bg-white/10 px-4 text-sm font-bold text-white hover:bg-white/20'

export default async function TrainingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  await requireUser()
  const { id } = await params
  const sp = await searchParams
  const base = resolveBaseDate(sp.date)
  const [settings, sessions, exercises] = await Promise.all([getCalcSettings(), getSessions(id), getExercises(true)])
  const upToBase = sessions.filter((s) => s.date <= base)
  const q = sp.date ? `?date=${sp.date}` : ''
  const editing = sp.edit === 'new' ? null : sessions.find((s) => s.id === sp.edit) ?? null
  const isEditing = sp.edit === 'new' || editing != null
  const history = sessions.map((s) => ({ id: s.id, date: s.date, rows: s.rows }))
  const list = [...sessions].reverse()
  // 基準日（来店日）の回。あれば「記録」「手書きメモ」はその回を開く
  const baseSession = [...sessions].reverse().find((s) => s.date === base) ?? null
  const baseDrawing = baseSession?.hasDrawing ? await getDrawing(baseSession.id) : null
  const dayLabel = base === todayYmd() ? '今日' : mdw(base)

  return (
    <div className="space-y-5">
      {sp.saved && <Notice tone="ok">トレーニングを記録しました</Notice>}
      {sp.deleted && <Notice tone="ok">記録を削除しました</Notice>}

      <Section
        title={isEditing ? (editing ? `トレーニング記録の編集（${ymdJa(editing.date)}）` : 'トレーニングを記録') : 'トレーニング記録'}
        en="Session Log"
        aside={
          !isEditing ? (
            <>
              {baseSession ? (
                <Link href={`/memo/${baseSession.id}`} className={headBtnLight}>
                  <NotebookPen className="size-4" aria-hidden />
                  {dayLabel}の手書きメモ
                </Link>
              ) : (
                <form action={openMemoAction.bind(null, id, base)}>
                  <button type="submit" className={headBtnLight}>
                    <NotebookPen className="size-4" aria-hidden />
                    {dayLabel}の手書きメモ
                  </button>
                </form>
              )}
              <Link href={`?${new URLSearchParams({ ...(sp.date ? { date: sp.date } : {}), edit: baseSession ? baseSession.id : 'new' })}`} className={headBtn}>
                {baseSession && baseSession.rows.length ? <PenLine className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                {dayLabel}のトレーニングを{baseSession && baseSession.rows.length ? '編集' : '記録'}
              </Link>
            </>
          ) : undefined
        }
      >
        {isEditing ? (
          <SessionEditor
            key={editing?.id ?? `new-${base}`}
            action={saveSessionAction.bind(null, id, editing?.id ?? null)}
            deleteAction={editing ? deleteSessionAction.bind(null, id, editing.id, editing.date) : undefined}
            sessionId={editing?.id ?? null}
            initial={{ date: editing?.date ?? base, memo: editing?.memo ?? '', rows: editing?.rows ?? [] }}
            bodyParts={settings.bodyParts}
            exercises={exercises.map((e) => ({ bodyPart: e.bodyPart, name: e.name }))}
            history={history}
            method={settings.oneRmMethod}
            cancelHref={`/clients/${id}/training${q}`}
            memoHref={editing ? `/memo/${editing.id}` : null}
          />
        ) : list.length === 0 ? (
          <EmptyState title="まだトレーニングの記録がありません">右上のボタンから記録できます。手書きメモだけ先に書くこともできます</EmptyState>
        ) : (
          <div className="space-y-2">
            {list.slice(0, 30).map((s) => {
              const sum = summarize(s)
              const isBase = s.id === baseSession?.id
              const memoOnly = s.rows.length === 0
              return (
                <details key={s.id} className={cn('group rounded-xl border', isBase ? 'border-brand-deep bg-brand-soft/40' : 'border-line bg-white')} open={isBase}>
                  <summary className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 marker:content-none">
                    <span className="num w-24 font-semibold">{mdw(s.date)}</span>
                    {memoOnly ? (
                      <span className="text-sm text-ink-2">種目の記録なし</span>
                    ) : (
                      <>
                        <span className="flex flex-wrap gap-1">
                          {sum.bodyParts.map((p) => (
                            <Badge key={p} tone="neutral">
                              {p}
                            </Badge>
                          ))}
                        </span>
                        <span className="text-sm text-ink-2">
                          {sum.exerciseCount}種目・{sum.totalSets}セット
                        </span>
                        <span className="text-sm text-ink-2">
                          総負荷量 <span className="num font-semibold text-ink">{int(sum.volume)}</span>kg
                        </span>
                      </>
                    )}
                    {s.hasDrawing && (
                      <Badge tone="brand">
                        <NotebookPen className="size-3" aria-hidden />
                        手書きメモ
                      </Badge>
                    )}
                    {s.trainerName && <span className="text-xs text-ink-3">担当 {s.trainerName}</span>}
                    <span className="ml-auto flex items-center gap-2">
                      {isBase && <Badge tone="brand">基準日</Badge>}
                      <Link href={`/memo/${s.id}`} className={buttonClass.small}>
                        <NotebookPen className="size-3.5" aria-hidden />
                        手書きメモ
                      </Link>
                      <Link href={`?${new URLSearchParams({ date: s.date, edit: s.id })}`} className={buttonClass.small}>
                        {memoOnly ? '種目を記録' : '編集'}
                      </Link>
                    </span>
                  </summary>
                  <div className="space-y-3 border-t border-line px-3 pb-3 pt-3">
                    {!memoOnly && <SessionTable session={s} method={settings.oneRmMethod} previous={lastRecordsBefore(sessions, s.date, s.id)} />}
                    {s.memo && <p className="rounded-lg bg-soft px-3 py-2 text-sm text-ink-2">メモ：{s.memo}</p>}
                    {isBase && baseDrawing && (
                      <div>
                        <p className="mb-2 text-sm font-black">手書きメモ</p>
                        <Link href={`/memo/${s.id}`} className="block rounded-xl ring-brand-deep hover:ring-2" aria-label="手書きメモを開く">
                          <DrawingView data={baseDrawing} />
                        </Link>
                      </div>
                    )}
                    {!isBase && s.hasDrawing && (
                      <Link href={`/memo/${s.id}`} className={buttonClass.secondary}>
                        <NotebookPen className="size-4" aria-hidden />
                        手書きメモを見る
                      </Link>
                    )}
                  </div>
                </details>
              )
            })}
            {list.length > 30 && <p className="text-center text-xs text-ink-3">古い記録は基準日を変えると確認できます（最新30回を表示）</p>}
          </div>
        )}
      </Section>

      {!isEditing && (
        <>
          <Section title="総負荷量の推移" en="Volume">
            <VolumeCharts sessions={upToBase} base={base} count={settings.recentSessionCount} />
          </Section>
          <Section title="部位別・種目別の推移" en="By Part / Exercise">
            {upToBase.some((s) => s.rows.length) ? (
              <MetricCharts sessions={upToBase} base={base} count={settings.recentSessionCount} bodyParts={settings.bodyParts} method={settings.oneRmMethod} />
            ) : (
              <EmptyState title="基準日までの記録がありません" />
            )}
          </Section>
        </>
      )}
    </div>
  )
}
