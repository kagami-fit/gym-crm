'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'
import { isYmd, toDbDate } from '@/lib/dates'
import { isTalkKind } from '@/lib/labels'
import { toTalkRow, type TalkInput, type TalkResult } from '@/lib/data/talk'

// 会話メモの追加・変更・削除（画面の一覧はその場で書き換えるので、ページの再読み込みはしない）

const talkSchema = z.object({
  date: z.string().refine(isYmd, '日付が正しくありません'),
  kind: z.string().refine(isTalkKind, '種類を選んでください'),
  text: z.string().trim().min(1, '内容を入れてください').max(1000, '1000文字までにしてください'),
})

const include = { createdBy: { select: { name: true } } } as const

function parse(input: TalkInput) {
  const r = talkSchema.safeParse(input)
  return r.success ? { ok: true as const, data: r.data } : { ok: false as const, message: r.error.issues[0]?.message ?? '入力内容を確認してください' }
}

export async function addTalkAction(clientId: string, input: TalkInput): Promise<TalkResult> {
  const user = await requireUser()
  const v = parse(input)
  if (!v.ok) return v
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } })
  if (!client) return { ok: false, message: 'お客様が見つかりませんでした' }
  const row = await prisma.talkNote.create({ data: { clientId, date: toDbDate(v.data.date), kind: v.data.kind, text: v.data.text, createdById: user.id }, include })
  return { ok: true, note: toTalkRow(row) }
}

export async function updateTalkAction(clientId: string, id: string, input: TalkInput): Promise<TalkResult> {
  await requireUser()
  const v = parse(input)
  if (!v.ok) return v
  const found = await prisma.talkNote.findFirst({ where: { id, clientId }, select: { id: true } })
  if (!found) return { ok: false, message: 'このメモは見つかりませんでした（削除された可能性があります）' }
  const row = await prisma.talkNote.update({ where: { id }, data: { date: toDbDate(v.data.date), kind: v.data.kind, text: v.data.text }, include })
  return { ok: true, note: toTalkRow(row) }
}

export async function deleteTalkAction(clientId: string, id: string): Promise<{ ok: boolean; message?: string }> {
  await requireUser()
  const r = await prisma.talkNote.deleteMany({ where: { id, clientId } })
  return r.count ? { ok: true } : { ok: false, message: 'このメモは見つかりませんでした' }
}
