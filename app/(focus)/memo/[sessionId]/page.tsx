import { notFound } from 'next/navigation'
import { FocusBar } from '@/components/client/FocusBar'
import { TalkSheetButton } from '@/components/client/TalkNotes'
import { DrawingPad } from '@/components/drawing/DrawingPad'
import { getFocusInfo } from '@/lib/data/focus'
import { getTalkNotes } from '@/lib/data/talk'
import { emptyDrawing, isEmptyDrawing, parseDrawing } from '@/lib/drawing'
import { fromDbDate, mdw, todayYmd } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { addTalkAction, deleteTalkAction, updateTalkAction } from '@/app/(app)/clients/[id]/talk/actions'
import { saveDrawingAction } from './actions'

export async function generateMetadata({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const s = await prisma.trainingSession.findUnique({ where: { id: sessionId }, select: { client: { select: { name: true } } } })
  return { title: s ? `${s.client.name}｜手書きメモ` : '手書きメモ' }
}

export default async function MemoPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    include: { client: { select: { id: true, name: true } }, drawing: true },
  })
  if (!session) notFound()
  const date = fromDbDate(session.date)

  // 前回（この日より前で、手書きメモがある一番新しい回）
  const prev = await prisma.trainingSession.findFirst({
    where: { clientId: session.clientId, date: { lt: session.date }, drawing: { isNot: null } },
    orderBy: { date: 'desc' },
    include: { drawing: true },
  })
  const prevData = prev?.drawing ? parseDrawing(prev.drawing.data) : null
  const clientId = session.clientId
  const [focus, talk] = await Promise.all([getFocusInfo(clientId, date), getTalkNotes(clientId)])
  const toolBtn = 'inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-bold text-ink-2 hover:bg-brand-soft'

  return (
    <DrawingPad
      initial={session.drawing ? parseDrawing(session.drawing.data) : emptyDrawing()}
      save={saveDrawingAction.bind(null, sessionId)}
      backHref={`/clients/${session.clientId}/training?date=${date}`}
      title={`${session.client.name} さん　${mdw(date)} の手書きメモ`}
      previous={prev && prevData && !isEmptyDrawing(prevData) ? { label: `前回（${mdw(fromDbDate(prev.date))}）の手書きメモ`, data: prevData } : null}
      info={<FocusBar variant="line" info={focus} clientId={clientId} base={date} />}
      toolbarExtra={
        <TalkSheetButton
          title={`${session.client.name} さんの会話メモ`}
          className={toolBtn}
          initial={talk}
          defaultDate={date}
          today={todayYmd()}
          add={addTalkAction.bind(null, clientId)}
          update={updateTalkAction.bind(null, clientId)}
          remove={deleteTalkAction.bind(null, clientId)}
        />
      }
    />
  )
}
