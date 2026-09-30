import { describe, expect, it } from 'vitest'
import { behindPace, dietFlat, levelOf, noProgress, noVisit, plateau, talk } from '@/lib/alerts/rules'
import { DEFAULT_ALERT_SETTINGS as S, normalizeAlertSettings } from '@/lib/alerts/settings'
import { addDays } from '@/lib/dates'

const today = '2026-09-30'

describe('お知らせの段階', () => {
  it('黄・橙・赤のしきい値', () => {
    expect(levelOf(13, [14, 21, 28])).toBeNull()
    expect(levelOf(14, [14, 21, 28])).toBe('info')
    expect(levelOf(21, [14, 21, 28])).toBe('warn')
    expect(levelOf(40, [14, 21, 28])).toBe('alert')
  })
  it('設定が壊れていたら初期値、並びが逆なら受け付けない', () => {
    expect(normalizeAlertSettings({ plateau: { enabled: true, days: [30, 20, 10] } })).toEqual(S)
    expect(normalizeAlertSettings(null)).toEqual(S)
  })
})

describe('体重の停滞', () => {
  const series = (minAt: number) =>
    Array.from({ length: 40 }, (_, i) => {
      const day = -39 + i
      // minAt 日目（today からの日数）までは下がり、そのあとは横ばい（少し上）
      return { date: addDays(today, day), kg: day <= minAt ? 70 + (minAt - day) * 0.1 : 70.3 }
    })
  it('最低体重を更新していない日数で段階が上がる', () => {
    expect(plateau(series(-10), today, S.plateau)).toBeNull()
    expect(plateau(series(-15), today, S.plateau)?.level).toBe('info')
    expect(plateau(series(-22), today, S.plateau)?.level).toBe('warn')
    expect(plateau(series(-30), today, S.plateau)).toMatchObject({ level: 'alert', title: '最低体重を30日更新していません' })
  })
  it('最近の記録がない・記録が少ないときは出さない', () => {
    expect(plateau(series(-30).filter((p) => p.date < addDays(today, -11)), today, S.plateau)).toBeNull()
    expect(plateau(series(-30).slice(-3), today, S.plateau)).toBeNull()
  })
})

describe('伸びていない種目', () => {
  const ses = (id: string, day: number, rows: Array<[string, number, number]>) => ({ id, date: addDays(today, day), rows: rows.map(([exercise, weightKg, reps]) => ({ exercise, weightKg, reps })) })
  it('今やっている種目で、同じ重さ×回数が続いた回数', () => {
    const list = [
      ses('a', -21, [['スクワット', 50, 10], ['クランチ', 0, 20]]),
      ses('b', -14, [['スクワット', 55, 10], ['クランチ', 0, 20], ['ベンチ', 40, 8]]),
      ses('c', -7, [['スクワット', 55, 10], ['クランチ', 0, 20], ['ベンチ', 40, 8]]),
      ses('d', 0, [['スクワット', 55, 10], ['クランチ', 0, 20], ['ベンチ', 42.5, 8]]),
    ]
    const a = noProgress(list, today, S.noProgress)
    expect(a).toMatchObject({ level: 'info', title: 'スクワットが3回続けて同じ重さ×回数です', fingerprint: 'd:info' })
    // 自重（クランチ）は数えない設定。数える設定なら4回で橙
    expect(noProgress(list, today, { ...S.noProgress, skipBodyweight: false })?.level).toBe('warn')
  })
  it('もうやっていない種目は数えない', () => {
    const list = [ses('a', -21, [['レッグプレス', 80, 10]]), ses('b', -14, [['レッグプレス', 80, 10]]), ses('c', -7, [['レッグプレス', 80, 10]]), ses('d', -3, [['スクワット', 50, 10]]), ses('e', 0, [['スクワット', 52.5, 10]])]
    expect(noProgress(list, today, S.noProgress)).toBeNull()
  })
})

describe('食事の変化なし', () => {
  const w = (weekStart: string, avgKcal: number, p: number, f: number, c: number) => ({ weekStart, targetKcal: 1600, avgKcal, proteinG: p, fatG: f, carbsG: c })
  const flat = [w('2026-09-21', 1720, 82, 58, 205), w('2026-09-14', 1710, 83, 58, 206)]
  it('体重も停滞していて、数字がほぼ同じなら橙', () => {
    expect(dietFlat(flat, true, S.dietFlat)).toMatchObject({ level: 'warn', fingerprint: '2026-09-21' })
    expect(dietFlat(flat, false, S.dietFlat)).toBeNull()
    expect(dietFlat([w('2026-09-21', 1720, 82, 58, 205), w('2026-09-14', 1900, 83, 58, 206)], true, S.dietFlat)).toBeNull()
    expect(dietFlat(flat.slice(0, 1), true, S.dietFlat)).toBeNull()
  })
})

describe('来店・ペース・会話メモ', () => {
  it('来店があいている日数', () => {
    expect(noVisit(addDays(today, -13), today, S.noVisit)).toBeNull()
    expect(noVisit(addDays(today, -15), today, S.noVisit)?.level).toBe('info')
    expect(noVisit(addDays(today, -30), today, S.noVisit)?.level).toBe('alert')
  })
  it('予定ペースより遅れ', () => {
    expect(behindPace(0.5, S.behindPace)).toBeNull()
    expect(behindPace(-1.2, S.behindPace)?.level).toBe('info')
    expect(behindPace(-2.4, S.behindPace)).toMatchObject({ level: 'warn', title: '予定ペースより2.4kg遅れています' })
  })
  it('ネガティブ・身体の変化の会話メモ（直近7日）', () => {
    const notes = [
      { id: '1', date: addDays(today, -2), kind: 'negative', text: '体重が落ちなくて焦っている' },
      { id: '2', date: addDays(today, -1), kind: 'good', text: '階段が楽になった' },
      { id: '3', date: addDays(today, -10), kind: 'body', text: '右ひざに違和感' },
    ]
    expect(talk(notes, today, S.talk)).toMatchObject({ level: 'info', fingerprint: '1', title: '気になる会話メモ（ネガティブ）' })
    expect(talk(notes.slice(1), today, S.talk)).toBeNull()
  })
})
