'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, Columns2, ExternalLink, Maximize2 } from 'lucide-react'
import { Sheet } from '@/components/Sheet'
import { buttonClass } from '@/components/ui'
import { md, ymdJa, type Ymd } from '@/lib/dates'
import { cn } from '@/lib/utils'

// PDF の表示（pdf.js）はブラウザの中だけで読み込む（サーバーでは組み立てない＝公開先の容量を小さくする）
const PdfView = dynamic(() => import('./PdfView').then((m) => m.PdfView), { ssr: false, loading: () => <div className="aspect-[1/1.414] w-full animate-pulse bg-soft" aria-hidden /> })

/** 自律神経の測定票（PDF・写真）1件。写真・資料にも使う（title は何の写真か） */
export type AnsFile = { id: string; measuredOn: Ymd; fileName: string; mimeType: string; note: string | null; title?: string | null }

const ansSrc = (id: string) => `/api/ans/${id}`

/**
 * 測定票の中身を表示する。写真はそのまま、PDF は画像に描いて出す（小さい表示は1ページ目、大きい表示は全ページ）。
 */
function FilePreview({ file, large, src }: { file: AnsFile; large?: boolean; src: (id: string) => string }) {
  if (file.mimeType === 'application/pdf') {
    return (
      <div className={cn('h-full w-full bg-white', large ? 'overflow-y-auto' : 'overflow-hidden')}>
        <PdfView url={src(file.id)} pages={large ? 'all' : 'first'} />
      </div>
    )
  }
  // ログインした人だけが見られるファイルなので、画像の最適化（next/image）は通さない
  return <img src={src(file.id)} alt={`${ymdJa(file.measuredOn, false)}の測定票`} loading="lazy" className={cn('h-full w-full bg-white', large ? 'object-contain' : 'object-cover object-top')} />
}

/** 小さい表示（押すと大きく開く） */
function Thumb({ file, label, onOpen, className, src, square }: { file: AnsFile; label?: string; onOpen: () => void; className?: string; src: (id: string) => string; square?: boolean }) {
  return (
    <button type="button" onClick={onOpen} className={cn('group block w-full overflow-hidden rounded-xl border border-line bg-soft text-left hover:ring-2 hover:ring-brand-deep active:brightness-95', className)} aria-label={`${ymdJa(file.measuredOn, false)}の測定票を大きく見る`}>
      <span className="flex items-center justify-between gap-2 border-b border-line bg-white px-3 py-2">
        <span className="text-sm font-black">
          {label && <span className="mr-1.5 rounded bg-dark px-1.5 py-0.5 text-[11px] font-bold text-white">{label}</span>}
          <span className="num">{ymdJa(file.measuredOn, false)}</span>
        </span>
        <Maximize2 className="size-4 flex-none text-ink-3 group-hover:text-ink" aria-hidden />
      </span>
      <span className={cn('block w-full', square ? 'aspect-square' : 'aspect-[3/4]')}>
        <FilePreview file={file} src={src} />
      </span>
      {(file.title || file.note) && <span className="block truncate border-t border-line bg-white px-3 py-1.5 text-xs text-ink-2">{[file.title, file.note].filter(Boolean).join('：')}</span>}
    </button>
  )
}

/**
 * 自律神経の測定票の一覧。押すと全画面で大きく開き、「前回と並べる」でお客様に見せながら比べられる。
 * compare：最新と前回の2つを並べて出す（概要・移行チェック用）／grid：すべてを並べる（指導計画用）
 * files は新しい順。footer は各測定の下に出すもの（削除ボタンなど）
 */
export function AnsGallery({
  files,
  mode = 'grid',
  footer,
  src = ansSrc,
  viewerTitle = '自律神経の測定',
  square,
  gridClassName,
}: {
  files: AnsFile[]
  mode?: 'compare' | 'grid'
  footer?: (f: AnsFile) => React.ReactNode
  /** ファイルを開くアドレス（写真・資料は /api/files/） */
  src?: (id: string) => string
  viewerTitle?: string
  /** 小さい表示を正方形にする（写真用） */
  square?: boolean
  gridClassName?: string
}) {
  const [open, setOpen] = useState<number | null>(null)
  const [pair, setPair] = useState(false)
  if (!files.length) return null
  const shown = mode === 'compare' ? files.slice(0, 2) : files
  const cur = open != null ? files[open] : null
  const older = open != null ? files[open + 1] : undefined

  return (
    <>
      {mode === 'compare' ? (
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          {/* 左が前回、右が最新（時間の流れの順に並べる）。1回目しかないときは左をあけておく */}
          {shown.length === 1 && <p className="flex items-center justify-center rounded-xl border border-dashed border-line-2 bg-soft p-4 text-center text-sm text-ink-3">前回の測定はまだありません</p>}
          {[...shown].reverse().map((f) => {
            const i = files.indexOf(f)
            return <Thumb key={f.id} file={f} src={src} label={i === 0 ? '最新' : '前回'} onOpen={() => (setPair(false), setOpen(i))} />
          })}
        </div>
      ) : (
        <ul className={cn('grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4', gridClassName)}>
          {shown.map((f, i) => (
            <li key={f.id} className="space-y-1.5">
              <Thumb file={f} src={src} square={square} label={mode === 'grid' && viewerTitle === '自律神経の測定' && i === 0 ? '最新' : undefined} onOpen={() => (setPair(false), setOpen(i))} />
              {footer?.(f)}
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={cur != null}
        onClose={() => setOpen(null)}
        variant="full"
        title={cur ? `${viewerTitle}　${ymdJa(cur.measuredOn)}${cur.title ? `　${cur.title}` : ''}` : viewerTitle}
        headerExtra={
          cur && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => setOpen((i) => (i != null && i < files.length - 1 ? i + 1 : i))} disabled={open === files.length - 1} className={buttonClass.small}>
                <ChevronLeft className="size-4" aria-hidden />
                前の測定
              </button>
              <button type="button" onClick={() => setOpen((i) => (i != null && i > 0 ? i - 1 : i))} disabled={open === 0} className={buttonClass.small}>
                次の測定
                <ChevronRight className="size-4" aria-hidden />
              </button>
              <button type="button" onClick={() => setPair((v) => !v)} disabled={!older} aria-pressed={pair} className={cn(buttonClass.small, pair && 'border-dark bg-dark text-white hover:bg-dark-2')}>
                <Columns2 className="size-4" aria-hidden />
                前回と並べる
              </button>
              <a href={src(cur.id)} target="_blank" rel="noreferrer" className={buttonClass.small}>
                <ExternalLink className="size-4" aria-hidden />
                別のタブで開く
              </a>
            </div>
          )
        }
        bodyClassName="flex min-h-0 flex-1 flex-col"
      >
        {cur && (
          <div className={cn('grid min-h-0 flex-1 gap-3', pair && older ? 'grid-cols-2' : 'grid-cols-1')}>
            {(pair && older ? [older, cur] : [cur]).map((f) => (
              <figure key={f.id} className="flex min-h-[60dvh] flex-col overflow-hidden rounded-xl border border-line bg-white">
                <figcaption className="flex flex-wrap items-baseline gap-x-2 border-b border-line px-3 py-2 text-sm">
                  <span className="font-black">
                    {f.id === cur.id ? (pair ? '今回' : '') : '前回'} <span className="num">{md(f.measuredOn)}</span>
                  </span>
                  {(f.title || f.note) && <span className="text-ink-2">{[f.title, f.note].filter(Boolean).join('：')}</span>}
                </figcaption>
                <div className="min-h-0 flex-1">
                  <FilePreview file={f} large src={src} />
                </div>
              </figure>
            ))}
          </div>
        )}
      </Sheet>
    </>
  )
}
