import { prisma } from '@/lib/prisma'
import { fromDbDate, toDbDate, type Ymd } from '@/lib/dates'
import { isTalkKind, type TalkKind } from '@/lib/labels'

/** 会話メモ1件（画面に渡す形） */
export type TalkNoteRow = { id: string; date: Ymd; kind: TalkKind; text: string; authorName: string | null }
/** 画面から送る内容と、追加・変更の結果 */
export type TalkInput = { date: string; kind: string; text: string }
export type TalkResult = { ok: true; note: TalkNoteRow } | { ok: false; message: string }

type Row = { id: string; date: Date; kind: string; text: string; createdBy: { name: string } | null }

export function toTalkRow(r: Row): TalkNoteRow {
  return { id: r.id, date: fromDbDate(r.date), kind: isTalkKind(r.kind) ? r.kind : 'talk', text: r.text, authorName: r.createdBy?.name ?? null }
}

/** 新しい順（同じ日は後から書いたものが上） */
export async function getTalkNotes(clientId: string, opts: { upTo?: Ymd; take?: number } = {}): Promise<TalkNoteRow[]> {
  const rows = await prisma.talkNote.findMany({
    where: { clientId, ...(opts.upTo ? { date: { lte: toDbDate(opts.upTo) } } : {}) },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: opts.take,
    include: { createdBy: { select: { name: true } } },
  })
  return rows.map(toTalkRow)
}
