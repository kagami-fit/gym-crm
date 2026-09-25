'use client'

import { useState } from 'react'
import { buttonClass } from '@/components/ui'
import { cn } from '@/lib/utils'

export type LegendItem = { label: string; color: string; kind?: 'line' | 'dash' | 'bar' }

export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          {i.kind === 'bar' ? (
            <span className="inline-block size-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
          ) : (
            <svg width="16" height="6" aria-hidden>
              <line x1="0" y1="3" x2="16" y2="3" stroke={i.color} strokeWidth="2" strokeDasharray={i.kind === 'dash' ? '4 3' : undefined} strokeLinecap="round" />
            </svg>
          )}
          {i.label}
        </li>
      ))}
    </ul>
  )
}

/** グラフのカード。見出し・凡例・「表で見る」切り替え（表はグラフと同じ値） */
export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  children,
  className,
}: {
  title: string
  subtitle?: React.ReactNode
  legend?: LegendItem[]
  table?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const [showTable, setShowTable] = useState(false)
  return (
    <div className={cn('rounded-xl border border-line bg-white p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-black text-ink">{title}</h3>
          {subtitle && <div className="mt-0.5 text-xs text-ink-3">{subtitle}</div>}
        </div>
        {table && (
          <button type="button" onClick={() => setShowTable((v) => !v)} className={buttonClass.small} aria-pressed={showTable}>
            {showTable ? 'グラフで見る' : '表で見る'}
          </button>
        )}
      </div>
      {legend && legend.length > 1 && !showTable && (
        <div className="mt-2">
          <ChartLegend items={legend} />
        </div>
      )}
      <div className="mt-3">{showTable ? <div className="max-h-80 overflow-auto">{table}</div> : children}</div>
    </div>
  )
}

/** ツールチップ：値を強く、系列名は控えめに。系列は短い線で示す */
type TipEntry = { value?: unknown; name?: unknown; dataKey?: unknown; color?: string; payload?: unknown }

export function TooltipBox({
  active,
  payload,
  label,
  title,
  format,
}: {
  active?: boolean
  payload?: ReadonlyArray<TipEntry>
  label?: string | number
  title?: (label: string | number | undefined, payload: unknown) => React.ReactNode
  format: (v: number, name: string) => string
}) {
  if (!active || !payload?.length) return null
  const rows = payload.filter((p) => p.value != null && Number.isFinite(Number(p.value)))
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-bold text-ink-3">{title ? title(label, payload[0]?.payload) : String(label ?? '')}</p>
      {rows.length === 0 && <p className="mt-1 text-ink-3">記録なし</p>}
      {rows.map((p) => (
        <div key={String(p.dataKey)} className="mt-1 flex items-center gap-2">
          <span className="inline-block h-0.5 w-3 rounded" style={{ background: p.color }} aria-hidden />
          <span className="num text-sm font-semibold text-ink">{format(Number(p.value), String(p.name))}</span>
          <span className="text-ink-3">{String(p.name ?? '')}</span>
        </div>
      ))}
    </div>
  )
}

export function SegmentedControl<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>; label: string }) {
  return (
    <div className="inline-flex rounded-lg bg-soft p-1 ring-1 ring-line" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn('min-h-9 rounded-md px-3.5 py-2 text-sm font-bold text-ink-3 hover:text-ink', value === o.value && 'bg-white text-dark shadow-sm')}
          aria-pressed={value === o.value}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function DataTable({ head, rows }: { head: string[]; rows: Array<Array<React.ReactNode>> }) {
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-soft text-ink-3">
        <tr>
          {head.map((h, i) => (
            <th key={h} className={cn('px-2 py-1.5 font-bold', i === 0 ? 'text-left' : 'text-right')}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((r, ri) => (
          <tr key={ri}>
            {r.map((c, ci) => (
              <td key={ci} className={cn('num tnum px-2 py-1.5', ci === 0 ? 'text-left text-ink-2' : 'text-right text-ink')}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
