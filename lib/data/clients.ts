import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ageAt, fromDbDate, todayYmd, type Ymd } from '@/lib/dates'
import type { ClientStatus } from '@/lib/labels'

export type ClientListRow = {
  id: string
  memberNo: string | null
  name: string
  kana: string | null
  status: string
  gender: string | null
  age: number | null
  trainerName: string | null
  joinedOn: Ymd | null
  lastVisit: Ymd | null
  latestWeight: { value: number; date: Ymd } | null
  targetWeight: number | null
}

export async function listClients(opts: { q?: string; status?: ClientStatus | 'all' }): Promise<ClientListRow[]> {
  const where: Prisma.ClientWhereInput = {}
  if (opts.status && opts.status !== 'all') where.status = opts.status
  const q = opts.q?.trim()
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { kana: { contains: q, mode: 'insensitive' } },
      { memberNo: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q } },
    ]
  }
  const today = todayYmd()
  const rows = await prisma.client.findMany({
    where,
    orderBy: [{ kana: 'asc' }, { name: 'asc' }],
    include: {
      trainer: { select: { name: true } },
      bodyLogs: { where: { weightKg: { not: null } }, orderBy: { date: 'desc' }, take: 1, select: { date: true, weightKg: true } },
      sessions: { orderBy: { date: 'desc' }, take: 1, select: { date: true } },
      goals: { orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }], take: 1, select: { targetWeightKg: true } },
    },
  })
  return rows.map((c) => ({
    id: c.id,
    memberNo: c.memberNo,
    name: c.name,
    kana: c.kana,
    status: c.status,
    gender: c.gender,
    age: ageAt(c.birthDate ? fromDbDate(c.birthDate) : null, today),
    trainerName: c.trainer?.name ?? null,
    joinedOn: c.joinedOn ? fromDbDate(c.joinedOn) : null,
    lastVisit: c.sessions[0] ? fromDbDate(c.sessions[0].date) : null,
    latestWeight: c.bodyLogs[0]?.weightKg != null ? { value: c.bodyLogs[0].weightKg, date: fromDbDate(c.bodyLogs[0].date) } : null,
    targetWeight: c.goals[0]?.targetWeightKg ?? null,
  }))
}

export async function countByStatus(): Promise<Record<string, number>> {
  const g = await prisma.client.groupBy({ by: ['status'], _count: { _all: true } })
  return Object.fromEntries(g.map((x) => [x.status, x._count._all]))
}

export const getClient = cache(async (id: string) => {
  const c = await prisma.client.findUnique({ where: { id }, include: { trainer: { select: { id: true, name: true } } } })
  if (!c) notFound()
  return c
})
export type ClientRecord = Awaited<ReturnType<typeof getClient>>

/** 来店日（トレーニング記録のある日）新しい順 */
export async function getVisitDates(clientId: string, limit = 12): Promise<Ymd[]> {
  const rows = await prisma.trainingSession.findMany({
    where: { clientId },
    orderBy: { date: 'desc' },
    distinct: ['date'],
    take: limit,
    select: { date: true },
  })
  return rows.map((r) => fromDbDate(r.date))
}

export async function listStaff() {
  return prisma.user.findMany({ orderBy: [{ role: 'asc' }, { createdAt: 'asc' }], select: { id: true, name: true, email: true, role: true, createdAt: true } })
}
