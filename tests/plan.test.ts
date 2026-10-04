import { describe, expect, it } from 'vitest'
import { overdue } from '@/lib/alerts/rules'
import { DEFAULT_ALERT_SETTINGS as S } from '@/lib/alerts/settings'
import { cleanConditionItems, conditionTrend } from '@/lib/condition'
import { addDays } from '@/lib/dates'
import { DIET_POLICIES, policyLabel } from '@/lib/labels'
import { cleanChecks, movementOf, sidesStatus } from '@/lib/movements'
import { ansChanges, ansShort, ansState, changeHistory, checkpoints, lossGuide, overdueItems, reversePeriods, visitsPerWeek, weeklyChange, weightChangePct, type PolicyLike } from '@/lib/plan'
import { resolvePhases } from '@/lib/steps'

const today = '2026-10-04'

describe('自律神経の評価（活性度の2本の棒）', () => {
  it('両方が基準内のときだけ「良い状態」', () => {
    expect(ansState({ sympatheticLevel: 'normal', parasympatheticLevel: 'normal' })).toEqual({ state: 'good', text: '両方が基準内（良い状態）' })
  })
  it('反映事項の表示例：交感神経は基準内、副交感神経は低い', () => {
    const r = { sympatheticLevel: 'normal', parasympatheticLevel: 'low' } as const
    expect(ansState(r)).toEqual({ state: 'out', text: '副交感神経が基準より低い状態' })
    expect(ansShort(r)).toBe('交感神経は基準内、副交感神経は低い')
  })
  it('両方低い・片方高くて片方低い', () => {
    expect(ansState({ sympatheticLevel: 'low', parasympatheticLevel: 'low' }).text).toBe('交感神経・副交感神経がどちらも基準より低い状態')
    expect(ansState({ sympatheticLevel: 'high', parasympatheticLevel: 'low' }).text).toBe('交感神経が基準より高く、副交感神経が基準より低い状態')
  })
  it('位置を選んでいなければ未評価（数値だけでは判定しない）', () => {
    expect(ansState(null)).toEqual({ state: 'unknown', text: '未評価' })
    expect(ansState({ sympatheticLevel: null, parasympatheticLevel: null }).state).toBe('unknown')
    expect(ansState({ sympatheticLevel: 'normal', parasympatheticLevel: null }).text).toBe('副交感神経の位置が未確認')
  })
  it('前回との比較：数値の増減と位置の変化', () => {
    const prev = { sympathetic: 4.84, sympatheticLevel: 'low', parasympathetic: 4.89, parasympatheticLevel: 'low' } as const
    const cur = { sympathetic: 7.68, sympatheticLevel: 'normal', parasympathetic: 4.96, parasympatheticLevel: 'low' } as const
    const [s, p] = ansChanges(prev, cur)
    expect(s.delta).toBeCloseTo(2.84)
    expect(s).toMatchObject({ fromLevel: 'low', toLevel: 'normal', moved: true })
    expect(p.delta).toBeCloseTo(0.07)
    expect(p.moved).toBe(false)
    expect(ansChanges(null, cur)[0]).toMatchObject({ from: null, delta: null, moved: false })
  })
})

describe('体重の評価', () => {
  it('減少率＝（比較元−現在）÷比較元×100。例：60kg→57kgは5%', () => {
    expect(weightChangePct(60, 57)).toBeCloseTo(5)
    expect(weightChangePct(60, 61.2)).toBeCloseTo(-2)
  })
  it('3ヶ月で5%の参考目安（60kgなら3kg）', () => {
    expect(lossGuide(60, '2026-07-01', { weightKg: 58.8, date: '2026-08-12' })).toMatchObject({ guideKg: 3, guideWeightKg: 57, elapsedDays: 42 })
    expect(lossGuide(60, '2026-07-01', { weightKg: 58.8, date: '2026-08-12' }).changePct).toBeCloseTo(2)
  })
  it('週の変化は、ちょうど7日前の記録がある日だけ比べる', () => {
    const pts = [
      { date: '2026-09-20', weightKg: 60 },
      { date: '2026-09-26', weightKg: 59.7 },
      { date: '2026-09-27', weightKg: 59.3 },
      { date: '2026-10-03', weightKg: 59.0 },
    ]
    // 10/3 の7日前（9/26）がある → 10/3 と 9/26 を比べる
    expect(weeklyChange(pts, today)).toMatchObject({ date: '2026-10-03', prevDate: '2026-09-26', from: 59.7, to: 59 })
    // 9/27 と 9/20（1.17%減）→ 週1%以上の減少
    const w = weeklyChange(pts, '2026-09-27')!
    expect(w.pct).toBeCloseTo(1.17, 1)
    expect(w.fast).toBe(true)
  })
  it('7日前の記録がなければ週の評価は作らない（6日・8日の間隔は使わない）', () => {
    expect(weeklyChange([{ date: '2026-09-27', weightKg: 60 }, { date: '2026-10-03', weightKg: 59 }], today)).toBeNull()
    expect(weeklyChange([{ date: '2026-09-25', weightKg: 60 }, { date: '2026-10-03', weightKg: 59 }], today)).toBeNull()
  })
  it('4週間より前の組み合わせは使わない', () => {
    expect(weeklyChange([{ date: '2026-08-01', weightKg: 60 }, { date: '2026-08-08', weightKg: 59 }], today)).toBeNull()
  })
})

describe('食事方針', () => {
  it('フェーズ1：回復食・バランス食・そのほか／フェーズ2：コーフラックス・減量・維持', () => {
    const byPhase = (n: number) => Object.values(DIET_POLICIES).filter((p) => p.phase === n).map((p) => p.label)
    expect(byPhase(1)).toEqual(['回復食', 'バランス食', 'そのほか'])
    expect(byPhase(2)).toEqual(['コーフラックス', '減量', '維持'])
    expect(policyLabel('other', '消化にやさしい食事')).toBe('消化にやさしい食事')
    expect(policyLabel('reverse')).toBe('コーフラックス')
  })
  it('コーフラックス：終了予定日・目標日までの日数と、終了後に減量に使える日数', () => {
    expect(reversePeriods('2027-01-10', '2027-04-01', '2027-12-01')).toEqual({ toEnd: 81, toTarget: 325, afterEnd: 244 })
    expect(reversePeriods('2027-04-05', '2027-04-01', null)).toEqual({ toEnd: -4, toTarget: null, afterEnd: null })
  })
})

const policy = (p: Partial<PolicyLike>): PolicyLike => ({ id: 'g1', startDate: '2026-08-01', policy: 'reverse', policyName: null, targetWeightKg: null, targetDate: null, endDate: null, reviewDate: null, note: null, ...p })

describe('予定日を過ぎたもの', () => {
  const phases = resolvePhases([
    { id: 'p1', name: 'フェーズ1', start: '2026-06-01', end: null, note: null },
    { id: 'p2', name: 'フェーズ2', start: '2026-08-01', end: null, note: null, reviewDate: '2026-10-01' },
  ])
  it('コーフラックスの終了予定日を過ぎた・フェーズの見直し予定日を過ぎた（過ぎた日数の多い順）', () => {
    const items = overdueItems(phases, policy({ endDate: '2026-09-24' }), today)
    expect(items.map((i) => [i.label, i.days])).toEqual([
      ['コーフラックスの終了予定日（9/24）', 10],
      ['フェーズ2の見直し予定日（10/1）', 3],
    ])
  })
  it('その日はまだ過ぎていない。減量には終了予定日を使わない', () => {
    expect(overdueItems(phases.slice(0, 1), policy({ endDate: today }), today)).toEqual([])
    expect(overdueItems(phases.slice(0, 1), policy({ policy: 'loss', endDate: '2026-09-01' }), today)).toEqual([])
  })
  it('食事方針の見直し予定日・目標日', () => {
    const items = overdueItems(phases.slice(0, 1), policy({ policy: 'balance', reviewDate: '2026-09-30', targetDate: '2026-10-02' }), today)
    expect(items.map((i) => i.label)).toEqual(['バランス食の見直し予定日（9/30）', '目標日（10/2）'])
  })
  it('終わりの日を決めたフェーズが過ぎて、次のフェーズがない', () => {
    const ended = resolvePhases([{ id: 'p1', name: 'フェーズ1', start: '2026-06-01', end: '2026-09-30', note: null }])
    expect(overdueItems(ended, null, today)).toMatchObject([{ label: 'フェーズ1の終わりの日（9/30）', days: 4 }])
  })
  it('お知らせ：一番過ぎている日数で段階（初期値 1日＝黄・7日＝橙・14日＝赤）。予定日が変わると別のお知らせ', () => {
    const one = overdue(overdueItems(phases.slice(0, 1), policy({ endDate: addDays(today, -1) }), today), S.overdue)
    expect(one).toMatchObject({ rule: 'overdue', level: 'info', title: 'コーフラックスの終了予定日（10/3）を1日過ぎています' })
    const two = overdue(overdueItems(phases, policy({ endDate: addDays(today, -15) }), today), S.overdue)
    expect(two).toMatchObject({ level: 'alert', title: '予定日を過ぎたものが2件（コーフラックスの終了予定日（9/19）を15日過ぎ）' })
    expect(two!.fingerprint).not.toBe(one!.fingerprint)
    expect(overdue([], S.overdue)).toBeNull()
  })
})

describe('現在地', () => {
  it('確認する点（フェーズ1は自律神経・痛みと疲労・基礎動作、フェーズ2は方針ごと）', () => {
    expect(checkpoints('フェーズ1', 'recovery')).toEqual(['自律神経の推移', '痛み・疲労', '基礎動作の進捗'])
    expect(checkpoints('フェーズ2', 'reverse')[0]).toBe('体重を増やさずに摂取カロリーを上げられているか')
    expect(checkpoints('フェーズ2', null)).toEqual(['食事方針を決める'])
    expect(checkpoints(null, null)).toEqual(['フェーズと食事方針を決める'])
  })
  it('実際の来店ペース（直近8週。来店が短ければ最初の来店から）', () => {
    const weekly = Array.from({ length: 8 }, (_, i) => addDays(today, -7 * i))
    expect(visitsPerWeek(weekly, today)).toBe(1)
    // 最初の来店から11日（2週）で4回 → 週2回
    expect(visitsPerWeek([today, addDays(today, -3), addDays(today, -7), addDays(today, -10)], today)).toBe(2)
    expect(visitsPerWeek([], today)).toBeNull()
  })
  it('変更の履歴（新しい順。同じ日はフェーズが先）', () => {
    const phases = resolvePhases([
      { id: 'p1', name: 'フェーズ1', start: '2026-06-01', end: null, note: '疲れが強い' },
      { id: 'p2', name: 'フェーズ2', start: '2026-08-01', end: null, note: '両方基準内に' },
    ])
    const h = changeHistory(phases, [policy({ startDate: '2026-08-01', policy: 'loss' }), policy({ id: 'g0', startDate: '2026-06-01', policy: 'recovery' })])
    expect(h.map((x) => x.title)).toEqual(['フェーズ2へ', '食事方針：減量', 'フェーズ1へ', '食事方針：回復食'])
  })
})

describe('動作の評価・体調チェック', () => {
  it('側屈は左右とも達成で達成、どちらかを練習・達成していれば練習中', () => {
    expect(sidesStatus('achieved', 'achieved')).toBe('achieved')
    expect(sidesStatus('achieved', 'untested')).toBe('practicing')
    expect(sidesStatus('untested', 'untested')).toBe('untested')
  })
  it('確認項目は定義にある答えだけ残す', () => {
    expect(cleanChecks(movementOf('flexion')!, { heel: 'つく', other: 'x' })).toEqual({ heel: 'つく' })
    expect(cleanChecks(movementOf('flexion')!, { heel: 'たぶん' })).toEqual({})
    expect(cleanChecks(movementOf('lateral')!, { left: 'achieved', right: 'bad' })).toEqual({ left: 'achieved' })
  })
  it('体調：定義にある項目・段階だけ残し、初回と最新を比べる', () => {
    expect(cleanConditionItems({ fatigue: 'strong', pain: 'none', foo: 'mild', sleep: 'x' })).toEqual({ fatigue: 'strong', pain: 'none' })
    expect(conditionTrend('strong', 'mild')).toBe('better')
    expect(conditionTrend('none', 'mild')).toBe('worse')
    expect(conditionTrend('mild', 'mild')).toBe('same')
    expect(conditionTrend(undefined, 'mild')).toBeNull()
  })
})
