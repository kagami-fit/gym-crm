import { describe, expect, it } from 'vitest'
import { plan, projection, progress, composition } from '@/lib/calc/body'
import { DEFAULT_SETTINGS, normalizeSettings, findPace } from '@/lib/calc/settings'
import { estimate1RM, metricSeries, monthlyAverages, recentVolumes, volume } from '@/lib/calc/training'
import { addDays, ageAt, daysEndingAt, diffDays, mdw } from '@/lib/dates'

const S = DEFAULT_SETTINGS
const gentle = findPace(S, 'gentle')!

describe('参考シート「目標カロリー・栄養素計算表」と同じ結果になる', () => {
  const body = { weightKg: 67.17603578, bodyFatPct: 17.56960054, heightCm: 175.5, age: null, gender: null }
  const p = plan(S, body, { targetWeightKg: 65, pace: gentle, activityFactor: 1.2 })

  it('体組成', () => {
    expect(p.composition.bmi).toBeCloseTo(21.8102242, 5)
    expect(p.composition.fatMassKg).toBeCloseTo(11.80256115, 5)
    expect(p.composition.leanMassKg).toBeCloseTo(55.37347464, 5)
    expect(p.composition.idealWeight22).toBeCloseTo(67.76055, 4)
  })
  it('カロリーとPFC', () => {
    expect(p.bmr).toBeCloseTo(1578.144027, 4)
    expect(p.tdee).toBeCloseTo(1893.772833, 4)
    expect(p.dailyDeficit).toBeCloseTo(161.2224859, 4)
    expect(p.targetKcal).toBeCloseTo(1732.550347, 4)
    expect(p.proteinG).toBeCloseTo(110.7469493, 4)
    expect(p.fatG).toBeCloseTo(48.12639852, 4)
    expect(p.carbsG).toBeCloseTo(214.1062407, 4)
    expect(p.waterMl).toBeCloseTo(2351.161252, 3)
    expect(p.meatG).toBeCloseTo(553.7347464, 3)
    expect(p.riceG).toBeCloseTo(594.7395576, 3)
  })
  it('目標', () => {
    expect(p.totalDeficitKcal).toBeCloseTo(15667.45763, 3)
    expect(p.daysToGoal).toBeCloseTo(97.17910965, 4)
    expect(p.target?.bmi).toBeCloseTo(21.10372481, 5)
    expect(p.target?.bodyFatPct).toBeCloseTo(14.81003902, 5)
    expect(p.target?.fatMassKg).toBeCloseTo(9.626525364, 5)
    expect(p.warnings).toEqual([])
  })
  it('予測は目標体重で止まり、1ヶ月目は現体重の1%減', () => {
    const rows = projection(S, { baseDate: '2026-09-24', weightKg: 67.17603578, fatMassKg: p.composition.fatMassKg, targetWeightKg: 65, dailyDeficit: p.dailyDeficit! }, 'month', 6)
    expect(rows[0].weightKg).toBeCloseTo(66.50427542, 5)
    expect(rows[0].date).toBe('2026-10-24')
    expect(rows[3].weightKg).toBeCloseTo(65, 6)
    expect(rows[5].weightKg).toBeCloseTo(65, 6)
    expect(rows[3].reached).toBe(true)
    expect(rows[2].reached).toBe(false)
    const total = rows.reduce((a, r) => a + r.periodLossKg, 0)
    expect(total).toBeCloseTo(67.17603578 - 65, 6)
  })
})

describe('参考シート「体験セッションシート」', () => {
  const p = plan(S, { weightKg: 72, bodyFatPct: 12, heightCm: 175, age: 30, gender: 'male' }, { targetWeightKg: 60, pace: gentle, activityFactor: 1.5 })
  it('同じ値になり、無理な目標には警告が出る', () => {
    expect(p.bmr).toBeCloseTo(1805.76, 4)
    expect(p.tdee).toBeCloseTo(2708.64, 4)
    expect(p.dailyDeficit).toBeCloseTo(172.8, 6)
    expect(p.daysToGoal).toBeCloseTo(500, 6)
    expect(p.targetKcal).toBeCloseTo(2535.84, 4)
    expect(p.carbsG).toBeCloseTo(348.75, 4)
    expect(p.warnings[0]).toContain('除脂肪体重')
  })
})

describe('設定の切り替え', () => {
  it('ペース「普通」は削減カロリーが2倍', () => {
    const normal = findPace(S, 'normal')!
    const a = plan(S, { weightKg: 60, bodyFatPct: 30, heightCm: 160, age: 40, gender: 'female' }, { targetWeightKg: 55, pace: normal, activityFactor: 1.5 })
    expect(a.dailyDeficit).toBeCloseTo((60 * 0.02 * 7200) / 30, 6)
  })
  it('基礎代謝の式を変えられる', () => {
    const b = { weightKg: 60, bodyFatPct: 30, heightCm: 160, age: 40, gender: 'female' as const }
    const g = { targetWeightKg: 55, pace: gentle, activityFactor: 1.5 }
    expect(plan({ ...S, bmrMethod: 'katch' }, b, g).bmr).toBeCloseTo(370 + 21.6 * 42, 6)
    expect(plan({ ...S, bmrMethod: 'harris' }, b, g).bmr).toBeCloseTo(9.247 * 60 + 3.098 * 160 - 4.33 * 40 + 447.593, 6)
    expect(plan({ ...S, bmrMethod: 'ganpule' }, b, g).bmr).toBeCloseTo(((0.0481 * 60 + 0.0234 * 160 - 0.0138 * 40 - 0.5473) * 1000) / 4.186, 6)
    expect(plan({ ...S, bmrMethod: 'ganpule' }, { ...b, age: null }, g).missing).toContain('生年月日')
  })
  it('体脂肪率がないと除脂肪体重の式は計算しない', () => {
    const r = plan(S, { weightKg: 60, bodyFatPct: null, heightCm: 160, age: 40, gender: 'female' }, { targetWeightKg: 55, pace: gentle, activityFactor: 1.5 })
    expect(r.bmr).toBeNull()
    expect(r.missing).toContain('体脂肪率')
  })
  it('目標達成済みなら削減は0（維持カロリー）', () => {
    const r = plan(S, { weightKg: 64, bodyFatPct: 20, heightCm: 170, age: 30, gender: 'male' }, { targetWeightKg: 65, pace: gentle, activityFactor: 1.2 })
    expect(r.dailyDeficit).toBe(0)
    expect(r.targetKcal).toBeCloseTo(r.tdee!, 6)
    expect(r.daysToGoal).toBe(0)
  })
  it('壊れた保存値は初期値で補う', () => {
    const n = normalizeSettings({ bmrLbmFactor: 'x', fatRatioPct: 30, paces: [] })
    expect(n.bmrLbmFactor).toBe(28.5)
    expect(n.fatRatioPct).toBe(30)
    expect(n.paces).toHaveLength(3)
  })
  it('体組成（体脂肪率なし）', () => {
    expect(composition({ weightKg: 60, bodyFatPct: null, heightCm: null, age: null, gender: null }).bmi).toBeNull()
  })
})

describe('目標の進捗', () => {
  it('予定ペースとの差', () => {
    const pr = progress(S, { startDate: '2026-06-01', startWeightKg: 70, targetWeightKg: 65, pace: gentle, baseDate: '2026-07-01', currentWeightKg: 69 })
    expect(pr.elapsedDays).toBe(30)
    expect(pr.plannedWeightKg).toBeCloseTo(69.3, 6)
    expect(pr.aheadKg).toBeCloseTo(0.3, 6)
    expect(pr.progressPct).toBeCloseTo(20, 6)
    expect(pr.plannedGoalDate).toBe(addDays('2026-06-01', Math.ceil(5 / (0.7 / 30))))
  })
})

describe('トレーニング', () => {
  it('総負荷量と推定1RM（参考シートと同じ O\'Conner 式）', () => {
    expect(volume({ weightKg: 10, reps: 10, sets: 3 })).toBe(300)
    expect(estimate1RM('oconner', 10, 10)).toBeCloseTo(12.5, 6)
    expect(estimate1RM('epley', 100, 5)).toBeCloseTo(116.6666667, 5)
    expect(estimate1RM('brzycki', 100, 5)).toBeCloseTo(112.5, 6)
    expect(estimate1RM('oconner', 50, 1)).toBe(50)
  })
  const sessions = [
    { date: '2026-08-01', rows: [{ bodyPart: '脚', exercise: 'スクワット', weightKg: 40, reps: 10, sets: 3 }] },
    { date: '2026-08-15', rows: [{ bodyPart: '脚', exercise: 'スクワット', weightKg: 50, reps: 8, sets: 3 }, { bodyPart: '胸', exercise: 'ベンチプレス', weightKg: 30, reps: 10, sets: 3 }] },
    { date: '2026-09-02', rows: [{ bodyPart: '胸', exercise: 'ベンチプレス', weightKg: 32.5, reps: 10, sets: 3 }] },
    { date: '2026-09-30', rows: [{ bodyPart: '脚', exercise: 'スクワット', weightKg: 60, reps: 5, sets: 3 }] },
  ]
  it('基準日より後の記録は含めない', () => {
    const v = recentVolumes(sessions, '2026-09-24', 14)
    expect(v.map((x) => x.date)).toEqual(['2026-08-01', '2026-08-15', '2026-09-02'])
    expect(v[1].volume).toBe(50 * 8 * 3 + 30 * 10 * 3)
  })
  it('月間平均は1回あたり', () => {
    const m = monthlyAverages(sessions, '2026-09-24', 3)
    expect(m.map((x) => x.month)).toEqual(['2026-07', '2026-08', '2026-09'])
    expect(m[0].average).toBeNull()
    expect(m[1].average).toBeCloseTo((1200 + 1200 + 900) / 2, 6)
  })
  it('部位別・種目別', () => {
    const legs = metricSeries(sessions, { bodyPart: '脚' }, '2026-09-24', 14, 'oconner')
    expect(legs).toHaveLength(2)
    expect(legs[1].maxWeight).toBe(50)
    expect(legs[1].max1RM).toBeCloseTo(60, 6)
    const bench = metricSeries(sessions, { exercise: 'ベンチプレス' }, '2026-09-24', 1, 'oconner')
    expect(bench.map((b) => b.date)).toEqual(['2026-09-02'])
  })
})

describe('日付', () => {
  it('日本時間の暦日で計算する', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(diffDays('2026-09-01', '2026-09-24')).toBe(23)
    expect(ageAt('1990-09-25', '2026-09-24')).toBe(35)
    expect(ageAt('1990-09-24', '2026-09-24')).toBe(36)
    expect(daysEndingAt('2026-09-24', 3)).toEqual(['2026-09-22', '2026-09-23', '2026-09-24'])
    expect(mdw('2026-09-24')).toBe('9/24(木)')
  })
})
