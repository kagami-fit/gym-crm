// グラフの色と軸の見た目。Resole の黄色を濃くした金色を主系列に（dataviz の検証済み：
// 金 #c98500・青 #2a78d6・緑 #1baf7a は白背景で色覚の多様性OK、金と青はコントラスト3:1以上）
export const C = {
  weight: '#c98500', // series-1（金）
  bodyFat: '#2a78d6', // series-2（青）
  third: '#1baf7a', // series-3（緑）
  bar: '#c98500',
  grid: '#ece6d6',
  axis: '#d9d0b8',
  tick: '#8c877a',
  target: '#5e5a50',
  ink: '#2f2d27',
  surface: '#ffffff',
}

export const axisTick = { fill: C.tick, fontSize: 12 }

/** 値の範囲にゆとりを持たせ、切りのよい目盛り（0.5・1・2・5…刻み）をそろえて返す */
export function niceScale(values: Array<number | null | undefined>, minPad = 0.5): { domain: [number, number] | ['auto', 'auto']; ticks?: number[] } {
  const v = values.filter((x): x is number => x != null && Number.isFinite(x))
  if (!v.length) return { domain: ['auto', 'auto'] }
  const lo = Math.min(...v)
  const hi = Math.max(...v)
  const pad = Math.max(minPad, (hi - lo) * 0.12)
  const span = hi - lo + pad * 2
  const step = [0.5, 1, 2, 5, 10, 20, 50].find((s) => span / s <= 6) ?? 100
  const start = Math.floor((lo - pad) / step) * step
  const end = Math.ceil((hi + pad) / step) * step
  const ticks: number[] = []
  for (let t = start; t <= end + 1e-9; t += step) ticks.push(Math.round(t * 100) / 100)
  return { domain: [start, end], ticks }
}

export const dotStyle = (color: string) => ({ r: 4, fill: color, stroke: C.surface, strokeWidth: 2 })
export const activeDotStyle = (color: string) => ({ r: 5.5, fill: color, stroke: C.surface, strokeWidth: 2 })
