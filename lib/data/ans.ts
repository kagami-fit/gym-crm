import { prisma } from '@/lib/prisma'
import { fromDbDate, type Ymd } from '@/lib/dates'

/** 自律神経の測定結果（ファイルの中身は読まない。開くときは /api/ans/[id]） */
export type AnsRow = { id: string; measuredOn: Ymd; fileName: string; mimeType: string; size: number; note: string | null }

export async function getAnsMeasurements(clientId: string): Promise<AnsRow[]> {
  const rows = await prisma.ansMeasurement.findMany({
    where: { clientId },
    orderBy: [{ measuredOn: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, measuredOn: true, fileName: true, mimeType: true, size: true, note: true },
  })
  return rows.map((r) => ({ ...r, measuredOn: fromDbDate(r.measuredOn) }))
}
