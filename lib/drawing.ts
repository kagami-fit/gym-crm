// 手書きメモの保存形式と描画（Apple Pencil の筆圧に対応。線は座標で保存するので拡大してもきれい）
import { getStroke } from 'perfect-freehand'

/** 1ページの大きさ（論理座標。iPad縦向きに合う比率） */
export const PAGE_W = 1000
export const PAGE_H = 1300
export const MAX_PAGES = 10
const MAX_STROKES_PER_PAGE = 3000
const MAX_POINTS_PER_STROKE = 6000

export const INKS = {
  ink: { label: '黒', color: '#2f2d27', opacity: 1 },
  red: { label: '赤', color: '#d03b3b', opacity: 1 },
  blue: { label: '青', color: '#2a78d6', opacity: 1 },
  marker: { label: 'マーカー', color: '#ffd00b', opacity: 0.45 },
} as const
export type Ink = keyof typeof INKS
export const isInk = (v: unknown): v is Ink => typeof v === 'string' && v in INKS

export const PEN_SIZES = [
  { key: 'S', label: '細', size: 4 },
  { key: 'M', label: '中', size: 7 },
  { key: 'L', label: '太', size: 12 },
] as const
export const MARKER_SIZE = 30

/** 1本の線。p は [x, y, 筆圧, x, y, 筆圧, …] の並び */
export type Stroke = { c: Ink; s: number; p: number[]; pen?: boolean }
export type DrawingData = { v: 1; pages: Stroke[][] }

export const emptyDrawing = (): DrawingData => ({ v: 1, pages: [[]] })

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** 保存値・送信値を検査して正規化する（壊れた値は捨てる） */
export function parseDrawing(raw: unknown): DrawingData {
  if (!raw || typeof raw !== 'object') return emptyDrawing()
  const pagesIn = (raw as { pages?: unknown }).pages
  if (!Array.isArray(pagesIn)) return emptyDrawing()
  const pages: Stroke[][] = []
  for (const pg of pagesIn.slice(0, MAX_PAGES)) {
    if (!Array.isArray(pg)) continue
    const strokes: Stroke[] = []
    for (const st of pg.slice(0, MAX_STROKES_PER_PAGE)) {
      if (!st || typeof st !== 'object') continue
      const { c, s, p, pen } = st as Partial<Stroke>
      if (!isInk(c) || typeof s !== 'number' || !Array.isArray(p) || p.length < 3) continue
      const pts: number[] = []
      for (let i = 0; i + 2 < p.length && i < MAX_POINTS_PER_STROKE * 3; i += 3) {
        const x = Number(p[i]), y = Number(p[i + 1]), pr = Number(p[i + 2])
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue
        pts.push(Math.round(clamp(x, 0, PAGE_W) * 10) / 10, Math.round(clamp(y, 0, PAGE_H) * 10) / 10, Math.round(clamp(Number.isFinite(pr) ? pr : 0.5, 0, 1) * 100) / 100)
      }
      if (pts.length >= 3) strokes.push({ c, s: clamp(s, 1, 60), p: pts, ...(pen ? { pen: true } : {}) })
    }
    pages.push(strokes)
  }
  return { v: 1, pages: pages.length ? pages : [[]] }
}

export const strokeCount = (d: DrawingData) => d.pages.reduce((a, p) => a + p.length, 0)
export const isEmptyDrawing = (d: DrawingData) => strokeCount(d) === 0

const avg = (a: number, b: number) => (a + b) / 2

/** perfect-freehand の輪郭点を SVG の path に変換（公式READMEの方法） */
function outlineToPath(points: number[][]): string {
  const len = points.length
  if (len < 4) return ''
  let a = points[0]
  let b = points[1]
  const c = points[2]
  let d = `M${a[0].toFixed(1)},${a[1].toFixed(1)} Q${b[0].toFixed(1)},${b[1].toFixed(1)} ${avg(b[0], c[0]).toFixed(1)},${avg(b[1], c[1]).toFixed(1)} T`
  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i]
    b = points[i + 1]
    d += `${avg(a[0], b[0]).toFixed(1)},${avg(a[1], b[1]).toFixed(1)} `
  }
  return `${d}Z`
}

/** 1本の線を塗りつぶし用の path にする（ペンは筆圧で太さが変わる。指・マウスは速さから推定） */
export function strokePath(st: Stroke, complete = true): string {
  const input: number[][] = []
  for (let i = 0; i + 2 < st.p.length; i += 3) input.push([st.p[i], st.p[i + 1], st.p[i + 2]])
  if (!input.length) return ''
  const marker = st.c === 'marker'
  const outline = getStroke(input, {
    size: st.s,
    thinning: marker ? 0 : 0.6,
    smoothing: 0.55,
    streamline: marker ? 0.6 : 0.45,
    simulatePressure: !marker && !st.pen,
    start: { taper: 0, cap: true },
    end: { taper: 0, cap: true },
    last: complete,
  })
  const d = outlineToPath(outline)
  if (d) return d
  // 点だけ（トン）のときは丸を描く
  const [x, y] = input[0]
  const r = Math.max(1.5, st.s / 2)
  return `M${x - r},${y} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0 Z`
}

// ── 一覧用の小さな表示（サムネイル） ─────────────────────
// 全部の線をそのまま送ると重いので、最初に書き込みのあるページだけを間引いた線（折れ線）にして保存しておく。
// 一覧ではこれを表示し、タップしたら元の線を読み込んで表示する。

/** 色と太さが同じ線をまとめた SVG の path（d は整数の座標、2点目以降は相対移動） */
export type ThumbPath = { c: Ink; w: number; d: string }
/** pages：書き込みのあるページ数／page：表示しているページ（0始まり）／box：書き込みのある範囲 [左, 上, 右, 下] */
export type DrawingThumb = { v: 2; pages: number; page: number; box: [number, number, number, number]; paths: ThumbPath[] }

const THUMB_MAX_CHARS = 40_000

/** 線の点を間引く（Ramer–Douglas–Peucker 法。eps は許す誤差＝論理座標）。[x, y, x, y, …] の整数で返す */
export function simplifyStroke(p: number[], eps: number): number[] {
  const n = Math.floor(p.length / 3)
  if (n === 0) return []
  if (n === 1) return [Math.round(p[0]), Math.round(p[1])]
  const keep = new Uint8Array(n)
  keep[0] = 1
  keep[n - 1] = 1
  const stack: Array<[number, number]> = [[0, n - 1]]
  const eps2 = eps * eps
  while (stack.length) {
    const [a, b] = stack.pop()!
    const ax = p[a * 3], ay = p[a * 3 + 1]
    const dx = p[b * 3] - ax, dy = p[b * 3 + 1] - ay
    const len2 = dx * dx + dy * dy
    let max = -1
    let at = -1
    for (let i = a + 1; i < b; i++) {
      const px = p[i * 3] - ax, py = p[i * 3 + 1] - ay
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / len2))
      const ex = px - t * dx, ey = py - t * dy
      const d2 = ex * ex + ey * ey
      if (d2 > max) {
        max = d2
        at = i
      }
    }
    if (at > 0 && max > eps2) {
      keep[at] = 1
      stack.push([a, at], [at, b])
    }
  }
  const out: number[] = []
  for (let i = 0; i < n; i++) if (keep[i]) out.push(Math.round(p[i * 3]), Math.round(p[i * 3 + 1]))
  return out
}

/** 数字を SVG の path 用につなげる（マイナスの前は区切りを省く） */
function joinNums(nums: number[]): string {
  let s = ''
  for (let i = 0; i < nums.length; i++) s += i === 0 || nums[i] < 0 ? String(nums[i]) : ` ${nums[i]}`
  return s
}

function polylinePath(pts: number[]): string {
  if (pts.length < 2) return ''
  const rel: number[] = []
  for (let i = 2; i + 1 < pts.length; i += 2) {
    const dx = pts[i] - pts[i - 2], dy = pts[i + 1] - pts[i - 1]
    if (dx !== 0 || dy !== 0) rel.push(dx, dy)
  }
  // 点だけ（トン）のときも丸い線端で点が描かれるよう、長さ0の線を入れる
  return `M${joinNums([pts[0], pts[1]])}l${rel.length ? joinNums(rel) : '0 0'}`
}

/** 一覧用の小さな表示を作る（書き込みがなければ null） */
export function drawingThumb(data: DrawingData): DrawingThumb | null {
  const pages = data.pages.filter((pg) => pg.length > 0).length
  const page = data.pages.findIndex((pg) => pg.length > 0)
  if (page < 0) return null
  const strokes = data.pages[page]
  let paths: ThumbPath[] = []
  const box: [number, number, number, number] = [PAGE_W, PAGE_H, 0, 0]
  for (const eps of [2.5, 5, 9]) {
    const groups = new Map<string, ThumbPath>()
    let chars = 0
    for (const st of strokes) {
      const pts = simplifyStroke(st.p, eps)
      for (let i = 0; i + 1 < pts.length; i += 2) {
        box[0] = Math.min(box[0], pts[i])
        box[1] = Math.min(box[1], pts[i + 1])
        box[2] = Math.max(box[2], pts[i])
        box[3] = Math.max(box[3], pts[i + 1])
      }
      const d = polylinePath(pts)
      if (!d) continue
      // 太さは筆圧で変わるので、表示用には少し細めの一定の太さにする
      const w = st.c === 'marker' ? MARKER_SIZE : Math.max(2, Math.round(st.s * 0.75))
      const key = `${st.c}:${w}`
      const g = groups.get(key)
      if (g) g.d += d
      else groups.set(key, { c: st.c, w, d })
      chars += d.length
    }
    // マーカーは下に、ペンは上に重ねる
    paths = [...groups.values()].sort((a, b) => Number(b.c === 'marker') - Number(a.c === 'marker'))
    if (chars <= THUMB_MAX_CHARS) break
  }
  return { v: 2, pages, page, box, paths }
}

/**
 * 一覧で見せる範囲（書き込みのある所から、高さは最大でページの半分）。
 * 短いメモは書いてある所だけを見せて、一覧が長くなりすぎないようにする。cut：下に続きがあるか
 */
export function previewCrop(t: DrawingThumb, maxRatio = 0.5): { y: number; h: number; cut: boolean } {
  const [, top, , bottom] = t.box
  const maxH = PAGE_H * maxRatio
  let y = Math.max(0, top - 60)
  const h = Math.min(maxH, Math.max(320, bottom - y + 60))
  if (y + h > PAGE_H) y = Math.max(0, PAGE_H - h)
  return { y: Math.round(y), h: Math.round(h), cut: bottom > y + h - 10 }
}

/** 保存してある小さな表示を検査する（形が違えば null＝作り直す） */
export function parseThumb(raw: unknown): DrawingThumb | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as Partial<DrawingThumb>
  if (t.v !== 2 || !Array.isArray(t.paths) || typeof t.pages !== 'number' || typeof t.page !== 'number') return null
  if (!Array.isArray(t.box) || t.box.length !== 4 || !t.box.every((n) => Number.isFinite(n))) return null
  const paths = t.paths.filter((p): p is ThumbPath => !!p && isInk(p.c) && typeof p.w === 'number' && typeof p.d === 'string' && /^[Ml0-9 -]*$/.test(p.d))
  return { v: 2, pages: t.pages, page: t.page, box: t.box, paths }
}

/** ノート風の罫線（y座標） */
export const RULE_LINES = Array.from({ length: Math.floor(PAGE_H / 65) - 1 }, (_, i) => (i + 1) * 65 + 20).filter((y) => y < PAGE_H - 20)
