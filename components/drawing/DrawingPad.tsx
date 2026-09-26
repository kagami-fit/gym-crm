'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronLeft, ChevronRight, CloudOff, Eraser, FilePlus2, Hand, History, Loader2, Maximize2, PenLine, Redo2, Trash2, Undo2, X, ZoomIn } from 'lucide-react'
import { INKS, MARKER_SIZE, MAX_PAGES, PAGE_H, PAGE_W, PEN_SIZES, RULE_LINES, strokePath, type DrawingData, type Ink, type Stroke } from '@/lib/drawing'
import { DrawingView } from './DrawingView'
import { cn } from '@/lib/utils'

type Tool = 'pen' | 'eraser'
type SaveState = 'saved' | 'dirty' | 'saving' | 'error'
type SizeKey = (typeof PEN_SIZES)[number]['key']

const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100
const pathCache = new WeakMap<Stroke, string>()
const pathOf = (st: Stroke) => {
  let d = pathCache.get(st)
  if (d == null) {
    d = strokePath(st)
    pathCache.set(st, d)
  }
  return d
}

/** 点(x,y)から線分までの距離 */
function segDist(x: number, y: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1
  const len = dx * dx + dy * dy
  const t = len ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len)) : 0
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
}
function hits(st: Stroke, x: number, y: number, r: number) {
  const p = st.p
  if (p.length < 6) return Math.hypot(p[0] - x, p[1] - y) < r
  for (let i = 0; i + 5 < p.length; i += 3) if (segDist(x, y, p[i], p[i + 1], p[i + 3], p[i + 4]) < r) return true
  return false
}

/** iPad を横向きにしているか（回転にも追従） */
function useLandscape() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia('(orientation: landscape)')
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia('(orientation: landscape)').matches,
    () => false,
  )
}

/**
 * iPad で書く手書きメモ。Apple Pencil を使うと自動で「ペンだけで書く」になり、手のひらや指が触れても線が引かれない。
 * 書いたら数秒後に自動で保存する。
 */
export function DrawingPad({
  initial,
  save,
  backHref,
  title,
  previous,
  info,
  toolbarExtra,
}: {
  initial: DrawingData
  save: (json: string) => Promise<{ ok: boolean; message?: string; savedAt?: string }>
  backHref: string
  title: string
  previous?: { label: string; data: DrawingData } | null
  /** 見出しの下に出す内容（お客様の目的・目標など） */
  info?: React.ReactNode
  /** 道具の並びの最後に足すボタン（会話メモなど） */
  toolbarExtra?: React.ReactNode
}) {
  const router = useRouter()
  const [history, setHistory] = useState<{ stack: Stroke[][][]; index: number }>({ stack: [initial.pages], index: 0 })
  const pages = history.stack[history.index]
  const [pageIndex, setPageIndex] = useState(0)
  const page = Math.min(pageIndex, pages.length - 1)
  const [tool, setTool] = useState<Tool>('pen')
  const [ink, setInk] = useState<Ink>('ink')
  const [sizeKey, setSizeKey] = useState<SizeKey>('M')
  const [fingerDraws, setFingerDraws] = useState(true)
  const [penDetected, setPenDetected] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [showPrev, setShowPrev] = useState(false)
  const [eraserPreview, setEraserPreview] = useState<Stroke[] | null>(null)
  // 表示：縦向きはページ全体、横向きは横幅に合わせて大きく（指でスクロール、ペンで書く）
  const landscape = useLandscape()
  const [fitChoice, setFitChoice] = useState<'page' | 'width' | null>(null)
  const fit = fitChoice ?? (landscape ? 'width' : 'page')
  const mainRef = useRef<HTMLElement>(null)
  const panning = useRef<{ id: number; startY: number; startScroll: number } | null>(null)

  const svgRef = useRef<SVGSVGElement>(null)
  const liveRef = useRef<SVGPathElement>(null)
  const current = useRef<{ id: number; stroke: Stroke } | null>(null)
  const erasing = useRef<{ id: number; working: Stroke[] } | null>(null)
  const frame = useRef<number | null>(null)
  const latest = useRef({ pages, saveState })
  useEffect(() => {
    latest.current = { pages, saveState }
  }, [pages, saveState])

  const commit = useCallback((next: Stroke[][]) => {
    setHistory((h) => {
      const stack = [...h.stack.slice(0, h.index + 1), next].slice(-80)
      return { stack, index: stack.length - 1 }
    })
    setSaveState('dirty')
  }, [])

  const withPage = (all: Stroke[][], i: number, strokes: Stroke[]) => all.map((p, j) => (j === i ? strokes : p))

  // ── 保存（書き終えて2秒後に自動保存。画面を離れるときも保存） ──
  const doSave = useCallback(async () => {
    setSaveState('saving')
    try {
      const r = await save(JSON.stringify({ v: 1, pages: latest.current.pages }))
      if (r.ok) {
        setSaveState((s) => (s === 'saving' ? 'saved' : s))
        setSavedAt(r.savedAt ?? null)
      } else setSaveState('error')
    } catch {
      setSaveState('error')
    }
  }, [save])

  useEffect(() => {
    if (saveState !== 'dirty') return
    const t = setTimeout(doSave, 2000)
    return () => clearTimeout(t)
  }, [history, saveState, doSave])

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && latest.current.saveState === 'dirty') void doSave()
    }
    const onUnload = (e: BeforeUnloadEvent) => {
      if (latest.current.saveState !== 'saved') e.preventDefault()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [doSave])

  // ── ペン入力 ──
  function toLocal(clientX: number, clientY: number): [number, number] {
    const svg = svgRef.current
    const m = svg?.getScreenCTM()
    if (!svg || !m) return [0, 0]
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const p = pt.matrixTransform(m.inverse())
    return [Math.min(PAGE_W, Math.max(0, p.x)), Math.min(PAGE_H, Math.max(0, p.y))]
  }

  function drawLive() {
    frame.current = null
    const cur = current.current
    const el = liveRef.current
    if (!el) return
    if (!cur) {
      el.setAttribute('d', '')
      return
    }
    el.setAttribute('d', strokePath(cur.stroke, false))
    el.setAttribute('fill', INKS[cur.stroke.c].color)
    el.setAttribute('fill-opacity', String(INKS[cur.stroke.c].opacity))
  }
  const scheduleLive = () => {
    if (frame.current == null) frame.current = requestAnimationFrame(drawLive)
  }

  function eraseAt(x: number, y: number) {
    const e = erasing.current
    if (!e) return
    const next = e.working.filter((st) => !hits(st, x, y, 18 + st.s / 2))
    if (next.length !== e.working.length) {
      e.working = next
      setEraserPreview(next)
    }
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.pointerType === 'pen' && !penDetected) {
      setPenDetected(true)
      setFingerDraws(false) // ペンを使い始めたら、手のひら・指では書かない
    }
    if (e.pointerType === 'touch' && !fingerDraws) {
      // ペンで書いているときの指は、スクロールに使う
      if (fit === 'width' && mainRef.current && !panning.current) {
        panning.current = { id: e.pointerId, startY: e.clientY, startScroll: mainRef.current.scrollTop }
        svgRef.current?.setPointerCapture(e.pointerId)
      }
      return
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (current.current || erasing.current) return
    e.preventDefault()
    svgRef.current?.setPointerCapture(e.pointerId)
    const [x, y] = toLocal(e.clientX, e.clientY)
    if (tool === 'eraser') {
      erasing.current = { id: e.pointerId, working: pages[page] }
      eraseAt(x, y)
      return
    }
    const isPen = e.pointerType === 'pen'
    const size = ink === 'marker' ? MARKER_SIZE : PEN_SIZES.find((s) => s.key === sizeKey)!.size
    current.current = { id: e.pointerId, stroke: { c: ink, s: size, p: [r1(x), r1(y), r2(isPen ? e.pressure || 0.5 : 0.5)], ...(isPen ? { pen: true } : {}) } }
    scheduleLive()
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (panning.current && e.pointerId === panning.current.id) {
      if (mainRef.current) mainRef.current.scrollTop = panning.current.startScroll - (e.clientY - panning.current.startY)
      return
    }
    if (erasing.current && e.pointerId === erasing.current.id) {
      const [x, y] = toLocal(e.clientX, e.clientY)
      eraseAt(x, y)
      return
    }
    const cur = current.current
    if (!cur || e.pointerId !== cur.id) return
    const native = e.nativeEvent
    const events = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : []
    for (const ev of events.length ? events : [native]) {
      const [x, y] = toLocal(ev.clientX, ev.clientY)
      const p = cur.stroke.p
      if (Math.hypot(x - p[p.length - 3], y - p[p.length - 2]) < 0.8) continue
      p.push(r1(x), r1(y), r2(cur.stroke.pen ? ev.pressure || 0.5 : 0.5))
    }
    scheduleLive()
  }

  function onPointerEnd(e: React.PointerEvent<SVGSVGElement>) {
    if (panning.current && e.pointerId === panning.current.id) {
      panning.current = null
      return
    }
    if (erasing.current && e.pointerId === erasing.current.id) {
      const { working } = erasing.current
      erasing.current = null
      setEraserPreview(null)
      if (working !== pages[page]) commit(withPage(pages, page, working))
      return
    }
    const cur = current.current
    if (!cur || e.pointerId !== cur.id) return
    current.current = null
    drawLive()
    commit(withPage(pages, page, [...pages[page], cur.stroke]))
  }

  // ── ツールバーの操作 ──
  const canUndo = history.index > 0
  const canRedo = history.index < history.stack.length - 1
  const undo = () => {
    if (!canUndo) return
    setHistory((h) => ({ ...h, index: h.index - 1 }))
    setSaveState('dirty')
  }
  const redo = () => {
    if (!canRedo) return
    setHistory((h) => ({ ...h, index: h.index + 1 }))
    setSaveState('dirty')
  }
  const addPage = () => {
    if (pages.length >= MAX_PAGES) return
    commit([...pages, []])
    setPageIndex(pages.length)
  }
  const clearPage = () => {
    if (!pages[page].length || !confirm(`${page + 1}ページ目を全部消しますか？（元に戻すで戻せます）`)) return
    commit(withPage(pages, page, []))
  }
  async function goBack() {
    if (latest.current.saveState !== 'saved') await doSave()
    router.push(backHref)
    router.refresh()
  }

  const visible = eraserPreview ?? pages[page]
  const toolBtn = 'inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-bold text-ink-2 hover:bg-brand-soft disabled:opacity-35'
  const on = 'bg-dark text-white hover:bg-dark'

  return (
    <div className="flex h-dvh flex-col bg-page pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="border-b border-line bg-white px-3 py-2 sm:px-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={goBack} className={cn(toolBtn, 'pr-4')}>
            <ChevronLeft className="size-5" aria-hidden />
            戻る
          </button>
          <p className="min-w-0 flex-1 truncate text-sm font-black sm:text-base">{title}</p>
          <SaveBadge state={saveState} savedAt={savedAt} onRetry={doSave} />
        </div>
        {info}
        <div className="mt-2 flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="ペンの設定">
          {(Object.keys(INKS) as Ink[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setInk(k)
                setTool('pen')
              }}
              className={cn(toolBtn, tool === 'pen' && ink === k && 'ring-2 ring-dark ring-offset-1')}
              aria-pressed={tool === 'pen' && ink === k}
              aria-label={k === 'marker' ? 'マーカー' : `${INKS[k].label}のペン`}
            >
              <span className="inline-block size-5 rounded-full border border-black/10" style={{ background: INKS[k].color, opacity: k === 'marker' ? 0.8 : 1 }} aria-hidden />
              <span className="hidden sm:inline">{INKS[k].label}</span>
            </button>
          ))}
          <span className="mx-1 h-7 w-px bg-line" aria-hidden />
          {PEN_SIZES.map((s) => (
            <button key={s.key} type="button" onClick={() => setSizeKey(s.key)} disabled={ink === 'marker' && tool === 'pen'} className={cn(toolBtn, sizeKey === s.key && on)} aria-pressed={sizeKey === s.key} aria-label={`太さ：${s.label}`}>
              <span className="inline-block rounded-full bg-current" style={{ width: s.size + 2, height: s.size + 2 }} aria-hidden />
              {s.label}
            </button>
          ))}
          <span className="mx-1 h-7 w-px bg-line" aria-hidden />
          <button type="button" onClick={() => setTool('pen')} className={cn(toolBtn, tool === 'pen' && on)} aria-pressed={tool === 'pen'}>
            <PenLine className="size-4.5" aria-hidden />
            ペン
          </button>
          <button type="button" onClick={() => setTool('eraser')} className={cn(toolBtn, tool === 'eraser' && on)} aria-pressed={tool === 'eraser'}>
            <Eraser className="size-4.5" aria-hidden />
            消しゴム
          </button>
          <button type="button" onClick={undo} disabled={!canUndo} className={toolBtn} aria-label="元に戻す">
            <Undo2 className="size-5" aria-hidden />
          </button>
          <button type="button" onClick={redo} disabled={!canRedo} className={toolBtn} aria-label="やり直す">
            <Redo2 className="size-5" aria-hidden />
          </button>
          <span className="mx-1 h-7 w-px bg-line" aria-hidden />
          <button type="button" onClick={() => setFingerDraws((v) => !v)} className={cn(toolBtn, fingerDraws && on)} aria-pressed={fingerDraws}>
            <Hand className="size-4.5" aria-hidden />
            {fingerDraws ? '指でも書く' : 'ペンだけで書く'}
          </button>
          <button type="button" onClick={() => setFitChoice(fit === 'page' ? 'width' : 'page')} className={toolBtn}>
            {fit === 'page' ? <ZoomIn className="size-4.5" aria-hidden /> : <Maximize2 className="size-4.5" aria-hidden />}
            {fit === 'page' ? '大きく表示' : 'ページ全体'}
          </button>
          {previous && (
            <button type="button" onClick={() => setShowPrev(true)} className={toolBtn}>
              <History className="size-4.5" aria-hidden />
              前回のメモ
            </button>
          )}
          {toolbarExtra}
        </div>
      </header>

      <main ref={mainRef} className={cn('relative min-h-0 flex-1 p-2 sm:p-3', fit === 'width' && 'overflow-y-auto overscroll-contain')}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}
          preserveAspectRatio="xMidYMid meet"
          className={cn(
            'block touch-none select-none',
            fit === 'page' ? 'h-full w-full' : 'mx-auto h-auto w-full max-w-[1100px]',
            tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair',
          )}
          style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onContextMenu={(e) => e.preventDefault()}
          role="img"
          aria-label={`手書きメモ ${page + 1}ページ目`}
        >
          <rect width={PAGE_W} height={PAGE_H} rx={18} fill="#fffdf6" stroke="#ebe5d3" strokeWidth={2} />
          {RULE_LINES.map((y) => (
            <line key={y} x1={40} x2={PAGE_W - 40} y1={y} y2={y} stroke="#efe6c9" strokeWidth={2} />
          ))}
          {visible.map((st, i) => (
            <path key={i} d={pathOf(st)} fill={INKS[st.c].color} fillOpacity={INKS[st.c].opacity} />
          ))}
          <path ref={liveRef} d="" />
        </svg>
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-2 border-t border-line bg-white px-3 py-2">
        <button type="button" onClick={() => setPageIndex(Math.max(0, page - 1))} disabled={page === 0} className={toolBtn} aria-label="前のページ">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <span className="num min-w-16 text-center text-sm font-semibold">
          {page + 1} / {pages.length}
        </span>
        <button type="button" onClick={() => setPageIndex(Math.min(pages.length - 1, page + 1))} disabled={page >= pages.length - 1} className={toolBtn} aria-label="次のページ">
          <ChevronRight className="size-5" aria-hidden />
        </button>
        <button type="button" onClick={addPage} disabled={pages.length >= MAX_PAGES} className={toolBtn}>
          <FilePlus2 className="size-4.5" aria-hidden />
          ページを追加
        </button>
        <button type="button" onClick={clearPage} disabled={!pages[page].length} className={cn(toolBtn, 'text-danger hover:bg-danger-soft')}>
          <Trash2 className="size-4.5" aria-hidden />
          このページを全部消す
        </button>
      </footer>

      {showPrev && previous && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setShowPrev(false)}>
          <aside className="h-full w-[min(30rem,92vw)] overflow-y-auto bg-page p-4 shadow-2xl" onClick={(e) => e.stopPropagation()} aria-label="前回の手書きメモ">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-black">{previous.label}</p>
              <button type="button" onClick={() => setShowPrev(false)} className={toolBtn} aria-label="閉じる">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <DrawingView data={previous.data} columns={1} />
          </aside>
        </div>
      )}
    </div>
  )
}

function SaveBadge({ state, savedAt, onRetry }: { state: SaveState; savedAt: string | null; onRetry: () => void }) {
  if (state === 'saving' || state === 'dirty')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-soft px-3 py-1.5 text-xs font-bold text-ink-3">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        {state === 'saving' ? '保存中' : '書き込み中'}
      </span>
    )
  if (state === 'error')
    return (
      <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-3 py-1.5 text-xs font-bold text-danger">
        <CloudOff className="size-3.5" aria-hidden />
        保存できませんでした（もう一度）
      </button>
    )
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-3 py-1.5 text-xs font-bold text-ok" role="status">
      <Check className="size-3.5" aria-hidden />
      {savedAt ? `保存済み ${savedAt}` : '保存済み'}
    </span>
  )
}
