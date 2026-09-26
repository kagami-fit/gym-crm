'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Loader2, Maximize2, NotebookPen } from 'lucide-react'
import { Sheet } from '@/components/Sheet'
import { buttonClass } from '@/components/ui'
import { DrawingPage } from '@/components/drawing/DrawingView'
import { DrawingThumbSvg } from '@/components/drawing/DrawingThumb'
import { mdw, type Ymd } from '@/lib/dates'
import { previewCrop, type DrawingData, type DrawingThumb } from '@/lib/drawing'
import { cn } from '@/lib/utils'

/** 手書きメモのある回（新しい順）。thumb は一覧に出している回だけ */
export type MemoItem = { sessionId: string; date: Ymd; thumb?: DrawingThumb }

type Ctx = {
  open: (sessionId: string) => void
  thumbOf: (sessionId: string) => DrawingThumb | undefined
  /** 読み込み済みの元の線（まだなら undefined） */
  dataOf: (sessionId: string) => DrawingData | null | undefined
  /** 元の線を読み込む（読み込み済み・読み込み中なら何もしない） */
  ensure: (sessionId: string) => void
}
const MemoCtx = createContext<Ctx | null>(null)

function useMemoViewer(): Ctx {
  const ctx = useContext(MemoCtx)
  if (!ctx) throw new Error('MemoViewerProvider の中で使ってください')
  return ctx
}

type Loaded = { data: DrawingData | null } | { error: true }

async function fetchDrawing(sessionId: string): Promise<DrawingData | null> {
  const res = await fetch(`/api/memos/${encodeURIComponent(sessionId)}`, { cache: 'no-store' })
  if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) throw new Error(`HTTP ${res.status}`)
  return ((await res.json()) as { data: DrawingData | null }).data
}

/**
 * 手書きメモをタップしてすぐ見られるようにする。
 * - 直近2回分は先に読み込んでおく（前回のメモはタップした瞬間に表示）
 * - 一覧のメモは画面に近づいたら元の線を読み込む（それまでは間引いた線で表示）
 * - まだ読み込んでいない回は、間引いた線を先に出し、読み込めたら元の線に置き換える
 * - 見ている回の前後も先に読み込む（「前の回」「次の回」をすぐ切り替えられる）
 */
export function MemoViewerProvider({ memos, children }: { memos: MemoItem[]; children: React.ReactNode }) {
  const [current, setCurrent] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({})
  // 読み込み済み・読み込み中の回（同じ回を二重に読み込まない）
  const requested = useRef(new Set<string>())

  const load = useCallback((sessionId: string) => {
    if (requested.current.has(sessionId)) return
    requested.current.add(sessionId)
    fetchDrawing(sessionId)
      .then((data) => setLoaded((m) => ({ ...m, [sessionId]: { data } })))
      .catch(() => {
        requested.current.delete(sessionId)
        setLoaded((m) => ({ ...m, [sessionId]: { error: true } }))
      })
  }, [])

  /** 読み込めなかったときの「もう一度」 */
  const retry = (sessionId: string) => {
    setLoaded((m) => {
      const next = { ...m }
      delete next[sessionId]
      return next
    })
    load(sessionId)
  }

  useEffect(() => {
    const t = setTimeout(() => memos.slice(0, 2).forEach((m) => load(m.sessionId)), 500)
    return () => clearTimeout(t)
  }, [memos, load])

  const index = memos.findIndex((m) => m.sessionId === current)
  const item = index >= 0 ? memos[index] : null
  const older = index >= 0 ? memos[index + 1] : undefined
  const newer = index > 0 ? memos[index - 1] : undefined

  useEffect(() => {
    if (older) load(older.sessionId)
    if (newer) load(newer.sessionId)
  }, [older, newer, load])

  // 左右キーで前後の回へ（外付けキーボード用）
  useEffect(() => {
    if (!item) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && older) setCurrent(older.sessionId)
      if (e.key === 'ArrowRight' && newer) setCurrent(newer.sessionId)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item, older, newer])

  const thumbs = useMemo(() => new Map(memos.map((m) => [m.sessionId, m.thumb])), [memos])
  const ctx = useMemo<Ctx>(
    () => ({
      open: (sessionId) => {
        load(sessionId)
        setCurrent(sessionId)
      },
      thumbOf: (sessionId) => thumbs.get(sessionId),
      dataOf: (sessionId) => {
        const l = loaded[sessionId]
        return l && 'data' in l ? l.data : undefined
      },
      ensure: load,
    }),
    [load, thumbs, loaded],
  )

  const state = item ? loaded[item.sessionId] : undefined
  const navBtn = 'inline-flex h-10 items-center gap-1 rounded-full border border-line-2 bg-white px-3 text-sm font-bold text-ink-2 hover:bg-soft disabled:opacity-35'

  return (
    <MemoCtx.Provider value={ctx}>
      {children}
      <Sheet
        variant="full"
        open={!!item}
        onClose={() => setCurrent(null)}
        title={
          item ? (
            <span>
              <span className="num">{mdw(item.date)}</span> の手書きメモ
            </span>
          ) : (
            ''
          )
        }
        headerExtra={
          item && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={navBtn} disabled={!older} onClick={() => older && setCurrent(older.sessionId)} aria-label="前の回の手書きメモ">
                <ChevronLeft className="size-4" aria-hidden />
                前の回
              </button>
              <button type="button" className={navBtn} disabled={!newer} onClick={() => newer && setCurrent(newer.sessionId)} aria-label="次の回の手書きメモ">
                次の回
                <ChevronRight className="size-4" aria-hidden />
              </button>
              <Link href={`/memo/${item.sessionId}`} className={cn(buttonClass.primary, 'h-10 px-4')}>
                <NotebookPen className="size-4" aria-hidden />
                書き足す
              </Link>
            </div>
          )
        }
      >
        {item && (
          <div className="mx-auto max-w-[880px] space-y-4">
            {!state || 'error' in state ? (
              <div className="relative">
                {item.thumb && <DrawingThumbSvg thumb={item.thumb} lines minStroke={3} className="rounded-xl border border-line" label={`${mdw(item.date)}の手書きメモ（読み込み中）`} />}
                <div className={cn('flex items-center justify-center gap-2 text-sm font-bold text-ink-2', item.thumb ? 'absolute inset-x-0 top-3' : 'py-24')}>
                  {state && 'error' in state ? (
                    <span className="rounded-full bg-white px-4 py-2 shadow">
                      読み込めませんでした。
                      <button type="button" className="ml-1 underline" onClick={() => retry(item.sessionId)}>
                        もう一度
                      </button>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 shadow">
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      読み込んでいます
                    </span>
                  )}
                </div>
              </div>
            ) : state.data ? (
              state.data.pages
                .map((p, i) => ({ p, i }))
                .filter(({ p }) => p.length > 0)
                .map(({ p, i }, n, all) => (
                  <figure key={i}>
                    <DrawingPage strokes={p} label={`${mdw(item.date)}の手書きメモ ${i + 1}ページ目`} />
                    {all.length > 1 && (
                      <figcaption className="num mt-1 text-center text-xs text-ink-3">
                        {n + 1} / {all.length}
                      </figcaption>
                    )}
                  </figure>
                ))
            ) : (
              <p className="py-24 text-center text-sm text-ink-2">この回の手書きメモは消されています</p>
            )}
          </div>
        )}
      </Sheet>
    </MemoCtx.Provider>
  )
}

/**
 * 一覧に出す手書きメモ（書き込みのある所から、最大でページの半分の高さ）。タップで全画面に大きく表示する。
 * 画面に近づいたら元の線を読み込み、それまでは間引いた線で表示する。
 */
export function MemoPreview({ sessionId, label }: { sessionId: string; label: string }) {
  const { open, thumbOf, dataOf, ensure } = useMemoViewer()
  const thumb = thumbOf(sessionId)
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          ensure(sessionId)
          io.disconnect()
        }
      },
      { rootMargin: '400px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [sessionId, ensure])

  if (!thumb) return null
  const view = previewCrop(thumb)
  const strokes = dataOf(sessionId)?.pages[thumb.page]
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => open(sessionId)}
      className="relative block w-full max-w-[760px] overflow-hidden rounded-xl border border-line-2 bg-[#fffdf6] text-left shadow-sm hover:ring-2 hover:ring-brand-deep active:ring-2 active:ring-brand-deep"
      aria-label={`${label}の手書きメモを大きく表示`}
    >
      {strokes ? (
        <DrawingPage strokes={strokes} view={view} className="rounded-none border-0" label={`${label}の手書きメモ`} />
      ) : (
        <DrawingThumbSvg thumb={thumb} view={view} lines minStroke={2} label={`${label}の手書きメモ`} />
      )}
      {view.cut && <span className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#fffdf6] via-[#fffdf6]/80 to-transparent" aria-hidden />}
      <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-dark/85 px-2.5 py-1 text-xs font-bold text-white">
        <Maximize2 className="size-3.5" aria-hidden />
        タップで拡大{thumb.pages > 1 ? `（全${thumb.pages}ページ）` : ''}
      </span>
    </button>
  )
}

/** 任意のボタンから手書きメモを開く（「前回の手書き」など） */
export function MemoOpenButton({ sessionId, className, children, title }: { sessionId: string; className?: string; children: React.ReactNode; title?: string }) {
  const { open } = useMemoViewer()
  return (
    <button type="button" onClick={() => open(sessionId)} className={className} title={title}>
      {children}
    </button>
  )
}
