import Link from 'next/link'
import { ChevronDown, History, NotebookPen, PenLine, Plus } from 'lucide-react'
import { FocusBar } from '@/components/client/FocusBar'
import { SessionEditor } from '@/components/client/SessionEditor'
import { SessionTable } from '@/components/client/SessionTable'
import { TalkSheetButton } from '@/components/client/TalkNotes'
import { MemoOpenButton, MemoPreview, MemoViewerProvider, type MemoItem } from '@/components/drawing/MemoViewer'
import { MetricCharts, VolumeCharts } from '@/components/charts/TrainingCharts'
import { Badge, EmptyState, Notice, Section, buttonClass } from '@/components/ui'
import { resolveBaseDate } from '@/lib/base-date'
import { summarize } from '@/lib/calc/training'
import { getClient } from '@/lib/data/clients'
import { getFocusInfo } from '@/lib/data/focus'
import { getCalcSettings } from '@/lib/data/settings'
import { getTalkNotes } from '@/lib/data/talk'
import { getExercises, getMemoThumbs, getSessions, lastRecordsBefore } from '@/lib/data/training'
import { md, mdw, todayYmd, ymdJa } from '@/lib/dates'
import { int } from '@/lib/format'
import { requireUser } from '@/lib/session'
import { cn } from '@/lib/utils'
import { addTalkAction, deleteTalkAction, updateTalkAction } from '../talk/actions'
import { deleteSessionAction, openMemoAction, saveSessionAction } from './actions'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return { title: `${(await getClient(id)).name}｜トレーニング` }
}

type SP = { date?: string; edit?: string; saved?: string; deleted?: string; all?: string }

/** 最初に出す回数（手書きメモの小さな表示つき）。それより前は「さらに表示」で出す */
const LIST_LIMIT = 20

const barBtn = 'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-bold'
const barBtnLight = `${barBtn} border border-line-2 bg-white text-ink-2 hover:bg-soft active:bg-brand-soft`
const barBtnBrand = `${barBtn} bg-brand text-ink shadow-[0_3px_10px_rgba(251,175,0,0.25)] hover:bg-brand-deep`

export default async function TrainingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  await requireUser()
  const { id } = await params
  const sp = await searchParams
  const base = resolveBaseDate(sp.date)
  const today = todayYmd()
  const [client, settings, sessions, exercises, focus, talk] = await Promise.all([getClient(id), getCalcSettings(), getSessions(id), getExercises(true), getFocusInfo(id, base), getTalkNotes(id)])
  const upToBase = sessions.filter((s) => s.date <= base)
  const q = sp.date ? `?date=${sp.date}` : ''
  const editing = sp.edit === 'new' ? null : sessions.find((s) => s.id === sp.edit) ?? null
  const isEditing = sp.edit === 'new' || editing != null
  const history = sessions.map((s) => ({ id: s.id, date: s.date, rows: s.rows }))
  const list = [...sessions].reverse()
  const shown = sp.all ? list : list.slice(0, LIST_LIMIT)
  // 基準日（来店日）の回。あれば「記録」「手書きメモ」はその回を開く
  const baseSession = list.find((s) => s.date === base) ?? null
  const dayLabel = base === today ? '今日' : md(base)

  // 手書きメモ：一覧に出す回は小さな表示も渡す（前後の回へ移れるよう、メモのある回は全部並べる）
  const thumbs = await getMemoThumbs(shown.filter((s) => s.hasDrawing).map((s) => s.id))
  const memos: MemoItem[] = list.filter((s) => s.hasDrawing).map((s) => ({ sessionId: s.id, date: s.date, thumb: thumbs[s.id] }))
  const prevMemo = memos.find((m) => m.date < base) ?? null

  const talkProps = {
    initial: talk,
    defaultDate: base,
    today,
    add: addTalkAction.bind(null, id),
    update: updateTalkAction.bind(null, id),
    remove: deleteTalkAction.bind(null, id),
  }

  return (
    <MemoViewerProvider memos={memos}>
      <FocusBar
        info={focus}
        clientId={id}
        base={base}
        actions={
          <>
            {prevMemo && (
              <MemoOpenButton sessionId={prevMemo.sessionId} className={barBtnLight} title={`前回（${mdw(prevMemo.date)}）の手書きメモ`}>
                <History className="size-4" aria-hidden />
                前回の手書き
              </MemoOpenButton>
            )}
            {baseSession ? (
              <Link href={`/memo/${baseSession.id}`} className={barBtnBrand}>
                <NotebookPen className="size-4" aria-hidden />
                {dayLabel}の手書き
              </Link>
            ) : (
              <form action={openMemoAction.bind(null, id, base)}>
                <button type="submit" className={barBtnBrand}>
                  <NotebookPen className="size-4" aria-hidden />
                  {dayLabel}の手書き
                </button>
              </form>
            )}
            <TalkSheetButton {...talkProps} title={`${client.name} さんの会話メモ`} className={barBtnLight} />
          </>
        }
      />

      <div className="space-y-5">
        {sp.saved && <Notice tone="ok">トレーニングを記録しました</Notice>}
        {sp.deleted && <Notice tone="ok">記録を削除しました</Notice>}

        <Section
          title={isEditing ? (editing ? `トレーニング記録の編集（${ymdJa(editing.date)}）` : 'トレーニングを記録') : 'トレーニング記録'}
          en="Session Log"
          aside={
            !isEditing ? (
              <Link
                href={`?${new URLSearchParams({ ...(sp.date ? { date: sp.date } : {}), edit: baseSession ? baseSession.id : 'new' })}`}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-black text-ink hover:bg-brand-deep"
              >
                {baseSession && baseSession.rows.length ? <PenLine className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                {dayLabel}のトレーニングを{baseSession && baseSession.rows.length ? '編集' : '記録'}
              </Link>
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
            <div className="space-y-3">
              <p className="text-xs text-ink-3">手書きメモは書いてある所を半分ほど表示しています。タップすると全体を大きく表示します</p>
              {shown.map((s) => {
                const sum = summarize(s)
                const isBase = s.id === baseSession?.id
                const memoOnly = s.rows.length === 0
                const hasMemo = !!thumbs[s.id]
                return (
                  <article key={s.id} className={cn('rounded-xl border', isBase ? 'border-brand-deep bg-brand-soft/40' : 'border-line bg-white')}>
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-4 pt-3">
                      <div className="min-w-0 space-y-1.5">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="num text-base font-bold">{mdw(s.date)}</span>
                          {isBase && <Badge tone="brand">{s.date === today ? '今日' : '基準日'}</Badge>}
                          {s.trainerName && <span className="text-xs text-ink-3">担当 {s.trainerName}</span>}
                        </p>
                        {memoOnly ? (
                          <p className="text-sm text-ink-2">種目の記録なし</p>
                        ) : (
                          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="flex flex-wrap gap-1">
                              {sum.bodyParts.map((p) => (
                                <Badge key={p} tone="neutral">
                                  {p}
                                </Badge>
                              ))}
                            </span>
                            <span className="text-sm text-ink-2">
                              {sum.exerciseCount}種目・{sum.totalSets}セット・総負荷量 <span className="num font-semibold text-ink">{int(sum.volume)}</span>kg
                            </span>
                          </p>
                        )}
                        {s.memo && <p className="text-sm text-ink-2">メモ：{s.memo}</p>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/memo/${s.id}`} className={buttonClass.small}>
                          <NotebookPen className="size-4" aria-hidden />
                          {hasMemo ? '書き足す' : '手書きメモを書く'}
                        </Link>
                        <Link href={`?${new URLSearchParams({ date: s.date, edit: s.id })}`} className={buttonClass.small}>
                          {memoOnly ? '種目を記録' : '編集'}
                        </Link>
                      </div>
                    </div>
                    {hasMemo && (
                      <div className="px-4 pt-3">
                        <MemoPreview sessionId={s.id} label={mdw(s.date)} />
                      </div>
                    )}
                    {memoOnly ? (
                      <div className="pb-3" />
                    ) : (
                      <details className="group px-4 pb-3 pt-2.5" open={isBase}>
                        <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1 rounded-full bg-soft px-3 text-sm font-bold text-ink-2 ring-1 ring-line marker:content-none [&::-webkit-details-marker]:hidden">
                          <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
                          種目の内容（{sum.exerciseCount}種目）
                        </summary>
                        <div className="mt-2">
                          <SessionTable session={s} method={settings.oneRmMethod} previous={lastRecordsBefore(sessions, s.date, s.id)} />
                        </div>
                      </details>
                    )}
                  </article>
                )
              })}
              {!sp.all && list.length > LIST_LIMIT && (
                <Link href={`?${new URLSearchParams({ ...(sp.date ? { date: sp.date } : {}), all: '1' })}`} className={cn(buttonClass.secondary, 'w-full')}>
                  さらに表示（全{list.length}回）
                </Link>
              )}
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
    </MemoViewerProvider>
  )
}
