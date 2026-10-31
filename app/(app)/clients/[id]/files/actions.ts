'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'
import { isYmd, toDbDate } from '@/lib/dates'

// お客様の写真・資料（来店ごとのログの写真・カルテの原本など）

type Result = { ok: true } | { ok: false; message: string }
const MAX_BYTES = 3.5 * 1024 * 1024
const TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp']

/** 1ファイルずつ保存する（写真は画面の側で小さくしてから送る）。sessionId があれば、その回のログの写真になる */
export async function uploadClientFileAction(clientId: string, fd: FormData): Promise<Result> {
  const user = await requireUser()
  const file = fd.get('file')
  const date = String(fd.get('date') ?? '')
  const sessionId = String(fd.get('sessionId') ?? '') || null
  const title = String(fd.get('title') ?? '').trim().slice(0, 60) || null
  const note = String(fd.get('note') ?? '').trim().slice(0, 300) || null
  if (!isYmd(date)) return { ok: false, message: '日付を選んでください' }
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: 'ファイルを選んでください' }
  if (!TYPES.includes(file.type)) return { ok: false, message: '写真（JPEG・PNG）か PDF を選んでください' }
  if (file.size > MAX_BYTES) return { ok: false, message: `${file.name} が大きすぎます（3.5MBまで）` }
  if (!(await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } }))) return { ok: false, message: 'お客様が見つかりませんでした' }
  if (sessionId && !(await prisma.trainingSession.findFirst({ where: { id: sessionId, clientId }, select: { id: true } }))) return { ok: false, message: 'この回の記録が見つかりませんでした' }
  const data = Buffer.from(await file.arrayBuffer())
  await prisma.clientFile.create({
    data: { clientId, sessionId, date: toDbDate(date), kind: file.type === 'application/pdf' ? 'document' : 'photo', title, fileName: file.name.slice(0, 120) || 'file', mimeType: file.type, size: file.size, data, note, createdById: user.id },
  })
  revalidatePath(`/clients/${clientId}`, 'layout')
  return { ok: true }
}

/** 何の写真か（タイトル）・メモを直す */
export async function updateClientFileAction(clientId: string, id: string, input: { title?: string; note?: string }): Promise<Result> {
  await requireUser()
  const n = await prisma.clientFile.updateMany({ where: { id, clientId }, data: { title: input.title?.trim().slice(0, 60) || null, note: input.note?.trim().slice(0, 300) || null } })
  if (!n.count) return { ok: false, message: 'このファイルは見つかりませんでした' }
  revalidatePath(`/clients/${clientId}`, 'layout')
  return { ok: true }
}

export async function deleteClientFileAction(clientId: string, id: string): Promise<Result> {
  await requireUser()
  await prisma.clientFile.deleteMany({ where: { id, clientId } })
  revalidatePath(`/clients/${clientId}`, 'layout')
  return { ok: true }
}
