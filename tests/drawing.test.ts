import { describe, expect, it } from 'vitest'
import { PAGE_H, PAGE_W, drawingThumb, emptyDrawing, isEmptyDrawing, parseDrawing, parseThumb, previewCrop, simplifyStroke, strokeCount, strokePath } from '@/lib/drawing'
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

describe('手書きメモの小さな表示（一覧用）', () => {
  it('まっすぐな線は両端の2点だけになる', () => {
    const p: number[] = []
    for (let i = 0; i <= 100; i++) p.push(100 + i * 5, 200, 0.5)
    expect(simplifyStroke(p, 2.5)).toEqual([100, 200, 600, 200])
  })

  it('曲がり角は残る', () => {
    const p = [0, 0, 0.5, 50, 0, 0.5, 100, 0, 0.5, 100, 50, 0.5, 100, 100, 0.5]
    expect(simplifyStroke(p, 1)).toEqual([0, 0, 100, 0, 100, 100])
  })

  it('最初に書き込みのあるページを、色と太さごとにまとめた線にする', () => {
    const data = parseDrawing({
      v: 1,
      pages: [
        [],
        [
          { c: 'ink', s: 7, p: [10, 10, 0.5, 60, 10, 0.5] },
          { c: 'ink', s: 7, p: [10, 40, 0.5, 60, 45, 0.5] },
          { c: 'marker', s: 30, p: [0, 100, 0.5, 300, 100, 0.5] },
          { c: 'red', s: 4, p: [500, 500, 0.5] },
        ],
        [{ c: 'blue', s: 4, p: [1, 1, 0.5, 2, 2, 0.5] }],
      ],
    })
    const t = drawingThumb(data)!
    expect(t.page).toBe(1)
    expect(t.pages).toBe(2)
    // マーカーは下（最初）に描く
    expect(t.paths[0].c).toBe('marker')
    const ink = t.paths.find((x) => x.c === 'ink')!
    expect(ink.d).toBe('M10 10l50 0M10 40l50 5')
    // 点だけの線も長さ0の線として残す
    expect(t.paths.find((x) => x.c === 'red')!.d).toBe('M500 500l0 0')
    expect(t.box).toEqual([0, 10, 500, 500])
    expect(parseThumb(JSON.parse(JSON.stringify(t)))).toEqual(t)
    // 前の形式（書き込みの範囲がない）は作り直す扱い
    expect(parseThumb({ ...t, v: 1 })).toBeNull()
  })

  it('一覧では書き込みのある所から、最大でページの半分の高さを見せる', () => {
    const thumb = (top: number, bottom: number) => ({ v: 2 as const, pages: 1, page: 0, box: [0, top, 100, bottom] as [number, number, number, number], paths: [] })
    // 短いメモは書いてある所だけ（最低320）
    expect(previewCrop(thumb(100, 200))).toEqual({ y: 40, h: 320, cut: false })
    // 長いメモはページの半分で切って、続きがあることを示す
    expect(previewCrop(thumb(100, 1200))).toEqual({ y: 40, h: PAGE_H / 2, cut: true })
    // ページの下の方だけに書いたときも、書いてある所を見せる
    expect(previewCrop(thumb(1100, 1250))).toEqual({ y: 980, h: 320, cut: false })
  })

  it('書き込みがなければ作らない。形の違う保存値は作り直す扱い', () => {
    expect(drawingThumb(parseDrawing({ v: 1, pages: [[]] }))).toBeNull()
    expect(parseThumb({ v: 2, pages: 1, page: 0, box: [0, 0, 1, 1], paths: [{ c: 'ink', w: 5, d: '<script>' }] })?.paths).toEqual([])
    expect(parseThumb(null)).toBeNull()
  })
})
