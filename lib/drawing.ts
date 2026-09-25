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

/** ノート風の罫線（y座標） */
export const RULE_LINES = Array.from({ length: Math.floor(PAGE_H / 65) - 1 }, (_, i) => (i + 1) * 65 + 20).filter((y) => y < PAGE_H - 20)
