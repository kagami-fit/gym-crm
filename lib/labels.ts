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
