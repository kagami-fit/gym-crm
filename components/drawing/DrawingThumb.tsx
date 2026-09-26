import { INKS, PAGE_H, PAGE_W, RULE_LINES, type DrawingThumb } from '@/lib/drawing'
import { cn } from '@/lib/utils'

/**
 * 手書きメモの小さな表示（間引いた線）。一覧の縮小表示と、元の線を読み込むまでの仮表示に使う。
 * minStroke：小さく表示すると線が消えるので、表示の大きさに合わせて最低限の太さ（論理座標）を指定する。
 */
export function DrawingThumbSvg({
  thumb,
  minStroke = 0,
  lines = false,
  className,
  label,
  view,
}: {
  thumb: DrawingThumb
  minStroke?: number
  lines?: boolean
  className?: string
  label?: string
  view?: { y: number; h: number }
}) {
  return (
    <svg viewBox={view ? `0 ${view.y} ${PAGE_W} ${view.h}` : `0 0 ${PAGE_W} ${PAGE_H}`} className={cn('block h-auto w-full bg-[#fffdf6]', className)} role="img" aria-label={label ?? '手書きメモ'}>
      {lines && RULE_LINES.map((y) => <line key={y} x1={40} x2={PAGE_W - 40} y1={y} y2={y} stroke="#efe6c9" strokeWidth={2} />)}
      {thumb.paths.map((p, i) => (
        <path key={i} d={p.d} fill="none" stroke={INKS[p.c].color} strokeOpacity={INKS[p.c].opacity} strokeWidth={Math.max(p.w, minStroke)} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  )
}
