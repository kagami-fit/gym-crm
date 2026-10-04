import { prisma } from '@/lib/prisma'
import { fromDbDate, type Ymd } from '@/lib/dates'
import { isAnsLevel, isAnsType, type AnsLevel, type AnsType } from '@/lib/labels'
import type { AnsReading } from '@/lib/plan'

/** 自律神経の測定結果（ファイルの中身は読まない。開くときは /api/ans/[id]）。活性度の2本の数値・位置と、型（仮） */
export type AnsRow = AnsReading & {
  id: string
  measuredOn: Ymd
  fileName: string
  mimeType: string
  size: number
  ansType: AnsType | null
  note: string | null
}

/** 新しい順 */
export async function getAnsMeasurements(clientId: string): Promise<AnsRow[]> {
  const rows = await prisma.ansMeasurement.findMany({
    where: { clientId },
    orderBy: [{ measuredOn: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      measuredOn: true,
      fileName: true,
      mimeType: true,
      size: true,
      note: true,
      sympathetic: true,
      sympatheticLevel: true,
      parasympathetic: true,
      parasympatheticLevel: true,
      ansType: true,
    },
  })
  const level = (v: string | null): AnsLevel | null => (isAnsLevel(v) ? v : null)
  return rows.map((r) => ({
    ...r,
    measuredOn: fromDbDate(r.measuredOn),
    sympatheticLevel: level(r.sympatheticLevel),
    parasympatheticLevel: level(r.parasympatheticLevel),
    ansType: isAnsType(r.ansType) ? r.ansType : null,
  }))
}
