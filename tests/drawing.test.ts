import { describe, expect, it } from 'vitest'
import { PAGE_H, PAGE_W, emptyDrawing, isEmptyDrawing, parseDrawing, strokeCount, strokePath } from '@/lib/drawing'
import { monthlyAverages, recentVolumes } from '@/lib/calc/training'

describe('手書きメモの保存形式', () => {
  it('正しい線はそのまま残し、壊れた値は捨てる', () => {
    const d = parseDrawing({
      v: 1,
      pages: [
        [
          { c: 'ink', s: 7, p: [10, 20, 0.5, 30, 40, 0.6], pen: true },
          { c: 'purple', s: 7, p: [1, 2, 0.5] }, // 未対応の色
          { c: 'red', s: 7, p: [1, 2] }, // 点が足りない
          { c: 'blue', s: 4, p: [-50, 99999, 3, 'x', 5, 0.5] }, // 範囲外は丸める・数でない値は捨てる
        ],
        'broken',
      ],
    })
    expect(d.pages).toHaveLength(1)
    expect(d.pages[0]).toHaveLength(2)
    expect(d.pages[0][0]).toEqual({ c: 'ink', s: 7, p: [10, 20, 0.5, 30, 40, 0.6], pen: true })
    expect(d.pages[0][1].p).toEqual([0, PAGE_H, 1])
    expect(strokeCount(d)).toBe(2)
  })
  it('空・不正な値は空のノートになる', () => {
    expect(isEmptyDrawing(parseDrawing(null))).toBe(true)
    expect(parseDrawing({ pages: 'x' })).toEqual(emptyDrawing())
    expect(PAGE_W).toBe(1000)
  })
  it('線は塗りつぶしの path になる（点だけでも丸になる）', () => {
    expect(strokePath({ c: 'ink', s: 7, p: [10, 10, 0.5, 60, 60, 0.5, 120, 80, 0.5], pen: true })).toMatch(/^M.*Z$/)
    expect(strokePath({ c: 'ink', s: 7, p: [10, 10, 0.5] })).toMatch(/^M/)
  })
})

describe('手書きメモだけの回', () => {
  const sessions = [
    { date: '2026-09-01', rows: [{ bodyPart: '脚', exercise: 'スクワット', weightKg: 40, reps: 10, sets: 3 }] },
    { date: '2026-09-08', rows: [] },
  ]
  it('総負荷量のグラフや月平均には入れない', () => {
    expect(recentVolumes(sessions, '2026-09-30', 14).map((v) => v.date)).toEqual(['2026-09-01'])
    expect(monthlyAverages(sessions, '2026-09-30', 1)[0]).toMatchObject({ sessions: 1, average: 1200 })
  })
})
