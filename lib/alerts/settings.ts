import { z } from 'zod'

// お知らせの条件と段階（設定 → お知らせ で変更。AppSetting の "alerts" に保存）
// 段階はどれも [黄＝気づき, 橙＝要対応, 赤＝相談] の順の3つの値

const triple = (d: [number, number, number], min: number, max: number) =>
  z
    .tuple([z.number().min(min).max(max), z.number().min(min).max(max), z.number().min(min).max(max)])
    .refine(([a, b, c]) => a <= b && b <= c, '黄・橙・赤の順に大きくしてください')
    .default(d)

export const alertSettingsSchema = z.object({
  /** 体重の停滞：最低体重を更新していない日数 */
  plateau: z.object({ enabled: z.boolean().default(true), days: triple([14, 21, 28], 3, 180) }).default({ enabled: true, days: [14, 21, 28] }),
  /** 伸びていない種目：同じ重さ×回数が続いた回数 */
  noProgress: z
    .object({ enabled: z.boolean().default(true), counts: triple([3, 4, 5], 2, 20), skipBodyweight: z.boolean().default(true) })
    .default({ enabled: true, counts: [3, 4, 5], skipBodyweight: true }),
  /** 食事の変化なし：何週間・どのくらいの差までを「ほぼ同じ」とするか（体重も停滞しているときだけ出す） */
  dietFlat: z.object({ enabled: z.boolean().default(true), weeks: z.number().int().min(2).max(8).default(2), pct: z.number().min(1).max(20).default(5) }).default({ enabled: true, weeks: 2, pct: 5 }),
  /** 来店があいている：最後の来店からの日数（在籍中のお客様だけ） */
  noVisit: z.object({ enabled: z.boolean().default(true), days: triple([14, 21, 30], 3, 180) }).default({ enabled: true, days: [14, 21, 30] }),
  /** 予定ペースより遅れ（kg） */
  behindPace: z.object({ enabled: z.boolean().default(true), kg: triple([1, 2, 3], 0.1, 20) }).default({ enabled: true, kg: [1, 2, 3] }),
  /** 気になる会話メモ：ネガティブ・身体の変化の会話メモを何日間知らせるか */
  talk: z.object({ enabled: z.boolean().default(true), days: z.number().int().min(1).max(60).default(7) }).default({ enabled: true, days: 7 }),
})
export type AlertSettings = z.infer<typeof alertSettingsSchema>

export const DEFAULT_ALERT_SETTINGS: AlertSettings = alertSettingsSchema.parse({})

/** 保存値を検査して、足りない所は初期値で埋める（壊れていたら初期値） */
export function normalizeAlertSettings(raw: unknown): AlertSettings {
  const r = alertSettingsSchema.safeParse(raw ?? {})
  return r.success ? r.data : DEFAULT_ALERT_SETTINGS
}
