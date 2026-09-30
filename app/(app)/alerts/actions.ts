'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'
import { addDays, isYmd, toDbDate, todayYmd } from '@/lib/dates'
import { isLevel, isRule } from '@/lib/alerts/rules'

// お知らせの対応（対応した／あとで／止める・再開）と、自分で作るお知らせ
// 変えたらベルの件数や一覧が変わるので、画面全体を読み直す

type Result = { ok: true } | { ok: false; message: string }
const done = (): Result => {
  revalidatePath('/', 'layout')
  return { ok: true }
}
/** ◯日後にまた出す（0 は今すぐ戻す） */
const snoozeDays = (days: number) => toDbDate(addDays(todayYmd(), Math.min(60, Math.max(0, Math.round(days)))))

async function clientExists(id: string) {
  return !!(await prisma.client.findUnique({ where: { id }, select: { id: true } }))
}

/** 自動のお知らせに「対応した」（ひとことメモつき） */
export async function alertDoneAction(input: { clientId: string; rule: string; fingerprint: string; note?: string }): Promise<Result> {
  const user = await requireUser()
  if (!isRule(input.rule) || !input.fingerprint || !(await clientExists(input.clientId))) return { ok: false, message: 'お知らせが見つかりませんでした' }
  await prisma.alertAction.create({ data: { clientId: input.clientId, rule: input.rule, fingerprint: input.fingerprint, action: 'done', note: input.note?.trim().slice(0, 500) || null, byId: user.id } })
  return done()
}

/** 自動のお知らせを「あとで」（◯日後にまた出す） */
export async function alertSnoozeAction(input: { clientId: string; rule: string; fingerprint: string; days: number }): Promise<Result> {
  const user = await requireUser()
  if (!isRule(input.rule) || !input.fingerprint || !(await clientExists(input.clientId))) return { ok: false, message: 'お知らせが見つかりませんでした' }
  await prisma.alertAction.create({ data: { clientId: input.clientId, rule: input.rule, fingerprint: input.fingerprint, action: 'snooze', until: snoozeDays(input.days), byId: user.id } })
  return done()
}

/** このお客様では、この種類のお知らせを止める／再開する */
export async function alertMuteAction(input: { clientId: string; rule: string; mute: boolean }): Promise<Result> {
  const user = await requireUser()
  if (!isRule(input.rule) || !(await clientExists(input.clientId))) return { ok: false, message: 'お知らせが見つかりませんでした' }
  await prisma.alertAction.create({ data: { clientId: input.clientId, rule: input.rule, fingerprint: '*', action: input.mute ? 'mute' : 'unmute', byId: user.id } })
  return done()
}

const reminderSchema = z.object({
  clientId: z.string().min(1, 'お客様を選んでください'),
  text: z.string().trim().min(1, '内容を入れてください').max(300, '300文字までにしてください'),
  trigger: z.enum(['date', 'next_visit']),
  dueDate: z.string().optional(),
  level: z.string().refine(isLevel, '段階を選んでください'),
})

/** 自分で作るお知らせ */
export async function createReminderAction(input: { clientId: string; text: string; trigger: string; dueDate?: string; level: string }): Promise<Result> {
  const user = await requireUser()
  const r = reminderSchema.safeParse(input)
  if (!r.success) return { ok: false, message: r.error.issues[0]?.message ?? '入力内容を確認してください' }
  const v = r.data
  if (v.trigger === 'date' && !isYmd(v.dueDate)) return { ok: false, message: '知らせる日を選んでください' }
  if (!(await clientExists(v.clientId))) return { ok: false, message: 'お客様が見つかりませんでした' }
  await prisma.reminder.create({
    data: { clientId: v.clientId, text: v.text, trigger: v.trigger, dueDate: toDbDate(v.trigger === 'date' ? v.dueDate! : todayYmd()), level: v.level, createdById: user.id },
  })
  return done()
}

export async function reminderDoneAction(id: string, note?: string): Promise<Result> {
  const user = await requireUser()
  const r = await prisma.reminder.updateMany({ where: { id, status: 'open' }, data: { status: 'done', doneAt: new Date(), doneById: user.id, doneNote: note?.trim().slice(0, 500) || null } })
  return r.count ? done() : { ok: false, message: 'お知らせが見つかりませんでした' }
}

export async function reminderSnoozeAction(id: string, days: number): Promise<Result> {
  await requireUser()
  const r = await prisma.reminder.updateMany({ where: { id, status: 'open' }, data: { snoozeUntil: snoozeDays(days) } })
  return r.count ? done() : { ok: false, message: 'お知らせが見つかりませんでした' }
}

export async function deleteReminderAction(id: string): Promise<Result> {
  await requireUser()
  const r = await prisma.reminder.deleteMany({ where: { id } })
  return r.count ? done() : { ok: false, message: 'お知らせが見つかりませんでした' }
}
