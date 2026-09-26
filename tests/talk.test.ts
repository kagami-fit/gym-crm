import { describe, expect, it } from 'vitest'
import { TALK_KINDS, isTalkKind, talkKindOf } from '@/lib/labels'

describe('会話メモの種類', () => {
  it('会話・変化・良かったこと・ネガティブ・身体の変化の5種類', () => {
    expect(TALK_KINDS.map((k) => k.label)).toEqual(['会話', '変化', '良かったこと', 'ネガティブ', '身体の変化'])
  })
  it('知らない種類は受け付けず、表示は「会話」として扱う', () => {
    expect(isTalkKind('good')).toBe(true)
    expect(isTalkKind('unknown')).toBe(false)
    expect(talkKindOf('unknown').key).toBe('talk')
  })
})
