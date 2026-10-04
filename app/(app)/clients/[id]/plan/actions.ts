'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'
import { cleanConditionItems } from '@/lib/condition'
import { isYmd, toDbDate, todayYmd } from '@/lib/dates'
import { toNumberOrNull } from '@/lib/format'
import { getCalcSettings } from '@/lib/data/settings'
import { isAnsLevel, isAnsType, isDietPolicy } from '@/lib/labels'
import { cleanChecks, isMovementStatus, movementOf, sidesStatus, type MovementStatus } from '@/lib/movements'
import type { ActionState } from '@/components/SubmitButton'

// 指導計画（フェーズ・食事方針・月のテーマ・自律神経・動作・体調）と宿題

type Result = { ok: true } | { ok: false; message: string }
const fail = (message: string): Result => ({ ok: false, message })
const refresh = (clientId: string) => {
  revalidatePath(`/clients/${clientId}`, 'layout')
  revalidatePath('/clients')
  revalidatePath('/alerts')
}

async function clientExists(id: string) {
  return !!(await prisma.client.findUnique({ where: { id }, select: { id: true } }))
}

const optYmd = (v: string | undefined | null) => (v && isYmd(v) ? v : null)
const optText = (v: string | undefined | null, max: number) => v?.trim().slice(0, max) || null

// ── フェーズ
const phaseSchema = z.object({
  name: z.string().trim().min(1, 'フェーズの名前を入れてください').max(30, '30文字までにしてください'),
  start: z.string().refine(isYmd, '開始日を選んでください'),
  end: z.string().optional(),
  reviewDate: z.string().optional(),
  visitFrequency: z.string().trim().max(20, '来店頻度は20文字までにしてください').optional(),
  note: z.string().trim().max(300, '理由は300文字までにしてください').optional(),
})

export type PhaseInput = { id?: string; name: string; start: string; end?: string; reviewDate?: string; visitFrequency?: string; note?: string }

/** フェーズを追加・変更する。2つ目からのフェーズを追加するときは、変えた理由を必ず残す */
export async function savePhaseAction(clientId: string, input: PhaseInput): Promise<Result> {
  const user = await requireUser()
  const r = phaseSchema.safeParse(input)
  if (!r.success) return fail(r.error.issues[0]?.message ?? '入力内容を確認してください')
  const v = r.data
  const end = optYmd(v.end)
  const reviewDate = optYmd(v.reviewDate)
  if (end && end < v.start) return fail('終わりの日は開始日より後にしてください')
  if (reviewDate && reviewDate < v.start) return fail('見直し予定日は開始日より後にしてください')
  if (!(await clientExists(clientId))) return fail('お客様が見つかりませんでした')
  const data = { name: v.name, startDate: toDbDate(v.start), endDate: end ? toDbDate(end) : null, reviewDate: reviewDate ? toDbDate(reviewDate) : null, visitFrequency: v.visitFrequency || null, note: v.note || null }
  if (input.id) {
    const n = await prisma.clientPhase.updateMany({ where: { id: input.id, clientId }, data })
    if (!n.count) return fail('このフェーズは見つかりませんでした')
  } else {
    const earlier = await prisma.clientPhase.count({ where: { clientId, startDate: { lt: toDbDate(v.start) } } })
    if (earlier > 0 && !v.note) return fail('フェーズを変えた理由を入れてください')
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

// ── 食事方針と目標（変えるたびに1件追加して履歴にする）
export type PolicyInput = {
  policy: string
  policyName?: string
  startDate: string
  targetWeightKg?: string
  paceKey?: string
  activityFactor?: string
  targetDate?: string
  endDate?: string
  reviewDate?: string
  note?: string
}

export async function savePolicyAction(clientId: string, input: PolicyInput): Promise<Result> {
  const user = await requireUser()
  const settings = await getCalcSettings()
  const policy = input.policy
  if (!isDietPolicy(policy)) return fail('食事方針を選んでください')
  const start = input.startDate
  if (!isYmd(start)) return fail('開始日を入れてください')
  const policyName = policy === 'other' ? optText(input.policyName, 30) : null
  if (policy === 'other' && !policyName) return fail('方針の名前を入れてください')
  const target = toNumberOrNull(input.targetWeightKg ?? null)
  if (target != null && (target < 20 || target > 250)) return fail('体重は20〜250kgで入れてください')
  const activity = toNumberOrNull(input.activityFactor ?? null)
  if (activity != null && (activity < 1 || activity > 2.5)) return fail('活動係数を選び直してください')
  const targetDate = optYmd(input.targetDate)
  const endDate = policy === 'reverse' ? optYmd(input.endDate) : null
  const reviewDate = optYmd(input.reviewDate)
  const note = optText(input.note, 300)
  let paceKey: string | null = null
  if (policy === 'loss') {
    if (target == null) return fail('目標体重を入れてください')
    if (!settings.paces.some((p) => p.key === input.paceKey)) return fail('減量ペースを選んでください')
    if (activity == null) return fail('活動係数を選んでください')
    paceKey = input.paceKey!
  }
  if (policy === 'reverse') {
    if (!endDate) return fail('コーフラックスは終了予定日を決めてください')
    if (endDate < start) return fail('終了予定日は開始日より後にしてください')
  }
  if (policy === 'maintain' && target == null && !note) return fail('維持したい体重か、維持したい状態（メモ）を入れてください')
  if (targetDate && targetDate < start) return fail('目標日は開始日より後にしてください')
  if (reviewDate && reviewDate < start) return fail('見直し予定日は開始日より後にしてください')
  if (!(await clientExists(clientId))) return fail('お客様が見つかりませんでした')

  const at = await prisma.bodyLog.findFirst({ where: { clientId, date: { lte: toDbDate(start) }, weightKg: { not: null } }, orderBy: { date: 'desc' } })
  const fat = await prisma.bodyLog.findFirst({ where: { clientId, date: { lte: toDbDate(start) }, bodyFatPct: { not: null } }, orderBy: { date: 'desc' } })
  await prisma.goal.create({
    data: {
      clientId,
      startDate: toDbDate(start),
      policy,
      policyName,
      startWeightKg: at?.weightKg ?? null,
      startBodyFatPct: fat?.bodyFatPct ?? null,
      targetWeightKg: target,
      paceKey,
      activityFactor: activity,
      targetDate: targetDate ? toDbDate(targetDate) : null,
      endDate: endDate ? toDbDate(endDate) : null,
      reviewDate: reviewDate ? toDbDate(reviewDate) : null,
      note,
      createdById: user.id,
    },
  })
  refresh(clientId)
  return { ok: true }
}

export async function deletePolicyAction(clientId: string, id: string): Promise<Result> {
  await requireUser()
  await prisma.goal.deleteMany({ where: { id, clientId } })
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

// ── 自律神経の測定（condiView の測定票の PDF・写真と、活性度の2本の棒）
const MAX_BYTES = 3.5 * 1024 * 1024
const TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp']

type Evaluation = { sympathetic: number | null; sympatheticLevel: string | null; parasympathetic: number | null; parasympatheticLevel: string | null; ansType: string | null; note: string | null }

/** 活性度の数値（0〜30）と位置（低い・基準内・高い・空＝未確認）、型（A〜D・空＝未確定）、評価メモ */
function readEvaluation(get: (k: string) => string): { ok: true; data: Evaluation } | { ok: false; message: string } {
  const values: Record<string, number | null> = {}
  for (const [k, label] of [['sympathetic', '交感神経'], ['parasympathetic', '副交感神経']] as const) {
    const raw = get(k).trim()
    const n = raw ? toNumberOrNull(raw) : null
    if (raw && (n == null || n < 0 || n > 30)) return { ok: false, message: `${label}の数値は0〜30で入れてください` }
    values[k] = n
  }
  const lv = (k: string) => (isAnsLevel(get(k)) ? get(k) : null)
  const type = get('ansType')
  return {
    ok: true,
    data: {
      sympathetic: values.sympathetic,
      sympatheticLevel: lv('sympatheticLevel'),
      parasympathetic: values.parasympathetic,
      parasympatheticLevel: lv('parasympatheticLevel'),
      ansType: isAnsType(type) ? type : null,
      note: get('note').trim().slice(0, 500) || null,
    },
  }
}

export async function uploadAnsAction(clientId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const file = fd.get('file')
  const measuredOn = String(fd.get('measuredOn') ?? '')
  if (!isYmd(measuredOn)) return { ok: false, message: '測定日を選んでください', at: Date.now() }
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: '測定票のファイルを選んでください', at: Date.now() }
  if (!TYPES.includes(file.type)) return { ok: false, message: 'PDF か画像（JPEG・PNG）を選んでください', at: Date.now() }
  if (file.size > MAX_BYTES) return { ok: false, message: 'ファイルが大きすぎます（3.5MBまで）', at: Date.now() }
  const ev = readEvaluation((k) => String(fd.get(k) ?? ''))
  if (!ev.ok) return { ok: false, message: ev.message, at: Date.now() }
  if (!(await clientExists(clientId))) return { ok: false, message: 'お客様が見つかりませんでした', at: Date.now() }
  const data = Buffer.from(await file.arrayBuffer())
  await prisma.ansMeasurement.create({
    data: {
      ...ev.data,
      clientId,
      measuredOn: toDbDate(measuredOn),
      fileName: file.name.slice(0, 120) || 'measurement.pdf',
      mimeType: file.type,
      size: file.size,
      data,
      createdById: user.id,
    },
  })
  refresh(clientId)
  return { ok: true, message: '測定結果を保存しました', at: Date.now() }
}

/** 保存済みの測定に、活性度の数値・位置・型・評価メモを入れる・直す */
export async function updateAnsAction(clientId: string, id: string, input: Record<string, string>): Promise<Result> {
  await requireUser()
  const ev = readEvaluation((k) => input[k] ?? '')
  if (!ev.ok) return fail(ev.message)
  const measuredOn = input.measuredOn
  const n = await prisma.ansMeasurement.updateMany({
    where: { id, clientId },
    data: { ...ev.data, ...(isYmd(measuredOn) ? { measuredOn: toDbDate(measuredOn) } : {}) },
  })
  if (!n.count) return fail('この測定結果は見つかりませんでした')
  refresh(clientId)
  return { ok: true }
}

export async function deleteAnsAction(clientId: string, id: string): Promise<Result> {
  await requireUser()
  await prisma.ansMeasurement.deleteMany({ where: { id, clientId } })
  refresh(clientId)
  return { ok: true }
}

// ── 動作の評価（ピラティスの達成状況）。評価のたびに1件ふえる
export type MovementInput = { date: string; movement: string; status?: string; checks?: Record<string, string>; condition?: string; note?: string }

export async function saveMovementCheckAction(clientId: string, input: MovementInput): Promise<Result> {
  const user = await requireUser()
  const m = movementOf(input.movement)
  if (!m) return fail('動きを選んでください')
  if (!isYmd(input.date)) return fail('評価日を選んでください')
  const checks = cleanChecks(m, input.checks ?? {})
  let status: MovementStatus
  if (m.sides) {
    const left = checks.left
    const right = checks.right
    if (!isMovementStatus(left) || !isMovementStatus(right)) return fail('左右それぞれの達成状況を選んでください')
    status = sidesStatus(left, right)
  } else {
    if (!isMovementStatus(input.status)) return fail('達成状況を選んでください')
    status = input.status
  }
  if (!(await clientExists(clientId))) return fail('お客様が見つかりませんでした')
  await prisma.movementCheck.create({
    data: {
      clientId,
      date: toDbDate(input.date),
      movement: m.key,
      status,
      checks: Object.keys(checks).length ? checks : undefined,
      condition: optText(input.condition, 100),
      note: optText(input.note, 200),
      createdById: user.id,
    },
  })
  refresh(clientId)
  return { ok: true }
}

export async function deleteMovementCheckAction(clientId: string, id: string): Promise<Result> {
  await requireUser()
  await prisma.movementCheck.deleteMany({ where: { id, clientId } })
  refresh(clientId)
  return { ok: true }
}

// ── 体調チェック（本人の訴え）。1日1件（同じ日に保存すると上書き）
export type ConditionInput = { date: string; items: Record<string, string>; painArea?: string; note?: string }

export async function saveConditionCheckAction(clientId: string, input: ConditionInput): Promise<Result> {
  const user = await requireUser()
  if (!isYmd(input.date)) return fail('日付を選んでください')
  const items = cleanConditionItems(input.items)
  const painArea = optText(input.painArea, 60)
  const note = optText(input.note, 300)
  if (!Object.keys(items).length && !painArea && !note) return fail('どれか1つは選ぶか、メモを入れてください')
  if (!(await clientExists(clientId))) return fail('お客様が見つかりませんでした')
  const date = toDbDate(input.date)
  await prisma.conditionCheck.upsert({
    where: { clientId_date: { clientId, date } },
    update: { items, painArea, note },
    create: { clientId, date, items, painArea, note, createdById: user.id },
  })
  refresh(clientId)
  return { ok: true }
}

export async function deleteConditionCheckAction(clientId: string, id: string): Promise<Result> {
  await requireUser()
  await prisma.conditionCheck.deleteMany({ where: { id, clientId } })
  refresh(clientId)
  return { ok: true }
}

// ── 宿題（Todo）
export async function addHomeworkAction(clientId: string, input: { text: string; assignedOn?: string }): Promise<Result> {
  const user = await requireUser()
  const text = input.text.trim().slice(0, 200)
  if (!text) return fail('宿題の内容を入れてください')
  if (!(await clientExists(clientId))) return fail('お客様が見つかりませんでした')
  const assignedOn = input.assignedOn && isYmd(input.assignedOn) ? input.assignedOn : todayYmd()
  await prisma.homework.create({ data: { clientId, text, assignedOn: toDbDate(assignedOn), createdById: user.id } })
  refresh(clientId)
  return { ok: true }
}

/** 結果をつける（できた／一部／できなかった）。again なら同じ宿題を次回にも出す */
export async function checkHomeworkAction(clientId: string, id: string, status: string, opts: { note?: string; again?: boolean; on?: string } = {}): Promise<Result> {
  const user = await requireUser()
  if (!['done', 'partial', 'not_done'].includes(status)) return fail('結果を選んでください')
  const hw = await prisma.homework.findFirst({ where: { id, clientId } })
  if (!hw) return fail('この宿題は見つかりませんでした')
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
