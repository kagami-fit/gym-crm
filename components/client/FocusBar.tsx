'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui'
import { addDays, md, monthJa, type Ymd } from '@/lib/dates'
import { int, num } from '@/lib/format'
import type { FocusInfo } from '@/lib/data/focus'
import { cn } from '@/lib/utils'

function Row({ label, warn, open, big, children }: { label: string; warn?: boolean; open: boolean; big?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('flex min-w-0 items-baseline', big ? 'gap-2.5' : 'gap-2')}>
      <span className={cn('inline-flex flex-none items-center gap-0.5 rounded font-bold', big ? 'px-2 text-[13px] leading-6' : 'px-1.5 text-[11px] leading-5', warn ? 'bg-warn-soft text-warn' : 'bg-dark text-white')}>
        {warn && <AlertTriangle className={big ? 'size-3.5' : 'size-3'} aria-hidden />}
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

/** 今月：期（色つき）と月のテーマ・トレーニングテーマ */
function Month({ info, open, big }: { info: FocusInfo; open: boolean; big?: boolean }) {
  const m = info.month
  if (!info.phase && !m) return <span className="text-ink-3">未設定（ステップのタブで期とテーマを決められます）</span>
  return (
    <>
      {info.phase && (
        <span className={cn('mr-1.5 inline-flex items-center gap-1 rounded-full align-[1px] font-bold text-ink', big ? 'px-2.5 text-sm leading-6' : 'px-2 text-xs leading-5')} style={{ background: `${info.phase.color}24` }}>
          <span className={cn('rounded-full', big ? 'size-2.5' : 'size-2')} style={{ background: info.phase.color }} aria-hidden />
          {info.phase.name}
        </span>
      )}
      {m?.theme && <span className="font-bold">{m.theme}</span>}
      {m?.trainingTheme && (
        <>
          {m.theme && <span className="text-ink-3"> ／ </span>}
          <span className="text-ink-2">トレ：{m.trainingTheme}</span>
        </>
      )}
      {open && m && <span className="block text-xs text-ink-3">{monthJa(m.key)}のテーマ</span>}
    </>
  )
}

/** 食事：直近の週の平均カロリーと設定の差・PFC */
function Meal({ info, open, big }: { info: FocusInfo; open: boolean; big?: boolean }) {
  const n = info.nutrition
  if (!n) return <span className="text-ink-3">未入力（食事メモのタブで週ごとに入れられます）</span>
  const diff = n.avgKcal != null && n.targetKcal != null ? n.avgKcal - n.targetKcal : null
  const pfc = [n.proteinG != null ? `P${int(n.proteinG)}` : null, n.fatG != null ? `F${int(n.fatG)}` : null, n.carbsG != null ? `C${int(n.carbsG)}` : null].filter(Boolean).join(' ')
  return (
    <>
      <span className="num font-bold">{n.avgKcal != null ? int(n.avgKcal) : '—'}</span>
      <span className="text-ink-2">／設定 </span>
      <span className="num">{n.targetKcal != null ? int(n.targetKcal) : '—'}</span>
      <span className="text-ink-2">kcal</span>
      {diff != null && <span className={cn('num ml-1 font-bold', diff > 0 ? 'text-warn' : 'text-ok')}>{`${diff > 0 ? '+' : ''}${int(diff)}`}</span>}
      {pfc && <span className="num ml-1.5 text-ink-2">{pfc}</span>}
      <span className={cn('num ml-1.5 text-ink-3', big ? 'text-sm' : 'text-xs')}>
        {md(n.weekStart)}〜{open ? md(addDays(n.weekStart, 6)) : ''}
      </span>
    </>
  )
}

/**
 * お客様の目的・目標・注意事項を、トレーニング中にいつも見えるところに出す。
 * bar：トレーニングのページの上に固定する帯（右に手書きメモ・会話メモのボタン）
 * line：手書きメモの画面の見出しの下に出す1行
 * 「詳しく」で、なりたい姿・目標のメモ・問診の詳細まで広げて表示する。
 */
export function FocusBar({
  info,
  clientId,
  base,
  variant = 'bar',
  actions,
  alerts,
}: {
  info: FocusInfo
  clientId: string
  base: Ymd
  variant?: 'bar' | 'line'
  actions?: React.ReactNode
  /** そのお客様のお知らせ（帯の最後の行に出す） */
  alerts?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const q = `?date=${base}`
  const big = variant === 'bar'
  const toggle = (
    <button type="button" onClick={() => setOpen((v) => !v)} className={cn('inline-flex flex-none items-center gap-1 rounded-full font-bold text-ink-2 hover:bg-brand-soft', big ? 'h-9 px-3 text-sm' : 'h-7 px-2.5 text-xs')} aria-expanded={open}>
      {open ? '閉じる' : '詳しく'}
      <ChevronDown className={cn('size-4 transition', open && 'rotate-180')} aria-hidden />
    </button>
  )
  const links = open && (
    <p className={cn('flex flex-wrap gap-x-4 gap-y-1 pt-1 font-bold', big ? 'text-sm' : 'text-xs')}>
      <Link href={`/clients/${clientId}/body${q}`} className="text-brand-ink underline-offset-2 hover:underline">
        目標を変える
      </Link>
      <Link href={`/clients/${clientId}/questionnaire${q}`} className="text-brand-ink underline-offset-2 hover:underline">
        問診票を見る
      </Link>
      <Link href={`/clients/${clientId}/profile${q}`} className="text-brand-ink underline-offset-2 hover:underline">
        台帳を見る
      </Link>
      <Link href={`/clients/${clientId}/steps${q}`} className="text-brand-ink underline-offset-2 hover:underline">
        期・テーマを変える
      </Link>
      <Link href={`/clients/${clientId}/meals${q}`} className="text-brand-ink underline-offset-2 hover:underline">
        食事の数字を入れる
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
        {open && (
          <div className="col-span-2 flex min-w-0 flex-col gap-y-0.5">
            <Row label="今月" open={open}>
              <Month info={info} open={open} />
            </Row>
            <Row label="食事" open={open}>
              <Meal info={info} open={open} />
            </Row>
          </div>
        )}
        {links && <div className="col-span-2">{links}</div>}
        {alerts && <div className="col-span-2 min-w-0 pt-0.5">{alerts}</div>}
      </div>
    )
  }

  // 1行目：目的＋ボタン／2行目：目標（横幅いっぱい。予定との差まで見えるように）／3行目：今月（期・テーマ）と食事（iPad 縦では2行）／4行目：注意＋「詳しく」／5行目：お知らせ・宿題
  return (
    <div className="no-print sticky top-[var(--client-tabs-h)] z-20 -mx-4 -mt-5 mb-4 border-b border-line bg-page/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6 xl:-mx-8 xl:px-8">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-base leading-7">
        <Row label="目的" open={open} big>
          <Purpose info={info} open={open} />
        </Row>
        <div className="flex flex-wrap justify-end gap-2">{actions}</div>
        <div className="col-span-2 min-w-0">
          <Row label="目標" open={open} big>
            <Goal info={info} open={open} />
          </Row>
        </div>
        {/* 今月と食事：横長の画面では横に並べ、iPad 縦などでは1行ずつ（途中で切れないように） */}
        <div className={cn('col-span-2 grid min-w-0 gap-x-5 gap-y-1', open ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]')}>
          <Row label="今月" open={open} big>
            <Month info={info} open={open} big />
          </Row>
          <Row label="食事" open={open} big>
            <Meal info={info} open={open} big />
          </Row>
        </div>
        <div className="min-w-0">
          {info.cautions.length > 0 && (
            <Row label="注意" warn open={open} big>
              <Cautions info={info} open={open} />
            </Row>
          )}
        </div>
        <div className="justify-self-end">{toggle}</div>
        {links && <div className="col-span-2">{links}</div>}
        {alerts && <div className="col-span-2 min-w-0 pt-1">{alerts}</div>}
      </div>
    </div>
  )
}
