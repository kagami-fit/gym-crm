import { z } from 'zod'

// 計算設定。初期値は参考シート（[デモ用]管理システム）の計算と同じ。
// 設定画面で変えると、全顧客・全画面の計算がこの値で統一して変わる。

export const BMR_METHODS = {
  lbm: { label: '除脂肪体重 × 係数', note: '参考シートの式（初期値 28.5）' },
  katch: { label: 'Katch-McArdle式', note: '370 + 21.6 × 除脂肪体重' },
  ganpule: { label: '国立健康・栄養研究所の式', note: '体重・身長・年齢・性別から推定' },
  harris: { label: 'ハリス・ベネディクト式（改訂版）', note: '体重・身長・年齢・性別から推定' },
} as const
export type BmrMethod = keyof typeof BMR_METHODS

export const ONE_RM_METHODS = {
  oconner: { label: "O'Conner式", note: '重さ × (1 + 回数 ÷ 40)' },
  epley: { label: 'Epley式', note: '重さ × (1 + 回数 ÷ 30)' },
  brzycki: { label: 'Brzycki式', note: '重さ × 36 ÷ (37 − 回数)' },
} as const
export type OneRmMethod = keyof typeof ONE_RM_METHODS

export const PROTEIN_BASES = {
  lbm: '除脂肪体重',
  weight: '体重',
} as const

/** 1ヶ月の日数（1日の削減カロリー＝体重×ペース%×体脂肪1kgのkcal÷30） */
export const DAYS_PER_MONTH = 30

export const paceSchema = z.object({
  key: z.string().min(1).max(40),
  name: z.string().trim().min(1, '名前を入れてください').max(20),
  percentPerMonth: z.number().min(0.1, '0.1%以上にしてください').max(10, '10%以下にしてください'),
  note: z.string().trim().max(60).default(''),
})
export type Pace = z.infer<typeof paceSchema>

export const activitySchema = z.object({
  value: z.number().min(1, '1.0以上にしてください').max(2.5, '2.5以下にしてください'),
  label: z.string().trim().max(80).default(''),
})
export type ActivityOption = z.infer<typeof activitySchema>

export const DEFAULT_PACES: Pace[] = [
  { key: 'gentle', name: 'ゆるめ', percentPerMonth: 1, note: 'リスク小' },
  { key: 'normal', name: '普通', percentPerMonth: 2, note: 'リスク中' },
  { key: 'hard', name: 'きつめ', percentPerMonth: 3, note: 'リスク高' },
]

export const DEFAULT_ACTIVITY: ActivityOption[] = [
  { value: 1.2, label: 'ほとんど体を動かさない' },
  { value: 1.5, label: '通勤や家事で少し体を動かす程度' },
  { value: 1.7, label: '立ち仕事・外回り・家事でかなり体を動かす、スポーツをしている' },
]

export const DEFAULT_BODY_PARTS = ['脚', '背中', '胸', '肩', '腕', '体幹']

export const calcSettingsSchema = z.object({
  bmrMethod: z.enum(['lbm', 'katch', 'ganpule', 'harris']).default('lbm'),
  bmrLbmFactor: z.number().min(10).max(60).default(28.5),
  proteinBasis: z.enum(['lbm', 'weight']).default('lbm'),
  proteinPerKg: z.number().min(0.5).max(4).default(2),
  fatRatioPct: z.number().min(10).max(50).default(25),
  kcalPerKgFat: z.number().min(5000).max(9000).default(7200),
  waterMlPerKg: z.number().min(20).max(60).default(35),
  meatProteinPer100g: z.number().min(5).max(40).default(20),
  riceCarbsPer100g: z.number().min(10).max(60).default(36),
  paces: z.array(paceSchema).min(1).default(DEFAULT_PACES),
  activityFactors: z.array(activitySchema).min(1).default(DEFAULT_ACTIVITY),
  oneRmMethod: z.enum(['oconner', 'epley', 'brzycki']).default('oconner'),
  bodyParts: z.array(z.string().trim().min(1).max(20)).min(1).default(DEFAULT_BODY_PARTS),
  recentSessionCount: z.number().int().min(4).max(40).default(14),
})
export type CalcSettings = z.infer<typeof calcSettingsSchema>

export const DEFAULT_SETTINGS: CalcSettings = calcSettingsSchema.parse({})

/** 保存値を読み込む。壊れた値や欠けた項目は初期値で補う */
export function normalizeSettings(raw: unknown): CalcSettings {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const merged: Record<string, unknown> = {}
  for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof CalcSettings>) {
    const field = calcSettingsSchema.shape[key]
    const r = field.safeParse(obj[key])
    merged[key] = r.success ? r.data : DEFAULT_SETTINGS[key]
  }
  return merged as CalcSettings
}

export function findPace(settings: CalcSettings, key: string | null | undefined): Pace | null {
  return settings.paces.find((p) => p.key === key) ?? null
}

export function activityLabel(settings: CalcSettings, value: number | null | undefined): string {
  if (value == null) return ''
  return settings.activityFactors.find((a) => Math.abs(a.value - value) < 1e-9)?.label ?? ''
}
