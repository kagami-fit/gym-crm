import { TalkNotes } from '@/components/client/TalkNotes'
import { Section } from '@/components/ui'
import { resolveBaseDate } from '@/lib/base-date'
import { getClient } from '@/lib/data/clients'
import { getTalkNotes } from '@/lib/data/talk'
import { todayYmd } from '@/lib/dates'
import { requireUser } from '@/lib/session'
import { addTalkAction, deleteTalkAction, updateTalkAction } from './actions'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return { title: `${(await getClient(id)).name}｜会話メモ` }
}

/** 会話メモの一覧（トレーニングのページの「会話メモ」ボタンからも同じものを開ける） */
export default async function TalkPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  await requireUser()
  const { id } = await params
  const base = resolveBaseDate((await searchParams).date)
  const notes = await getTalkNotes(id)
  return (
    <Section title="会話メモ" en="Talk Log" aside={<span className="text-white/80">会話で出た変化・良かったこと・気になる言動を日付と一緒に</span>}>
      <TalkNotes initial={notes} defaultDate={base} today={todayYmd()} add={addTalkAction.bind(null, id)} update={updateTalkAction.bind(null, id)} remove={deleteTalkAction.bind(null, id)} />
    </Section>
  )
}
