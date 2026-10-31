import { prisma } from '@/lib/prisma'
import { fromDbDate, type Ymd } from '@/lib/dates'

/** お客様の写真・資料（ファイルの中身は読まない。開くときは /api/files/[id]） */
export type ClientFileRow = { id: string; sessionId: string | null; date: Ymd; kind: 'photo' | 'document'; title: string | null; fileName: string; mimeType: string; size: number; note: string | null }

/** 新しい順 */
export async function getClientFiles(clientId: string): Promise<ClientFileRow[]> {
  const rows = await prisma.clientFile.findMany({
    where: { clientId },
    orderBy: [{ date: 'desc' }, { createdAt: 'asc' }],
    select: { id: true, sessionId: true, date: true, kind: true, title: true, fileName: true, mimeType: true, size: true, note: true },
  })
  return rows.map((r) => ({ ...r, date: fromDbDate(r.date), kind: r.kind === 'document' ? 'document' : 'photo' }))
}
