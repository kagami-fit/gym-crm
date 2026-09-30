'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'
import { isYmd, toDbDate, todayYmd } from '@/lib/dates'
import type { ActionState } from '@/components/SubmitButton'

// 顧客ステップ（期・月のテーマ・自律神経の測定）と宿題

type Result = { ok: true } | { ok: false; message: string }
const refresh = (clientId: string) => revalidatePath(`/clients/${clientId}`, 'layout')

async function clientExists(id: string) {
  return !!(await prisma.client.findUnique({ where: { id }, select: { id: true } }))
}

// ── 期（フェーズ）
const phaseSchema = z.object({
  name: z.string().trim().min(1, '期の名前を入れてください').max(30, '30文字までにしてください'),
  start: z.string().refine(isYmd, '開始日を選んでください'),
  end: z.string().optional(),
  note: z.string().trim().max(200).optional(),
})

export async function savePhaseAction(clientId: string, input: { id?: string; name: string; start: string; end?: string; note?: string }): Promise<Result> {
  const user = await requireUser()
  const r = phaseSchema.safeParse(input)
  if (!r.success) return { ok: false, message: r.error.issues[0]?.message ?? '入力内容を確認してください' }
  const v = r.data
  const end = v.end && isYmd(v.end) ? v.end : null
  if (end && end < v.start) return { ok: false, message: '終わりの日は開始日より後にしてください' }
  if (!(await clientExists(clientId))) return { ok: false, message: 'お客様が見つかりませんでした' }
  const data = { name: v.name, startDate: toDbDate(v.start), endDate: end ? toDbDate(end) : null, note: v.note || null }
  if (input.id) {
    const n = await prisma.clientPhase.updateMany({ where: { id: input.id, clientId }, data })
    if (!n.count) return { ok: false, message: 'この期は見つかりませんでした' }
  } else {
    await prisma.clientPhase.create({ data: { ...data, clientId, createdById: user.id } })
  }
  refresh(clientId)
  return { ok: true }
}

export async function deletePhaseAction(clientId: string, id: string): Promise<Result> {
  await requireUser()
  await prisma.clientPhase.deleteMany({ where: { id, clientId } })
  refresh(clientId)
  return { ok: true }
}

// ── 月ごとのテーマ
export async function saveThemesAction(clientId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const months = String(fd.get('months') ?? '')
    .split(',')
    .filter((m) => /^\d{4}-\d{2}$/.test(m))
    .slice(0, 24)
  for (const month of months) {
    const theme = String(fd.get(`t_${month}_theme`) ?? '').trim().slice(0, 100) || null
    const trainingTheme = String(fd.get(`t_${month}_training`) ?? '').trim().slice(0, 100) || null
    if (!theme && !trainingTheme) await prisma.monthlyTheme.deleteMany({ where: { clientId, month } })
    else await prisma.monthlyTheme.upsert({ where: { clientId_month: { clientId, month } }, update: { theme, trainingTheme, updatedById: user.id }, create: { clientId, month, theme, trainingTheme, updatedById: user.id } })
  }
  refresh(clientId)
  return { ok: true, message: '月ごとのテーマを保存しました', at: Date.now() }
}

// ── 自律神経の測定（PDF・画像）
const MAX_BYTES = 3.5 * 1024 * 1024
const TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp']

export async function uploadAnsAction(clientId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const file = fd.get('file')
  const measuredOn = String(fd.get('measuredOn') ?? '')
  const note = String(fd.get('note') ?? '').trim().slice(0, 300) || null
  if (!isYmd(measuredOn)) return { ok: false, message: '測定日を選んでください', at: Date.now() }
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: 'ファイルを選んでください', at: Date.now() }
  if (!TYPES.includes(file.type)) return { ok: false, message: 'PDF か画像（JPEG・PNG）を選んでください', at: Date.now() }
  if (file.size > MAX_BYTES) return { ok: false, message: 'ファイルが大きすぎます（3.5MBまで）', at: Date.now() }
  if (!(await clientExists(clientId))) return { ok: false, message: 'お客様が見つかりませんでした', at: Date.now() }
  const data = Buffer.from(await file.arrayBuffer())
  await prisma.ansMeasurement.create({ data: { clientId, measuredOn: toDbDate(measuredOn), fileName: file.name.slice(0, 120) || 'measurement.pdf', mimeType: file.type, size: file.size, data, note, createdById: user.id } })
  refresh(clientId)
  return { ok: true, message: '測定結果を保存しました', at: Date.now() }
}

export async function deleteAnsAction(clientId: string, id: string): Promise<Result> {
  await requireUser()
  await prisma.ansMeasurement.deleteMany({ where: { id, clientId } })
  refresh(clientId)
  return { ok: true }
}

// ── 宿題（Todo）
export async function addHomeworkAction(clientId: string, input: { text: string; assignedOn?: string }): Promise<Result> {
  const user = await requireUser()
  const text = input.text.trim().slice(0, 200)
  if (!text) return { ok: false, message: '宿題の内容を入れてください' }
  if (!(await clientExists(clientId))) return { ok: false, message: 'お客様が見つかりませんでした' }
  const assignedOn = input.assignedOn && isYmd(input.assignedOn) ? input.assignedOn : todayYmd()
  await prisma.homework.create({ data: { clientId, text, assignedOn: toDbDate(assignedOn), createdById: user.id } })
  refresh(clientId)
  return { ok: true }
}

/** 結果をつける（できた／一部／できなかった）。again なら同じ宿題を次回にも出す */
export async function checkHomeworkAction(clientId: string, id: string, status: string, opts: { note?: string; again?: boolean; on?: string } = {}): Promise<Result> {
  const user = await requireUser()
  if (!['done', 'partial', 'not_done'].includes(status)) return { ok: false, message: '結果を選んでください' }
  const hw = await prisma.homework.findFirst({ where: { id, clientId } })
  if (!hw) return { ok: false, message: 'この宿題は見つかりませんでした' }
  const on = opts.on && isYmd(opts.on) ? opts.on : todayYmd()
  await prisma.homework.update({ where: { id }, data: { status, checkedOn: toDbDate(on), checkedById: user.id, note: opts.note?.trim().slice(0, 200) || null } })
  if (opts.again) await prisma.homework.create({ data: { clientId, text: hw.text, assignedOn: toDbDate(on), createdById: user.id } })
  refresh(clientId)
  return { ok: true }
}

export async function deleteHomeworkAction(clientId: string, id: string): Promise<Result> {
  await requireUser()
  await prisma.homework.deleteMany({ where: { id, clientId } })
  refresh(clientId)
  return { ok: true }
}
