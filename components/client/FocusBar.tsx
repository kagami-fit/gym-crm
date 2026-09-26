'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui'
import { md, type Ymd } from '@/lib/dates'
import { num } from '@/lib/format'
import type { FocusInfo } from '@/lib/data/focus'
import { cn } from '@/lib/utils'

function Row({ label, warn, open, children }: { label: string; warn?: boolean; open: boolean; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className={cn('inline-flex flex-none items-center gap-0.5 rounded px-1.5 text-[11px] font-bold leading-5', warn ? 'bg-warn-soft text-warn' : 'bg-dark text-white')}>
        {warn && <AlertTriangle className="size-3" aria-hidden />}
        {label}
      </span>
      <span className={cn('min-w-0 flex-1', open ? 'whitespace-normal break-words' : 'truncate')}>{children}</span>
    </div>
  )
}

function Purpose({ info, open }: { info: FocusInfo; open: boolean }) {
  const parts = [info.purposes.join('・'), info.wish].filter(Boolean)
  if (!parts.length && !info.deadline) return <span className="text-ink-3">未登録（台帳・問診票で登録できます）</span>
  return (
    <>
      {info.purposes.length > 0 && <span className="font-bold">{info.purposes.join('・')}</span>}
      {info.wish && (
        <>
          {info.purposes.length > 0 && <span className="text-ink-3">／</span>}
          {info.wish}
        </>
      )}
      {info.deadline && <span className="text-ink-2">（{info.deadline}）</span>}
      {open && !info.wish && <span className="ml-1 text-ink-3">（なりたい姿は問診票で登録できます）</span>}
    </>
  )
}

function Goal({ info, open }: { info: FocusInfo; open: boolean }) {
  const g = info.goal
  if (!g) return <span className="text-ink-3">未設定（体重・目標タブで設定できます）</span>
  const reached = g.remainingKg != null && g.remainingKg <= 0.05
  return (
    <>
      <span className="num font-bold">{num(g.targetWeightKg)}kg</span>
      {g.gain && <span>まで増やす</span>}
      {g.remainingKg != null &&
        (reached ? (
          <Badge tone="ok" className="ml-1.5 align-middle">
            目標達成
          </Badge>
        ) : (
          <>
            <span className="text-ink-3"> ／ </span>あと <span className="num font-bold">{num(g.remainingKg)}kg</span>
          </>
        ))}
      {g.currentWeightKg != null && (
        <span className="text-ink-2">
          （現在 <span className="num">{num(g.currentWeightKg)}kg</span>
          {g.currentDate && <span className="num">・{md(g.currentDate)}</span>}）
        </span>
      )}
      {g.aheadKg != null && !reached && (
        <span className={cn('font-bold', g.aheadKg >= 0 ? 'text-ok' : 'text-warn')}>
          {' '}
          予定より<span className="num">{num(Math.abs(g.aheadKg))}kg</span>
          {g.aheadKg >= 0 ? '先行' : '遅れ'}
        </span>
      )}
      {open && g.paceName && <span className="text-ink-2">・ペース {g.paceName}</span>}
      {open && g.note && <span className="block text-ink-2">メモ：{g.note}</span>}
    </>
  )
}

function Cautions({ info, open }: { info: FocusInfo; open: boolean }) {
  if (!open) return <span className="font-bold text-warn">{info.cautions.map((c) => c.label.replace(/（.*?）/g, '')).join('・')}</span>
  return (
    <span className="block space-y-0.5">
      {info.cautions.map((c, i) => (
        <span key={i} className="block">
          <span className="font-bold text-warn">{c.label}</span>
          {c.detail && <span className="text-ink-2">：{c.detail}</span>}
        </span>
      ))}
    </span>
  )
}

/**
 * お客様の目的・目標・注意事項を、トレーニング中にいつも見えるところに出す。
 * bar：トレーニングのページの上に固定する帯（右に手書きメモ・会話メモのボタン）
 * line：手書きメモの画面の見出しの下に出す1行
 * 「詳しく」で、なりたい姿・目標のメモ・問診の詳細まで広げて表示する。
 */
export function FocusBar({ info, clientId, base, variant = 'bar', actions }: { info: FocusInfo; clientId: string; base: Ymd; variant?: 'bar' | 'line'; actions?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const q = `?date=${base}`
  const toggle = (
    <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex h-7 flex-none items-center gap-1 rounded-full px-2.5 text-xs font-bold text-ink-2 hover:bg-brand-soft" aria-expanded={open}>
      {open ? '閉じる' : '詳しく'}
      <ChevronDown className={cn('size-4 transition', open && 'rotate-180')} aria-hidden />
    </button>
  )
  const links = open && (
    <p className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs font-bold">
      <Link href={`/clients/${clientId}/body${q}`} className="text-brand-ink underline-offset-2 hover:underline">
        目標を変える
      </Link>
      <Link href={`/clients/${clientId}/questionnaire${q}`} className="text-brand-ink underline-offset-2 hover:underline">
        問診票を見る
      </Link>
      <Link href={`/clients/${clientId}/profile${q}`} className="text-brand-ink underline-offset-2 hover:underline">
        台帳を見る
      </Link>
    </p>
  )

  if (variant === 'line') {
    // 手書きメモの画面：1行目に目的、2行目に目標と注意（書く場所をなるべく広く残す）
    return (
      <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 text-xs leading-5 sm:text-sm sm:leading-6">
        <Row label="目的" open={open}>
          <Purpose info={info} open={open} />
        </Row>
        {toggle}
        <div className={cn('col-span-2 flex min-w-0 gap-x-4', open && 'flex-col gap-y-0.5')}>
          <div className="min-w-0 flex-1">
            <Row label="目標" open={open}>
              <Goal info={info} open={open} />
            </Row>
          </div>
          {info.cautions.length > 0 && (
            <div className={cn('min-w-0', !open && 'max-w-[45%]')}>
              <Row label="注意" warn open={open}>
                <Cautions info={info} open={open} />
              </Row>
            </div>
          )}
        </div>
        {links && <div className="col-span-2">{links}</div>}
      </div>
    )
  }

  // 1行目：目的＋ボタン／2行目：目標（横幅いっぱい。予定との差まで見えるように）／3行目：注意＋「詳しく」
  return (
    <div className="no-print sticky top-[var(--client-tabs-h)] z-20 -mx-4 -mt-5 mb-4 border-b border-line bg-page/95 px-4 py-1.5 backdrop-blur sm:-mx-6 sm:px-6 xl:-mx-8 xl:px-8">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 text-sm leading-6">
        <Row label="目的" open={open}>
          <Purpose info={info} open={open} />
        </Row>
        <div className="flex flex-wrap justify-end gap-1.5">{actions}</div>
        <div className="col-span-2 min-w-0">
          <Row label="目標" open={open}>
            <Goal info={info} open={open} />
          </Row>
        </div>
        <div className="min-w-0">
          {info.cautions.length > 0 && (
            <Row label="注意" warn open={open}>
              <Cautions info={info} open={open} />
            </Row>
          )}
        </div>
        <div className="justify-self-end">{toggle}</div>
        {links && <div className="col-span-2">{links}</div>}
      </div>
    </div>
  )
}
