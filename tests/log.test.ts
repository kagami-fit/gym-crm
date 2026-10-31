import { describe, expect, it } from 'vitest'
import { cleanDetail, detailSummary, detailText, detailVolume, normalizeSprings, parseSprings, springsText } from '@/lib/log'
import { volume } from '@/lib/calc/training'

describe('バネの略記（ピラティスマシン）', () => {
  it('全角・小文字・区切りのゆれをそろえる', () => {
    expect(normalizeSprings('1r1y')).toBe('1R＋1Y')
    expect(normalizeSprings('１Ｒ・１Ｙ')).toBe('1R＋1Y')
    expect(normalizeSprings('B2 B3')).toBe('B2＋B3')
    expect(normalizeSprings('w2')).toBe('W2')
    expect(normalizeSprings('なし')).toBe('なし')
    expect(normalizeSprings('')).toBe('')
  })
  it('本数（前の数字）と強度（後ろの数字、1〜4）を読み分ける', () => {
    expect(parseSprings('2R')).toEqual([{ raw: '2R', count: 2, color: 'R', strength: null }])
    expect(parseSprings('B4')).toEqual([{ raw: 'B4', count: null, color: 'B', strength: 4 }])
    expect(parseSprings('1R2')).toEqual([{ raw: '1R2', count: 1, color: 'R', strength: 2 }])
  })
  it('言葉にする', () => {
    expect(springsText('1R＋1Y')).toBe('レッド1本＋イエロー1本')
    expect(springsText('B2')).toBe('ブルー 強度2')
    expect(springsText('W3')).toBe('ホワイト 強度3')
    expect(springsText('なし')).toBe('バネなし')
    expect(springsText(null)).toBe('')
  })
})

describe('セットごとの内容', () => {
  it('おかしい値は外し、回数も秒もないセットは捨てる', () => {
    expect(cleanDetail([{ w: 20, r: 10 }, { w: -1, r: 8 }, { w: 5 }, { s: 120, side: 'X' }, 'x'])).toEqual([{ w: 20, r: 10 }, { r: 8 }, { s: 120 }])
    expect(cleanDetail('x')).toEqual([])
  })
  it('まとめ：一番重いセットの重さと回数、セット数', () => {
    expect(detailSummary([{ w: 20, r: 10 }, { w: 45, r: 6 }, { w: 45, r: 8 }])).toEqual({ weightKg: 45, reps: 8, sets: 3 })
    expect(detailSummary([])).toEqual({ weightKg: 0, reps: 0, sets: 0 })
  })
  it('総負荷量はセットごとの重さ×回数の合計（まとめの重さ×回数×セットではない）', () => {
    const detail = [{ w: 20, r: 10 }, { w: 30, r: 10 }]
    expect(detailVolume(detail)).toBe(500)
    expect(volume({ weightKg: 30, reps: 10, sets: 2, detail })).toBe(500)
    expect(volume({ weightKg: 30, reps: 10, sets: 2 })).toBe(600)
  })
  it('短い文にする（同じものは×でまとめ、右左は1つに）', () => {
    expect(detailText([{ r: 10 }, { r: 10 }, { r: 15 }])).toBe('10回×2、15回')
    expect(detailText([{ r: 10, side: 'R' }, { r: 8, side: 'L' }])).toBe('右10回・左8回')
    expect(detailText([{ w: 20, r: 10 }, { w: 30, r: 10 }])).toBe('20kg 10回、30kg 10回')
    expect(detailText([{ s: 120 }, { s: 90 }, { s: 15 }])).toBe('2分、1分30秒、15秒')
  })
})
