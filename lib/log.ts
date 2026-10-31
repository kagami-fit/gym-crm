// トレーニングのログ（来店ごとの記録）の細かい内容：器具・バネ・セットごとの内容・できばえ。
// 手書きの Training Log Seat に合わせて 2026-10 に追加。DB を使わないので、画面の部品やテストからも使える。

/** 器具（選ぶ順） */
export const EQUIPMENT = ['リフォーマー', 'タワー', 'チェア', 'マット', 'スミスマシン', 'フリーウェイト', 'マシン', 'その他'] as const

/**
 * バネ（ピラティスマシンのスプリング）の色。略記は「本数＋色」（1R＝レッド1本、2R＝レッド2本）と、
 * 「色＋強度」（B2＝ブルーの強度2。強度は1〜4）。複数は「＋」でつなぐ（1R＋1Y）。「なし」はバネなし
 */
export const SPRING_COLORS = { R: 'レッド', Y: 'イエロー', B: 'ブルー', W: 'ホワイト' } as const
export type SpringColor = keyof typeof SPRING_COLORS
const COLOR_HEX: Record<SpringColor, string> = { R: '#d64545', Y: '#e5b800', B: '#2a78d6', W: '#b9b4a7' }
export const springColorHex = (c: SpringColor) => COLOR_HEX[c]

/** よく使う略記（押すと足される） */
export const SPRING_QUICK = ['1R', '2R', '1Y', '2Y', '1B', '1W', 'B1', 'B2', 'B3', 'B4', 'W1', 'W2', 'W3', 'W4'] as const

export type SpringToken = { raw: string; count: number | null; color: SpringColor; strength: number | null }

/** 全角・区切りのゆれをそろえる（「1r 1y」「1R1Y」「1R・1Y」→「1R＋1Y」） */
export function normalizeSprings(code: string): string {
  const s = code
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .toUpperCase()
    .trim()
  if (!s) return ''
  if (/^(なし|0)$/.test(s)) return 'なし'
  // 強度の数字は、すぐあとに色が続かないときだけ（「1R1Y」は 1R＋1Y）
  const tokens = s.match(/\d*[RYBW](?:\d(?![RYBW]))?/g)
  return tokens && tokens.join('').length === s.replace(/[\s+＋・,、/]/g, '').length ? tokens.join('＋') : s
}

/** 略記を読み取る（読めない部分は無視） */
export function parseSprings(code: string): SpringToken[] {
  const s = normalizeSprings(code)
  if (!s || s === 'なし') return []
  return [...s.matchAll(/(\d*)([RYBW])(\d(?![RYBW]))?/g)].map((m) => ({
    raw: m[0],
    count: m[1] ? Number(m[1]) : null,
    color: m[2] as SpringColor,
    strength: m[3] ? Number(m[3]) : null,
  }))
}

/** 言葉にする（「レッド1本＋イエロー1本」「ブルー 強度2」） */
export function springsText(code: string | null | undefined): string {
  if (!code) return ''
  const s = normalizeSprings(code)
  if (s === 'なし') return 'バネなし'
  const t = parseSprings(s)
  if (!t.length) return s
  return t.map((x) => `${SPRING_COLORS[x.color]}${x.count != null ? `${x.count}本` : ''}${x.strength != null ? ` 強度${x.strength}` : ''}`).join('＋')
}

/** セット1つ分。w：重さkg、r：回数、s：秒、side：右・左（なしは両方） */
export type SetDetail = { w?: number; r?: number; s?: number; side?: 'R' | 'L' }

const num = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v * 100) / 100 : undefined)

/** 保存値を整える（数がおかしいものは外し、回数も秒もないセットは捨てる。最大30セット） */
export function cleanDetail(raw: unknown): SetDetail[] {
  if (!Array.isArray(raw)) return []
  const out: SetDetail[] = []
  for (const x of raw.slice(0, 30)) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const d: SetDetail = {}
    const w = num(o.w, 500)
    const r = num(o.r, 500)
    const s = num(o.s, 3600)
    if (w) d.w = w
    if (r) d.r = Math.round(r)
    if (s) d.s = Math.round(s)
    if (o.side === 'R' || o.side === 'L') d.side = o.side
    if (d.r || d.s) out.push(d)
  }
  return out
}

/** セットごとの内容から「まとめ」を出す（一番重いセットの重さと回数、セット数）。計算・前回比べ・グラフに使う */
export function detailSummary(d: SetDetail[]): { weightKg: number; reps: number; sets: number } {
  if (!d.length) return { weightKg: 0, reps: 0, sets: 0 }
  const top = d.reduce((a, b) => ((b.w ?? 0) > (a.w ?? 0) || ((b.w ?? 0) === (a.w ?? 0) && (b.r ?? 0) > (a.r ?? 0)) ? b : a), d[0])
  return { weightKg: top.w ?? 0, reps: top.r ?? 0, sets: d.length }
}

/** 総負荷量（重さ×回数の合計。重さのないセットは0） */
export const detailVolume = (d: SetDetail[]) => d.reduce((a, x) => a + (x.w ?? 0) * (x.r ?? 0), 0)

const secText = (s: number) => (s >= 60 && s % 60 === 0 ? `${s / 60}分` : s >= 60 ? `${Math.floor(s / 60)}分${s % 60}秒` : `${s}秒`)
const amount = (x: SetDetail) => (x.r ? `${x.r}回` : x.s ? secText(x.s) : '')
const kg = (w?: number) => (w ? `${w}kg ` : '')

/** セットごとの内容を短い文にする（「10回×2、15回×1」「右10回・左8回」「20kg 10回、30kg 10回」「2分」） */
export function detailText(d: SetDetail[]): string {
  const labels: string[] = []
  for (let i = 0; i < d.length; i++) {
    const x = d[i]
    const y = d[i + 1]
    // 右のすぐあとに同じ重さの左 → 1つにまとめる
    if (x.side === 'R' && y?.side === 'L' && (x.w ?? 0) === (y.w ?? 0)) {
      labels.push(`${kg(x.w)}右${amount(x)}・左${amount(y)}`)
      i++
      continue
    }
    labels.push(`${kg(x.w)}${x.side === 'R' ? '右' : x.side === 'L' ? '左' : ''}${amount(x)}`)
  }
  const out: string[] = []
  for (let i = 0; i < labels.length; ) {
    let j = i
    while (j < labels.length && labels[j] === labels[i]) j++
    out.push(j - i > 1 ? `${labels[i]}×${j - i}` : labels[i])
    i = j
  }
  return out.join('、')
}

/** できばえ */
export const RATINGS = {
  great: { mark: '◎', label: 'よくできた', tone: 'ok' },
  good: { mark: '○', label: 'できた', tone: 'brand' },
  hard: { mark: '△', label: 'むずかしい', tone: 'warn' },
  ng: { mark: '×', label: 'できない', tone: 'danger' },
} as const
export type Rating = keyof typeof RATINGS
export const isRating = (v: unknown): v is Rating => typeof v === 'string' && v in RATINGS
