import { prisma } from '@/lib/prisma'
import { fromDbDate, type Ymd } from '@/lib/dates'
import { isHomeworkStatus, type HomeworkStatus } from '@/lib/labels'

/** 宿題1件（画面に渡す形） */
export type HomeworkRow = { id: string; text: string; assignedOn: Ymd; status: HomeworkStatus; checkedOn: Ymd | null; note: string | null }
export type HomeworkBoard = { open: HomeworkRow[]; history: HomeworkRow[]; stats: { total: number; done: number; partial: number; notDone: number } }

type Row = { id: string; text: string; assignedOn: Date; status: string; checkedOn: Date | null; note: string | null }
const toRow = (r: Row): HomeworkRow => ({ id: r.id, text: r.text, assignedOn: fromDbDate(r.assignedOn), status: isHomeworkStatus(r.status) ? r.status : 'open', checkedOn: r.checkedOn ? fromDbDate(r.checkedOn) : null, note: r.note })

/** 未確認の宿題と、これまでの結果（新しい順・20件）とできた数 */
export async function getHomework(clientId: string): Promise<HomeworkBoard> {
  const [open, history, counts] = await Promise.all([
    prisma.homework.findMany({ where: { clientId, status: 'open' }, orderBy: [{ assignedOn: 'asc' }, { createdAt: 'asc' }] }),
    prisma.homework.findMany({ where: { clientId, status: { not: 'open' } }, orderBy: [{ checkedOn: 'desc' }, { updatedAt: 'desc' }], take: 20 }),
    prisma.homework.groupBy({ by: ['status'], where: { clientId, status: { not: 'open' } }, _count: { _all: true } }),
  ])
  const c = (s: string) => counts.find((x) => x.status === s)?._count._all ?? 0
  return { open: open.map(toRow), history: history.map(toRow), stats: { total: c('done') + c('partial') + c('not_done'), done: c('done'), partial: c('partial'), notDone: c('not_done') } }
}
