// 動作の評価（ピラティスの達成状況）の定義。ここを書き換えれば画面と保存内容が変わる（確認項目は JSON で保存）。
// 2026-10-04 の会議の整理から。種目の正式名・実施条件・移行の必須条件は確認中なので、
// 分からない名前や条件は補わず、そのまま「確認中」として見せる。

export type MovementField =
  /** 決まった答えから選ぶ（ok はよい側の答え。画面の色分けに使う） */
  | { key: string; label: string; type: 'choice'; options: readonly string[]; ok?: string }
  | { key: string; label: string; type: 'text'; placeholder?: string }

export type Movement = {
  key: string
  label: string
  /** 確認に使う種目 */
  exercises: string
  /** 会議で出た目安（参考。届かなくても「遅れ」とはしない） */
  guide?: string
  /** 左右それぞれに達成状況をつける（側屈） */
  sides?: boolean
  fields: readonly MovementField[]
}

export const MOVEMENTS: readonly Movement[] = [
  { key: 'imprint', label: 'インプリント・分節', exercises: 'ロングスパイン（タワーでも）', guide: '長くて4週間程度（初回〜1週間で変わる人も）', fields: [] },
  {
    key: 'flexion',
    label: '屈曲',
    exercises: 'パイクアップ、エレファント',
    guide: '1〜2ヶ月程度を目指す（体格で難しさが変わる）',
    fields: [{ key: 'heel', label: 'かかとの接地（エレファント）', type: 'choice', options: ['つく', 'つかない'], ok: 'つく' }],
  },
  {
    key: 'extension',
    label: '伸展（重力に逆らわない）',
    exercises: 'スタンディングロールバック、ロールバック',
    fields: [
      { key: 'backPain', label: '腰の痛み', type: 'choice', options: ['なし', 'あり'], ok: 'なし' },
      { key: 'returning', label: '戻る動き', type: 'choice', options: ['できる', 'むずかしい'], ok: 'できる' },
    ],
  },
  {
    key: 'antiGravity',
    label: '伸展（重力に逆らう）',
    exercises: 'スワンなど',
    fields: [
      { key: 'pain', label: '痛み', type: 'choice', options: ['なし', 'あり'], ok: 'なし' },
      { key: 'motion', label: '動作の様子', type: 'text', placeholder: '例：2段階目まで。楽に上がる' },
    ],
  },
  { key: 'lateral', label: '側屈', exercises: 'レッグアップ（と聞き取れる種目・正式名は確認中）', sides: true, fields: [] },
  {
    key: 'rotation',
    label: '回旋',
    exercises: 'チェストエクスパンション',
    fields: [
      { key: 'sideDiff', label: '左右差', type: 'choice', options: ['大きい', '小さい', 'なし'], ok: 'なし' },
      { key: 'ease', label: '動きやすさの変化', type: 'text', placeholder: '例：右を向きやすくなった' },
    ],
  },
]

export const movementOf = (key: string): Movement | undefined => MOVEMENTS.find((m) => m.key === key)

/** 達成状況 */
export const MOVEMENT_STATUS = {
  untested: { label: '未評価', tone: 'muted' },
  practicing: { label: '練習中', tone: 'brand' },
  achieved: { label: '達成', tone: 'ok' },
} as const
export type MovementStatus = keyof typeof MOVEMENT_STATUS
export const isMovementStatus = (v: unknown): v is MovementStatus => typeof v === 'string' && v in MOVEMENT_STATUS

/** 左右がある動きの全体の状況（両方達成で達成、どちらかを練習・達成していれば練習中） */
export function sidesStatus(left: MovementStatus, right: MovementStatus): MovementStatus {
  if (left === 'achieved' && right === 'achieved') return 'achieved'
  if (left === 'untested' && right === 'untested') return 'untested'
  return 'practicing'
}

export type MovementChecks = Record<string, string>

/** 保存された確認項目を、定義にある項目・答えだけに整える（左右は left / right） */
export function cleanChecks(m: Movement, raw: unknown): MovementChecks {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const out: MovementChecks = {}
  if (m.sides) {
    for (const side of ['left', 'right']) if (isMovementStatus(obj[side])) out[side] = obj[side] as string
  }
  for (const f of m.fields) {
    const v = obj[f.key]
    if (typeof v !== 'string' || !v.trim()) continue
    if (f.type === 'choice' && !f.options.includes(v)) continue
    out[f.key] = f.type === 'text' ? v.trim().slice(0, 100) : v
  }
  return out
}
