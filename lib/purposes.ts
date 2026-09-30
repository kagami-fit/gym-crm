// 種目の目的の選択肢（設定 → 種目マスタ で変更。AppSetting の "purposes" に保存）
// 記録と種目マスタには目的の名前（文字）で持つ。選択肢の名前を変えると、記録と種目マスタの目的も新しい名前にそろえる。
// 選択肢から消しても、これまでの記録の目的は残る（種目マスタの「いつもの目的」だけ外す）。

/** 初期の選択肢（仮。京角さんの分け方がわかったら差し替える） */
export const DEFAULT_PURPOSES = ['自律神経を整える', '可動域を広げる', '姿勢を整える', '体幹を安定させる', '筋力アップ', 'ボディメイク', '脂肪燃焼', '痛みの予防・改善', 'ウォームアップ', 'クールダウン']

export const MAX_PURPOSES = 30
export const MAX_PURPOSE_LENGTH = 20

/** 保存値を読み込む（壊れていたら初期値。空白・重複・長すぎるものは除く） */
export function normalizePurposes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return DEFAULT_PURPOSES
  const list = raw.filter((v): v is string => typeof v === 'string').map((v) => v.trim())
  const out = [...new Set(list.filter((v) => v && v.length <= MAX_PURPOSE_LENGTH))].slice(0, MAX_PURPOSES)
  return out.length ? out : DEFAULT_PURPOSES
}

/** 画面から送られる選択肢（from：もとの名前。新しく足したものは null） */
export type PurposeEdit = { label: string; from: string | null }
export type PurposePlan = { ok: true; options: string[]; renames: Array<[string, string]>; removed: string[] } | { ok: false; message: string }

/** 選択肢の変更内容を検査して、名前を変えたもの・消したものを出す */
export function planPurposeChanges(prev: string[], next: PurposeEdit[]): PurposePlan {
  const options = next.map((o) => o.label.trim())
  if (!options.length) return { ok: false, message: '選択肢を1つ以上入れてください' }
  if (options.length > MAX_PURPOSES) return { ok: false, message: `選択肢は${MAX_PURPOSES}個までにしてください` }
  if (options.some((o) => !o)) return { ok: false, message: '空の選択肢があります。名前を入れるか削除してください' }
  const long = options.find((o) => o.length > MAX_PURPOSE_LENGTH)
  if (long) return { ok: false, message: `「${long}」が長すぎます（${MAX_PURPOSE_LENGTH}文字まで）` }
  const dup = options.find((o, i) => options.indexOf(o) !== i)
  if (dup) return { ok: false, message: `「${dup}」が2つあります` }
  const renames = next.filter((o) => o.from && prev.includes(o.from) && o.from !== o.label.trim()).map((o): [string, string] => [o.from!, o.label.trim()])
  const kept = new Set(next.map((o) => o.from).filter((f): f is string => !!f))
  const removed = prev.filter((p) => !kept.has(p) && !options.includes(p))
  return { ok: true, options, renames, removed }
}

/** 選択肢に、いま入っている値（選択肢から消した・名前を変える前の目的）も足して、セレクトに出す */
export function purposeOptionsWith(options: string[], current: string | null | undefined): string[] {
  return current && !options.includes(current) ? [...options, current] : options
}
