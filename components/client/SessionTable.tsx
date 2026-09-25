import { estimate1RM, summarize, volume } from '@/lib/calc/training'
import type { OneRmMethod } from '@/lib/calc/settings'
import type { SessionDetail } from '@/lib/data/training'
import { int, num } from '@/lib/format'
import { mdw } from '@/lib/dates'

const kgText = (w: number) => (w === 0 ? '自重' : `${num(w, w % 1 === 0 ? 0 : 1)}kg`)

/**
 * 1回分のトレーニング内容（部位・種目・重さ×回数×セット・総負荷量・推定1RM）。
 * 「前回」はパソコンの広い画面では列、iPad では種目名の下に小さく出す。
 */
export function SessionTable({ session, method, previous }: { session: SessionDetail; method: OneRmMethod; previous?: Record<string, { date: string; weightKg: number; reps: number; sets: number }> }) {
  const sum = summarize(session)
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full text-sm">
        <thead className="bg-tint text-left text-xs text-dark">
          <tr className="whitespace-nowrap">
            <th className="px-3 py-2.5 font-bold">部位</th>
            <th className="px-3 py-2.5 font-bold">種目</th>
            <th className="px-3 py-2.5 text-right font-bold">重さ</th>
            <th className="px-3 py-2.5 text-right font-bold">回数</th>
            <th className="px-3 py-2.5 text-right font-bold">セット</th>
            <th className="px-3 py-2.5 text-right font-bold">総負荷量</th>
            <th className="px-3 py-2.5 text-right font-bold">推定1RM</th>
            {previous && <th className="hidden px-3 py-2.5 font-bold xl:table-cell">前回</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {session.rows.map((r, i) => {
            const rm = estimate1RM(method, r.weightKg, r.reps)
            const prev = previous?.[r.exercise]
            const prevText = prev ? `${mdw(prev.date)} ${kgText(prev.weightKg)}×${prev.reps}×${prev.sets}` : '初回'
            return (
              <tr key={i}>
                <td className="whitespace-nowrap px-3 py-2.5 text-ink-2">{r.bodyPart}</td>
                <td className="min-w-40 px-3 py-2.5">
                  <span className="font-bold">{r.exercise}</span>
                  {previous && <span className="num mt-0.5 block text-xs text-ink-3 xl:hidden">前回 {prevText}</span>}
                </td>
                <td className="num tnum whitespace-nowrap px-3 py-2.5 text-right">{kgText(r.weightKg)}</td>
                <td className="num tnum whitespace-nowrap px-3 py-2.5 text-right">{r.reps}回</td>
                <td className="num tnum whitespace-nowrap px-3 py-2.5 text-right">{r.sets}</td>
                <td className="num tnum whitespace-nowrap px-3 py-2.5 text-right">{int(volume(r))}</td>
                <td className="num tnum whitespace-nowrap px-3 py-2.5 text-right">{rm != null ? `${num(rm)}kg` : '—'}</td>
                {previous && <td className="num hidden whitespace-nowrap px-3 py-2.5 text-xs text-ink-3 xl:table-cell">{prevText}</td>}
              </tr>
            )
          })}
        </tbody>
        <tfoot className="bg-soft text-xs">
          <tr className="whitespace-nowrap">
            <td colSpan={4} className="px-3 py-2.5 font-bold text-ink-2">
              合計 {sum.exerciseCount}種目
            </td>
            <td className="num tnum px-3 py-2.5 text-right font-bold">{sum.totalSets}</td>
            <td className="num tnum px-3 py-2.5 text-right font-bold">{int(sum.volume)}</td>
            <td className="px-3 py-2.5" />
            {previous && <td className="hidden xl:table-cell" />}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
