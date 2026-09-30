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

/** 期（フェーズ）の名前の候補と、グラフの帯の色（帯には必ず名前も出す） */
/**
 * 期の色。体重（金）・体脂肪率（青）のグラフの後ろに帯で敷くので、その2色とかぶらない色にしている
 * （となり合う期どうしは色覚の多様性でも見分けられる差。帯には期の名前も書く）
 */
export const PHASE_PRESETS = [
  { name: '自律神経期', color: '#c4497a' },
  { name: 'ピラティス期', color: '#1baf7a' },
] as const
/** 候補にない名前の期に順に使う色 */
const PHASE_EXTRA_COLORS = ['#8a63d2', '#6a6456']

/** 期の名前 → 色（候補にない名前は、出てきた順に色を割り当てる） */
export function phaseColors(names: string[]): Map<string, string> {
  const out = new Map<string, string>()
  let extra = 0
  for (const n of names) {
    if (out.has(n)) continue
    const preset = PHASE_PRESETS.find((p) => p.name === n)
    out.set(n, preset ? preset.color : PHASE_EXTRA_COLORS[extra++ % PHASE_EXTRA_COLORS.length])
  }
  return out
}

/** 宿題の結果 */
export const HOMEWORK_STATUS = {
  open: { label: '未確認', tone: 'neutral' },
  done: { label: 'できた', tone: 'ok' },
  partial: { label: '一部', tone: 'warn' },
  not_done: { label: 'できなかった', tone: 'danger' },
} as const
export type HomeworkStatus = keyof typeof HOMEWORK_STATUS
export const isHomeworkStatus = (v: unknown): v is HomeworkStatus => typeof v === 'string' && v in HOMEWORK_STATUS
