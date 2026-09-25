'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { C } from './theme'
import { int, num } from '@/lib/format'

/** 目標のPFCバランス（3区分なのでドーナツで割合をひと目で。値は横の一覧にも出す） */
export function PfcDonut({ grams, targetKcal }: { grams: { carbs: number; fat: number; protein: number }; targetKcal: number }) {
  const data = [
    { key: 'carbs', name: '炭水化物', kcal: Math.max(0, grams.carbs * 4), g: grams.carbs, color: C.weight },
    { key: 'fat', name: '脂質', kcal: grams.fat * 9, g: grams.fat, color: C.bodyFat },
    { key: 'protein', name: 'たんぱく質', kcal: grams.protein * 4, g: grams.protein, color: C.third },
  ]
  const total = data.reduce((a, d) => a + d.kcal, 0) || 1
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative size-40 flex-none">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="kcal" nameKey="name" innerRadius="62%" outerRadius="100%" startAngle={90} endAngle={-270} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.[0] ? (
                  <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lg">
                    <span className="num text-sm font-semibold">{int(Number(payload[0].value))}kcal</span>
                    <span className="ml-1.5 text-ink-3">{String(payload[0].name)}</span>
                  </div>
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[10px] font-bold text-ink-3">目標</p>
            <p className="num text-lg font-semibold leading-tight">{int(targetKcal)}</p>
            <p className="text-[10px] font-bold text-ink-3">kcal</p>
          </div>
        </div>
      </div>
      <ul className="min-w-40 space-y-2 text-sm">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2">
            <span className="inline-block size-2.5 flex-none rounded-sm" style={{ background: d.color }} aria-hidden />
            <span className="w-20 font-bold text-ink-2">{d.name}</span>
            <span className="num font-semibold">{num(Math.max(0, d.g), 0)}g</span>
            <span className="num text-xs text-ink-3">{Math.round((d.kcal / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
