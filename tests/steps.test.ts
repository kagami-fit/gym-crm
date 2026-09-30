import { describe, expect, it } from 'vitest'
import { HOMEWORK_STATUS, PHASE_OTHER_COLOR, PHASE_PRESETS, isHomeworkStatus, phaseColors } from '@/lib/labels'
import { phaseAt, phaseDays, phasesInMonth, resolvePhases, themeMonths } from '@/lib/steps'

const row = (id: string, name: string, start: string, end: string | null = null) => ({ id, name, start, end, note: null })

describe('期（顧客ステップ）', () => {
  const phases = resolvePhases([row('b', 'ピラティス期', '2026-06-08'), row('a', '自律神経期', '2026-04-27'), row('c', '筋トレ期', '2026-08-10')])

  it('開始日の順に並べ、終わりが空なら次の期の前日まで。最後の期は続いている', () => {
    expect(phases.map((p) => [p.name, p.start, p.until])).toEqual([
      ['自律神経期', '2026-04-27', '2026-06-07'],
      ['ピラティス期', '2026-06-08', '2026-08-09'],
      ['筋トレ期', '2026-08-10', null],
    ])
  })

  it('終わりの日を入れた期は、その日で終わる（次の期までのあいだは期なし）', () => {
    const p = resolvePhases([row('a', '自律神経期', '2026-04-01', '2026-04-20'), row('b', 'ピラティス期', '2026-05-01')])
    expect(p[0].until).toBe('2026-04-20')
    expect(phaseAt(p, '2026-04-25')).toBeNull()
    expect(phaseAt(p, '2026-05-01')?.name).toBe('ピラティス期')
  })

  it('その日の期・その月にかかっている期', () => {
    expect(phaseAt(phases, '2026-06-07')?.name).toBe('自律神経期')
    expect(phaseAt(phases, '2026-06-08')?.name).toBe('ピラティス期')
    expect(phaseAt(phases, '2026-12-01')?.name).toBe('筋トレ期')
    expect(phaseAt(phases, '2026-04-26')).toBeNull()
    expect(phasesInMonth(phases, '2026-06').map((p) => p.name)).toEqual(['自律神経期', 'ピラティス期'])
    expect(phasesInMonth(phases, '2026-07').map((p) => p.name)).toEqual(['ピラティス期'])
    expect(phasesInMonth(phases, '2026-03')).toEqual([])
  })

  it('期の長さ（続いている期は基準日まで）', () => {
    expect(phaseDays(phases[0], '2026-09-30')).toBe(42)
    expect(phaseDays(phases[2], '2026-09-30')).toBe(52)
  })

  it('色：自律神経期・ピラティス期・筋トレ期は決まった色（3つとも別の色）、ほかの名前は「その他」の灰色', () => {
    const c = phaseColors(['自律神経期', 'ピラティス期', '筋トレ期', '減量期', '維持期'])
    expect(c.get('自律神経期')).toBe(PHASE_PRESETS[0].color)
    expect(c.get('ピラティス期')).toBe(PHASE_PRESETS[1].color)
    expect(c.get('筋トレ期')).toBe(PHASE_PRESETS[2].color)
    expect(new Set(PHASE_PRESETS.map((p) => p.color)).size).toBe(3)
    expect(c.get('減量期')).toBe(PHASE_OTHER_COLOR)
    expect(c.get('維持期')).toBe(PHASE_OTHER_COLOR)
  })

  it('期の色は、体重（金）・体脂肪率（青）のグラフの線の色と重ならない', () => {
    const colors = [...phaseColors(['自律神経期', 'ピラティス期', '筋トレ期', 'A']).values()]
    expect(colors).not.toContain('#c98500')
    expect(colors).not.toContain('#2a78d6')
  })
})

describe('月ごとのテーマ', () => {
  it('入会月から基準日の翌月まで、新しい月が上', () => {
    expect(themeMonths('2026-07-15', '2026-09-30')).toEqual(['2026-10', '2026-09', '2026-08', '2026-07'])
  })
  it('年をまたぐ・最大12ヶ月・入会日がないときは直近6ヶ月', () => {
    expect(themeMonths('2025-11-01', '2026-01-10')).toEqual(['2026-02', '2026-01', '2025-12', '2025-11'])
    expect(themeMonths('2024-01-01', '2026-09-30')).toHaveLength(12)
    expect(themeMonths(null, '2026-09-30')).toEqual(['2026-10', '2026-09', '2026-08', '2026-07', '2026-06', '2026-05', '2026-04'])
  })
})

describe('宿題の結果', () => {
  it('未確認・できた・一部できた・できなかった の4つ', () => {
    expect(Object.values(HOMEWORK_STATUS).map((s) => s.label)).toEqual(['未確認', 'できた', '一部できた', 'できなかった'])
    expect(isHomeworkStatus('partial')).toBe(true)
    expect(isHomeworkStatus('skip')).toBe(false)
  })
})
