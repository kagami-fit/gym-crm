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
