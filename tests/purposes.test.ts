import { describe, expect, it } from 'vitest'
import { DEFAULT_PURPOSES, normalizePurposes, planPurposeChanges, purposeOptionsWith } from '@/lib/purposes'

describe('種目の目的の選択肢', () => {
  it('保存値がない・壊れているときは初期の選択肢', () => {
    expect(normalizePurposes(undefined)).toEqual(DEFAULT_PURPOSES)
    expect(normalizePurposes('x')).toEqual(DEFAULT_PURPOSES)
    expect(normalizePurposes([])).toEqual(DEFAULT_PURPOSES)
  })
  it('空白を除き、重複・空・長すぎるものは除く', () => {
    expect(normalizePurposes([' 筋力アップ ', '筋力アップ', '', 'あ'.repeat(21), '姿勢を整える', 3])).toEqual(['筋力アップ', '姿勢を整える'])
  })

  it('名前を変えたもの・消したものを出す（新しく足したものはどちらでもない）', () => {
    const plan = planPurposeChanges(['筋力アップ', '姿勢を整える', '脂肪燃焼'], [
      { label: '筋力を上げる', from: '筋力アップ' },
      { label: '姿勢を整える', from: '姿勢を整える' },
      { label: '呼吸を整える', from: null },
    ])
    expect(plan).toEqual({ ok: true, options: ['筋力を上げる', '姿勢を整える', '呼吸を整える'], renames: [['筋力アップ', '筋力を上げる']], removed: ['脂肪燃焼'] })
  })
  it('名前の入れ替え（AとBの交換）も名前の変更として扱う', () => {
    const plan = planPurposeChanges(['A', 'B'], [
      { label: 'B', from: 'A' },
      { label: 'A', from: 'B' },
    ])
    expect(plan.ok && plan.renames).toEqual([
      ['A', 'B'],
      ['B', 'A'],
    ])
    expect(plan.ok && plan.removed).toEqual([])
  })
  it('空・重複・長すぎる・0個は保存しない', () => {
    expect(planPurposeChanges(['A'], [{ label: ' ', from: 'A' }]).ok).toBe(false)
    expect(planPurposeChanges(['A'], [{ label: 'B', from: 'A' }, { label: 'B', from: null }]).ok).toBe(false)
    expect(planPurposeChanges(['A'], [{ label: 'あ'.repeat(21), from: null }]).ok).toBe(false)
    expect(planPurposeChanges(['A'], []).ok).toBe(false)
  })

  it('選択肢から消した目的が入っている記録は、その目的もセレクトに出す', () => {
    expect(purposeOptionsWith(['A', 'B'], 'C')).toEqual(['A', 'B', 'C'])
    expect(purposeOptionsWith(['A', 'B'], 'A')).toEqual(['A', 'B'])
    expect(purposeOptionsWith(['A', 'B'], null)).toEqual(['A', 'B'])
  })
})
