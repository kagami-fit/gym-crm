import { INKS, PAGE_H, PAGE_W, RULE_LINES, strokePath, type DrawingData, type Stroke } from '@/lib/drawing'
import { cn } from '@/lib/utils'

/** ノートの1ページ（罫線つき）。表示専用なのでサーバーでも描画できる */
export function DrawingPage({ strokes, className, label }: { strokes: Stroke[]; className?: string; label?: string }) {
  return (
    <svg viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} className={cn('block h-auto w-full rounded-xl border border-line bg-[#fffdf6]', className)} role="img" aria-label={label ?? '手書きメモ'}>
      {RULE_LINES.map((y) => (
        <line key={y} x1={40} x2={PAGE_W - 40} y1={y} y2={y} stroke="#efe6c9" strokeWidth={2} />
      ))}
      {strokes.map((st, i) => (
        <path key={i} d={strokePath(st)} fill={INKS[st.c].color} fillOpacity={INKS[st.c].opacity} />
      ))}
    </svg>
  )
}

/** 手書きメモの全ページ（空のページは出さない） */
export function DrawingView({ data, maxPages = 10, columns = 2, className }: { data: DrawingData; maxPages?: number; columns?: 1 | 2 | 3; className?: string }) {
  const pages = data.pages.map((p, i) => ({ p, i })).filter(({ p }) => p.length > 0).slice(0, maxPages)
  if (!pages.length) return null
  return (
    <div className={cn('grid gap-3', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3', className)}>
      {pages.map(({ p, i }) => (
        <figure key={i}>
          <DrawingPage strokes={p} label={`手書きメモ ${i + 1}ページ目`} />
          {data.pages.length > 1 && <figcaption className="mt-1 text-center text-xs text-ink-3">{i + 1}ページ目</figcaption>}
        </figure>
      ))}
    </div>
  )
}
