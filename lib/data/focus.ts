import { progress } from '@/lib/calc/body'
import { findPace } from '@/lib/calc/settings'
import type { Ymd } from '@/lib/dates'
import { alertsOf } from '@/lib/questionnaire'
import { getGoals, getLatestBody, goalAt, resolveStartWeight } from './body'
import { getClient } from './clients'
import { getQuestionnaire } from './questionnaire'
import { getCalcSettings } from './settings'

/** トレーニング中にいつも見えるところに出す、お客様の目的・目標・注意事項 */
export type FocusInfo = {
  /** 目的（台帳。なければ問診票） */
  purposes: string[]
  /** 具体的な目標・なりたい姿（問診票） */
  wish: string | null
  /** 期限・目標にしているイベント（問診票） */
  deadline: string | null
  goal: {
    targetWeightKg: number
    paceName: string | null
    note: string | null
    currentWeightKg: number | null
    currentDate: Ymd | null
    /** 目標まであと何kg（増やす目標は増やす量）。達成していれば 0 */
    remainingKg: number | null
    gain: boolean
    /** 予定ペースより何kg先行しているか（マイナスは遅れ。減量の目標のときだけ） */
    aheadKg: number | null
  } | null
  /** 問診で「あり」だった項目 */
  cautions: Array<{ label: string; detail: string }>
}

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

export async function getFocusInfo(clientId: string, base: Ymd): Promise<FocusInfo> {
  const [client, q, goals, latest, settings] = await Promise.all([getClient(clientId), getQuestionnaire(clientId), getGoals(clientId), getLatestBody(clientId, base), getCalcSettings()])
  const answers = q?.answers ?? {}
  const qPurposes = Array.isArray(answers.purposes) ? answers.purposes.filter((p) => p !== 'その他') : []

  const goal = goalAt(goals, base)
  let g: FocusInfo['goal'] = null
  if (goal) {
    const pace = findPace(settings, goal.paceKey)
    const cur = latest.weight
    const startWeight = await resolveStartWeight(clientId, goal)
    const gain = startWeight != null ? goal.targetWeightKg > startWeight : cur != null && goal.targetWeightKg > cur.value
    let remainingKg: number | null = null
    let aheadKg: number | null = null
    if (cur) {
      remainingKg = Math.max(0, gain ? goal.targetWeightKg - cur.value : cur.value - goal.targetWeightKg)
      if (!gain && pace && startWeight != null) {
        const pr = progress(settings, { startDate: goal.startDate, startWeightKg: startWeight, targetWeightKg: goal.targetWeightKg, pace, baseDate: base, currentWeightKg: cur.value })
        aheadKg = pr.aheadKg
      }
    }
    g = { targetWeightKg: goal.targetWeightKg, paceName: pace?.name ?? null, note: goal.note, currentWeightKg: cur?.value ?? null, currentDate: cur?.date ?? null, remainingKg, gain, aheadKg }
  }

  return {
    purposes: client.purposes.length ? client.purposes : qPurposes,
    wish: text(answers.goalDetail),
    deadline: text(answers.deadline),
    goal: g,
    cautions: q ? alertsOf(q.answers) : [],
  }
}
