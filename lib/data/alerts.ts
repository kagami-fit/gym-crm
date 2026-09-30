import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { progress } from '@/lib/calc/body'
import { findPace } from '@/lib/calc/settings'
import { addDays, fromDbDate, toDbDate, todayYmd, type Ymd } from '@/lib/dates'
import * as R from '@/lib/alerts/rules'
import { normalizeAlertSettings, type AlertSettings } from '@/lib/alerts/settings'
import type { AppUser } from '@/lib/auth'
import { getCalcSettings } from './settings'
import { goalAt, type GoalRow } from './body'

// お知らせ（アラート）の集計。自動のお知らせは毎回データから計算し、対応（AlertAction）で表示を切り替える。
// 自分で作るお知らせ（Reminder）はそのまま読む。

export type AlertItem = {
  /** 画面の key（auto:お客様:条件 ／ rem:ID） */
  key: string
  source: 'auto' | 'manual'
  clientId: string
  clientName: string
  trainerName: string | null
  rule?: R.RuleKey
  reminderId?: string
  level: R.Level
  title: string
  detail?: string
  fingerprint?: string
  /** 関係する画面 */
  href: string
  /** いつからの状況か・知らせる日 */
  date: Ymd | null
  trigger?: 'date' | 'next_visit'
  snoozeUntil?: Ymd
  createdByName?: string | null
}
export type AlertDone = { key: string; clientId: string; clientName: string; title: string; note: string | null; byName: string | null; at: string }
export type MutedRule = { clientId: string; clientName: string; rule: R.RuleKey; label: string }
export type AlertBoard = {
  /** 対応が必要（件数に数える） */
  open: AlertItem[]
  /** 次の来店時に知らせる（まだ来店していない） */
  nextVisit: AlertItem[]
  /** 日付がまだ先 */
  upcoming: AlertItem[]
  /** 「あとで」にしたもの */
  snoozed: AlertItem[]
  /** 最近対応したもの（14日） */
  done: AlertDone[]
  /** このお客様では止めている条件 */
  muted: MutedRule[]
}

export const getAlertSettings = cache(async (): Promise<AlertSettings> => {
  const row = await prisma.appSetting.findUnique({ where: { key: 'alerts' } })
  return normalizeAlertSettings(row?.value)
})

const byLevelThenDate = (a: AlertItem, b: AlertItem) => R.LEVELS[b.level].rank - R.LEVELS[a.level].rank || ((b.date ?? '') < (a.date ?? '') ? -1 : 1)

async function buildBoard(clients: Array<{ id: string; name: string; status: string; trainerName: string | null }>, today: Ymd): Promise<AlertBoard> {
  const board: AlertBoard = { open: [], nextVisit: [], upcoming: [], snoozed: [], done: [], muted: [] }
  if (!clients.length) return board
  const ids = clients.map((c) => c.id)
  const [settings, calc, logs, lastVisits, sessions, weeks, notes, reminders, actions, goals] = await Promise.all([
    getAlertSettings(),
    getCalcSettings(),
    prisma.bodyLog.findMany({ where: { clientId: { in: ids }, weightKg: { not: null }, date: { gte: toDbDate(addDays(today, -90)), lte: toDbDate(today) } }, select: { clientId: true, date: true, weightKg: true } }),
    prisma.trainingSession.groupBy({ by: ['clientId'], where: { clientId: { in: ids }, date: { lte: toDbDate(today) } }, _max: { date: true } }),
    prisma.trainingSession.findMany({
      where: { clientId: { in: ids }, date: { gte: toDbDate(addDays(today, -150)), lte: toDbDate(today) } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, clientId: true, date: true, sets: { orderBy: { order: 'asc' }, select: { exercise: true, weightKg: true, reps: true } } },
    }),
    prisma.nutritionWeek.findMany({ where: { clientId: { in: ids }, weekStart: { gte: toDbDate(addDays(today, -84)) } } }),
    prisma.talkNote.findMany({ where: { clientId: { in: ids }, kind: { in: ['negative', 'body'] }, date: { gte: toDbDate(addDays(today, -60)) } }, select: { id: true, clientId: true, date: true, kind: true, text: true } }),
    prisma.reminder.findMany({
      where: { clientId: { in: ids }, OR: [{ status: 'open' }, { status: 'done', doneAt: { gte: new Date(Date.now() - 14 * 86400_000) } }] },
      include: { createdBy: { select: { name: true } } },
    }),
    prisma.alertAction.findMany({ where: { clientId: { in: ids } }, orderBy: { createdAt: 'asc' }, include: { by: { select: { name: true } } } }),
    prisma.goal.findMany({ where: { clientId: { in: ids } }, orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }] }),
  ])
  const doneUsers = new Map((await prisma.user.findMany({ where: { id: { in: reminders.map((r) => r.doneById).filter((x): x is string => !!x) } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]))

  for (const c of clients) {
    const base = `/clients/${c.id}`
    const item = (x: Omit<AlertItem, 'clientId' | 'clientName' | 'trainerName'>): AlertItem => ({ ...x, clientId: c.id, clientName: c.name, trainerName: c.trainerName })
    const lastVisitRaw = lastVisits.find((v) => v.clientId === c.id)?._max.date
    const lastVisit = lastVisitRaw ? fromDbDate(lastVisitRaw) : null

    // ── 自動のお知らせ（在籍中・体験中のお客様だけ）
    if (c.status === 'active' || c.status === 'trial') {
      const pts = logs.filter((l) => l.clientId === c.id).map((l) => ({ date: fromDbDate(l.date), kg: l.weightKg! })).sort((a, b) => (a.date < b.date ? -1 : 1))
      const latest = pts[pts.length - 1] ?? null
      const goalRows: GoalRow[] = goals.filter((g) => g.clientId === c.id).map((g) => ({ ...g, startDate: fromDbDate(g.startDate) }))
      const goal = goalAt(goalRows, today)
      const lossGoal = !!goal && !!latest && goal.targetWeightKg < latest.kg
      const found: R.AutoAlert[] = []
      let plateau: R.AutoAlert | null = null
      if (settings.plateau.enabled && lossGoal) {
        plateau = R.plateau(pts, today, settings.plateau)
        if (plateau) found.push(plateau)
      }
      if (settings.dietFlat.enabled) {
        const w = weeks.filter((x) => x.clientId === c.id).map((x) => ({ ...x, weekStart: fromDbDate(x.weekStart) }))
        const d = R.dietFlat(w, !!plateau, settings.dietFlat)
        if (d) found.push(d)
      }
      if (settings.noProgress.enabled) {
        const s = sessions.filter((x) => x.clientId === c.id).map((x) => ({ id: x.id, date: fromDbDate(x.date), rows: x.sets }))
        const d = R.noProgress(s, today, settings.noProgress)
        if (d) found.push(d)
      }
      if (settings.noVisit.enabled && c.status === 'active') {
        const d = R.noVisit(lastVisit, today, settings.noVisit)
        if (d) found.push(d)
      }
      if (settings.behindPace.enabled && goal && lossGoal && latest) {
        const pace = findPace(calc, goal.paceKey)
        const start = goal.startWeightKg ?? pts.find((p) => p.date >= goal.startDate)?.kg ?? null
        if (pace && start != null) {
          const pr = progress(calc, { startDate: goal.startDate, startWeightKg: start, targetWeightKg: goal.targetWeightKg, pace, baseDate: today, currentWeightKg: latest.kg })
          const d = R.behindPace(pr.aheadKg, settings.behindPace)
          if (d) found.push(d)
        }
      }
      if (settings.talk.enabled) {
        const d = R.talk(
          notes.filter((n) => n.clientId === c.id).map((n) => ({ ...n, date: fromDbDate(n.date) })),
          today,
          settings.talk,
        )
        if (d) found.push(d)
      }

      const acts = actions.filter((a) => a.clientId === c.id)
      const mutedRules = new Set<string>()
      for (const rule of Object.keys(R.RULES)) {
        const last = acts.filter((a) => a.rule === rule && a.fingerprint === '*').at(-1)
        if (last?.action === 'mute') {
          mutedRules.add(rule)
          board.muted.push({ clientId: c.id, clientName: c.name, rule: rule as R.RuleKey, label: R.RULES[rule as R.RuleKey].label })
        }
      }
      for (const a of found) {
        if (mutedRules.has(a.rule)) continue
        const last = acts.filter((x) => x.rule === a.rule && x.fingerprint === a.fingerprint).at(-1)
        if (last?.action === 'done') continue
        const tab = R.RULES[a.rule].tab
        const it = item({ key: `auto:${c.id}:${a.rule}`, source: 'auto', rule: a.rule, level: a.level, title: a.title, detail: a.detail, fingerprint: a.fingerprint, href: tab ? `${base}/${tab}` : base, date: a.since ?? null })
        const until = last?.action === 'snooze' && last.until ? fromDbDate(last.until) : null
        if (until && until > today) board.snoozed.push({ ...it, snoozeUntil: until })
        else board.open.push(it)
      }
      for (const a of acts.filter((x) => x.action === 'done' && x.createdAt.getTime() >= Date.now() - 14 * 86400_000)) {
        board.done.push({ key: `act:${a.id}`, clientId: c.id, clientName: c.name, title: isRuleLabel(a.rule), note: a.note, byName: a.by?.name ?? null, at: a.createdAt.toISOString() })
      }
    }

    // ── 自分で作るお知らせ
    for (const r of reminders.filter((x) => x.clientId === c.id)) {
      if (r.status === 'done') {
        board.done.push({ key: `rem:${r.id}`, clientId: c.id, clientName: c.name, title: r.text, note: r.doneNote, byName: r.doneById ? doneUsers.get(r.doneById) ?? null : null, at: (r.doneAt ?? r.updatedAt).toISOString() })
        continue
      }
      const due = fromDbDate(r.dueDate)
      const trigger = r.trigger === 'next_visit' ? 'next_visit' : 'date'
      const it = item({
        key: `rem:${r.id}`,
        source: 'manual',
        reminderId: r.id,
        level: R.isLevel(r.level) ? r.level : 'info',
        title: r.text,
        href: `${base}/training`,
        date: due,
        trigger,
        createdByName: r.createdBy?.name ?? null,
      })
      const until = r.snoozeUntil ? fromDbDate(r.snoozeUntil) : null
      if (until && until > today) board.snoozed.push({ ...it, snoozeUntil: until })
      else if (trigger === 'next_visit') (lastVisit && lastVisit > due ? board.open : board.nextVisit).push(it)
      else (due > today ? board.upcoming : board.open).push(it)
    }
  }
  board.open.sort(byLevelThenDate)
  board.nextVisit.sort(byLevelThenDate)
  board.snoozed.sort((a, b) => ((a.snoozeUntil ?? '') < (b.snoozeUntil ?? '') ? -1 : 1))
  board.upcoming.sort((a, b) => ((a.date ?? '') < (b.date ?? '') ? -1 : 1))
  board.done.sort((a, b) => (a.at < b.at ? 1 : -1))
  return board
}

const isRuleLabel = (rule: string) => (R.isRule(rule) ? R.RULES[rule].label : rule)

/** お知らせの対象になるお客様（退会以外）。「自分の担当」は、担当が自分か担当なしのお客様 */
async function scopeClients(userId: string, scope: 'mine' | 'all') {
  const rows = await prisma.client.findMany({
    where: { status: { not: 'left' }, ...(scope === 'mine' ? { OR: [{ trainerId: userId }, { trainerId: null }] } : {}) },
    select: { id: true, name: true, status: true, trainer: { select: { name: true } } },
    orderBy: [{ kana: 'asc' }, { name: 'asc' }],
  })
  return rows.map((c) => ({ id: c.id, name: c.name, status: c.status, trainerName: c.trainer?.name ?? null }))
}

/** 一覧（ベルのページ・顧客一覧の印）用。同じ表示のあいだは1回だけ計算する */
export const getAlertBoard = cache(async (userId: string, scope: 'mine' | 'all'): Promise<AlertBoard> => {
  return buildBoard(await scopeClients(userId, scope), todayYmd())
})

/** 1人のお客様のお知らせ（顧客ページ用。担当に関係なく出す） */
export const getClientAlertBoard = cache(async (clientId: string): Promise<AlertBoard> => {
  const today = todayYmd()
  const c = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true, status: true, trainer: { select: { name: true } } } })
  if (!c) return { open: [], nextVisit: [], upcoming: [], snoozed: [], done: [], muted: [] }
  return buildBoard([{ id: c.id, name: c.name, status: c.status, trainerName: c.trainer?.name ?? null }], today)
})

/** 既定の表示範囲（オーナーは全員、スタッフは自分の担当） */
export const defaultScope = (user: Pick<AppUser, 'role'>): 'mine' | 'all' => (user.role === 'owner' ? 'all' : 'mine')

/** お客様ごとの「対応が必要」の件数と一番重い段階（顧客一覧の印） */
export function summarizeByClient(board: AlertBoard): Map<string, { count: number; level: R.Level }> {
  const out = new Map<string, { count: number; level: R.Level }>()
  for (const a of board.open) {
    const cur = out.get(a.clientId)
    if (!cur) out.set(a.clientId, { count: 1, level: a.level })
    else out.set(a.clientId, { count: cur.count + 1, level: R.LEVELS[a.level].rank > R.LEVELS[cur.level].rank ? a.level : cur.level })
  }
  return out
}
