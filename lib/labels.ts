export const STATUSES = {
  active: '在籍中',
  trial: '体験',
  paused: '休会中',
  left: '退会',
} as const
export type ClientStatus = keyof typeof STATUSES
export const isStatus = (v: unknown): v is ClientStatus => typeof v === 'string' && v in STATUSES

export const GENDERS = {
  male: '男性',
  female: '女性',
  other: 'その他・回答しない',
} as const
export type GenderKey = keyof typeof GENDERS
export const isGender = (v: unknown): v is GenderKey => typeof v === 'string' && v in GENDERS

export const PURPOSES = ['ダイエット', 'ボディメイク', '筋力アップ', '健康維持', '姿勢改善', '痛みの改善', 'パフォーマンス向上']

export const REFERRALS = ['紹介', 'Instagram', 'Web検索', 'Googleマップ', 'チラシ・看板', 'その他']

export const MEAL_SLOTS = [
  { key: 'breakfast', label: '朝食' },
  { key: 'lunch', label: '昼食' },
  { key: 'dinner', label: '夕食' },
  { key: 'snack', label: '間食' },
  { key: 'note', label: 'メモ' },
] as const
export type MealSlot = (typeof MEAL_SLOTS)[number]['key']
export const isMealSlot = (v: unknown): v is MealSlot => MEAL_SLOTS.some((s) => s.key === v)

/** 会話メモの種類（並び順＝画面の並び順。tone は Badge の色） */
export const TALK_KINDS = [
  { key: 'talk', label: '会話', hint: 'そのほかの会話（予定・趣味・家族など）', example: '例：来月、家族で沖縄旅行。それまでにお腹まわりを絞りたい' },
  { key: 'change', label: '変化', hint: '通って変化を感じたこと', example: '例：階段で息が切れにくくなったと話していた' },
  { key: 'good', label: '良かったこと', hint: '良かったこと・うれしかったこと', example: '例：健康診断の数値が良くなって喜んでいた' },
  { key: 'negative', label: 'ネガティブ', hint: 'ネガティブな言動・不満・不安', example: '例：仕事が忙しく、続けられるか不安と話していた' },
  { key: 'body', label: '身体の変化', hint: '身体の変化・痛み・体調', example: '例：右ひざに違和感。スクワットは浅めで様子を見る' },
] as const
export type TalkKind = (typeof TALK_KINDS)[number]['key']
export const isTalkKind = (v: unknown): v is TalkKind => TALK_KINDS.some((k) => k.key === v)
export const talkKindOf = (key: string) => TALK_KINDS.find((k) => k.key === key) ?? TALK_KINDS[0]

/**
 * フェーズの名前の候補（説明名は表示案）と、グラフの帯の色（帯には必ず名前も出す）。
 * 2026-10-04 の整理：フェーズ1（体を整える：自律神経への対応とピラティスを並行）→ フェーズ2（目的に合わせて進める：筋トレと食事方針）。
 * 体重（金）・体脂肪率（青）のグラフの後ろに帯で敷くので、その2色とかぶらない色にしている
 * （となり合うフェーズどうしは色覚の多様性でも見分けられる差。帯にはフェーズの名前も書く）
 */
export const PHASE_PRESETS = [
  { name: 'フェーズ1', sub: '体を整える', color: '#1baf7a' },
  { name: 'フェーズ2', sub: '目的に合わせて進める', color: '#8a63d2' },
] as const
/** 候補にない名前のフェーズ（「その他」扱い）の色 */
export const PHASE_OTHER_COLOR = '#6a6456'
/** フェーズ2の名前（移行チェックから進めるときに使う） */
export const PHASE_2 = PHASE_PRESETS[1].name

/** フェーズの名前 → 色（候補にない名前はすべて「その他」の灰色。帯とリストには名前も出すので区別できる） */
export function phaseColors(names: string[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const n of names) {
    if (out.has(n)) continue
    out.set(n, PHASE_PRESETS.find((p) => p.name === n)?.color ?? PHASE_OTHER_COLOR)
  }
  return out
}

/** フェーズの説明名（候補にない名前は空） */
export const phaseSub = (name: string): string => PHASE_PRESETS.find((p) => p.name === name)?.sub ?? ''
/** 「フェーズ1（体を整える）」の形 */
export const phaseTitle = (name: string): string => (phaseSub(name) ? `${name}（${phaseSub(name)}）` : name)

/** 来店頻度の候補 */
export const VISIT_FREQUENCIES = ['週1回', '週2回', '週3回以上', '隔週', '月1回', '不定期'] as const

/**
 * 食事方針。phase はどのフェーズの方針か（選ぶときの並び。ほかのフェーズでも選べる）。
 * 名前（「コーフラックス」など）はここだけで管理しているので、正式名が決まったらここを直す（保存は key なので記録はそのまま）。
 */
export const DIET_POLICIES = {
  recovery: { label: '回復食', phase: 1, hint: '消化しやすい食事・生活習慣の見直しから' },
  balance: { label: 'バランス食', phase: 1, hint: '状態に合わせて、バランスのよい食事へ' },
  other: { label: 'そのほか', phase: 1, hint: '名前を入れて記録します' },
  reverse: { label: 'コーフラックス', phase: 2, hint: '体重を増やさずに、摂取カロリーを上げていく期間。終了予定日を決めます' },
  loss: { label: '減量', phase: 2, hint: '目標体重に向けて減らしていく期間' },
  maintain: { label: '維持', phase: 2, hint: '今の体重・状態を保つ期間' },
} as const
export type DietPolicy = keyof typeof DIET_POLICIES
export const isDietPolicy = (v: unknown): v is DietPolicy => typeof v === 'string' && v in DIET_POLICIES
/** 方針の名前（「そのほか」は入れた名前） */
export const policyLabel = (policy: string, name?: string | null): string =>
  policy === 'other' && name?.trim() ? name.trim() : isDietPolicy(policy) ? DIET_POLICIES[policy].label : policy

/** 自律神経の測定：活性度の棒とグレーゾーンとの位置（空＝未確認） */
export const ANS_LEVELS = {
  low: { label: '低い', tone: 'warn' },
  normal: { label: '基準内', tone: 'ok' },
  high: { label: '高い', tone: 'warn' },
} as const
export type AnsLevel = keyof typeof ANS_LEVELS
export const isAnsLevel = (v: unknown): v is AnsLevel => typeof v === 'string' && v in ANS_LEVELS

/** フェーズ1の型（A〜D）。文字との対応・条件は確認中のため、どれも「仮」として見せる。自動では分類しない */
export const ANS_TYPES = {
  A: '交感神経が高い型（仮）',
  B: '副交感神経が低い型（仮）',
  C: '両方が低い型',
  D: '交感神経が低く、副交感神経は基準内に見える型（仮）',
} as const
export type AnsType = keyof typeof ANS_TYPES
export const isAnsType = (v: unknown): v is AnsType => typeof v === 'string' && v in ANS_TYPES

/** 体重の変化への担当者の評価 */
export const WEIGHT_VERDICTS = {
  expected: { label: '想定内', tone: 'ok' },
  review: { label: '見直しが必要', tone: 'warn' },
  hold: { label: '評価保留', tone: 'neutral' },
} as const
export type WeightVerdict = keyof typeof WEIGHT_VERDICTS
export const isWeightVerdict = (v: unknown): v is WeightVerdict => typeof v === 'string' && v in WEIGHT_VERDICTS

/** 宿題の結果 */
export const HOMEWORK_STATUS = {
  open: { label: '未確認', tone: 'neutral' },
  done: { label: 'できた', tone: 'ok' },
  partial: { label: '一部できた', tone: 'warn' },
  not_done: { label: 'できなかった', tone: 'danger' },
} as const
export type HomeworkStatus = keyof typeof HOMEWORK_STATUS
export const isHomeworkStatus = (v: unknown): v is HomeworkStatus => typeof v === 'string' && v in HOMEWORK_STATUS
