'use client'

import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'

// PDF を画像として描く（pdf.js）。ブラウザの PDF 表示に頼らないので、iPad・パソコン・アプリの中のブラウザで同じように見える

let lib: Promise<typeof import('pdfjs-dist')> | null = null
function loadLib() {
  lib ??= import('pdfjs-dist').then((m) => {
    m.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    return m
  })
  return lib
}

/** 同じ PDF は1回だけ読み込む（小さい表示と大きい表示で使い回す） */
const docs = new Map<string, Promise<PDFDocumentProxy>>()
function loadDoc(url: string) {
  let d = docs.get(url)
  if (!d) {
    d = loadLib().then((m) => m.getDocument({ url }).promise)
    d.catch(() => docs.delete(url))
    docs.set(url, d)
  }
  return d
}

/** 1ページを、枠の幅に合わせて描く */
function PdfPage({ doc, pageNo }: { doc: PDFDocumentProxy; pageNo: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let cancelled = false
    let task: RenderTask | null = null
    void (async () => {
      const page = await doc.getPage(pageNo)
      const canvas = ref.current
      if (!canvas || cancelled) return
      const width = canvas.parentElement?.clientWidth || 600
      const scale = (width / page.getViewport({ scale: 1 }).width) * Math.min(window.devicePixelRatio || 1, 2)
      const viewport = page.getViewport({ scale })
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      task = page.render({ canvas, viewport })
      await task.promise
    })().catch(() => {})
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, pageNo])
  return <canvas ref={ref} className="block h-auto w-full bg-white" />
}

/** PDF を表示する。first：1ページ目だけ（小さい表示）／all：全ページを縦に並べる（大きい表示） */
export function PdfView({ url, pages = 'first' }: { url: string; pages?: 'first' | 'all' }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    loadDoc(url)
      .then((d) => alive && setDoc(d))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [url])
  if (failed) return <p className="flex h-full items-center justify-center p-4 text-center text-sm text-ink-3">PDF を表示できませんでした。「別のタブで開く」で見てください</p>
  if (!doc) return <p className="flex h-full items-center justify-center p-4 text-sm text-ink-3">読み込んでいます…</p>
  const n = pages === 'all' ? doc.numPages : 1
  return (
    <div className="space-y-2">
      {Array.from({ length: n }, (_, i) => (
        <PdfPage key={i} doc={doc} pageNo={i + 1} />
      ))}
    </div>
  )
}
