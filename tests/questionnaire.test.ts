import { describe, expect, it } from 'vitest'
import { CURRENT_KEYS, QUESTIONNAIRE, alertsOf, legacyAnswers } from '@/lib/questionnaire'

describe('問診票（Resole カウンセリングカルテ）', () => {
  it('紙のカルテと同じ1〜7の質問と選択肢', () => {
    const karte = QUESTIONNAIRE[0].fields
    const labels = karte.map((f) => f.label).filter((l) => /^\d\./.test(l))
    expect(labels.map((l) => l.slice(0, 2))).toEqual(['1.', '1.', '2.', '2.', '3.', '3.', '4.', '5.', '6.', '7.'])
    const goals = karte.find((f) => f.key === 'goals')
    expect(goals?.type === 'checkbox' && goals.options).toEqual(['シェイプアップ', 'ダイエット', '筋肉を増やす', '体力の向上', '柔軟性の向上', 'スポーツパフォーマンス向上', 'けが予防・改善', 'その他'])
  })
  it('「はい」の質問は短い名前で注意事項に出る（前の問診票の回答も見る）', () => {
    expect(alertsOf({ discomfort: 'あり', discomfort__detail: 'たまに腰痛' })).toEqual([{ label: '調子の悪い部位', detail: 'たまに腰痛' }])
    expect(alertsOf({ illness: 'なし', underTreatment: 'あり', underTreatment__detail: 'SLE' })).toEqual([{ label: '現在治療中の病気', detail: 'SLE' }])
  })
  it('前の問診票の回答は、いまの項目と分けて読み取り専用で出す', () => {
    const a = { goals: ['ダイエット'], stress: '多い', supplements: 'プロテイン' }
    expect(legacyAnswers(a)).toEqual([
      { label: 'ストレス', value: '多い' },
      { label: 'プロテイン・サプリメント', value: 'プロテイン' },
    ])
    expect(CURRENT_KEYS.has('goals')).toBe(true)
    expect(CURRENT_KEYS.has('discomfort__detail')).toBe(true)
    expect(CURRENT_KEYS.has('stress')).toBe(false)
  })
})
