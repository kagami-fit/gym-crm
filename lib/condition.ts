// 体調チェック（本人の訴え）の項目。ここを書き換えれば画面と保存内容が変わる（答えは JSON で保存）。
// 項目と3段階は仮（京角さんの「毎回聞いている数値」の答えが来たら合わせる）。
// 鉄欠乏・低血糖などの原因や診断名を、ここから自動で決めることはしない。

export const CONDITION_ITEMS = [
  { key: 'fatigue', label: '疲労', hint: '疲れやすい・だるい' },
  { key: 'pain', label: '痛み', hint: '部位は下の欄に' },
  { key: 'malaise', label: '不調', hint: '頭痛・胃腸・冷えなど' },
  { key: 'postMeal', label: '食後の眠気', hint: '' },
  { key: 'sleep', label: '睡眠の悩み', hint: '寝つき・夜中に起きる・眠りが浅い' },
] as const
export type ConditionItem = (typeof CONDITION_ITEMS)[number]['key']

/** どれも「困っている度合い」。なし＝よい */
export const CONDITION_LEVELS = {
  none: { label: 'なし', rank: 0 },
  mild: { label: '少し', rank: 1 },
  strong: { label: '強い', rank: 2 },
} as const
export type ConditionLevel = keyof typeof CONDITION_LEVELS
export const isConditionLevel = (v: unknown): v is ConditionLevel => typeof v === 'string' && v in CONDITION_LEVELS

export type ConditionItems = Partial<Record<ConditionItem, ConditionLevel>>

/** 保存値を、定義にある項目・段階だけに整える */
export function cleanConditionItems(raw: unknown): ConditionItems {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const out: ConditionItems = {}
  for (const it of CONDITION_ITEMS) if (isConditionLevel(obj[it.key])) out[it.key] = obj[it.key] as ConditionLevel
  return out
}

/** 初回と最新の比べ方（よくなった／変わらない／悪くなった。どちらかが答えていなければ null） */
export function conditionTrend(first: ConditionLevel | undefined, latest: ConditionLevel | undefined): 'better' | 'same' | 'worse' | null {
  if (!first || !latest) return null
  const d = CONDITION_LEVELS[latest].rank - CONDITION_LEVELS[first].rank
  return d < 0 ? 'better' : d > 0 ? 'worse' : 'same'
}
