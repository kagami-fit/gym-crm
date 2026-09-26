'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { buttonClass } from '@/components/ui'
import { cn } from '@/lib/utils'

/**
 * 画面の右から出るパネル（side）と全画面の表示（full）。<dialog> を使うので、Esc・外側のタップで閉じ、後ろの画面は触れない。
 * 閉じても中身は消さない（入力途中の内容や一覧がそのまま残る）。
 */
export function Sheet({
  open,
  onClose,
  title,
  headerExtra,
  variant = 'side',
  children,
  bodyClassName,
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  headerExtra?: React.ReactNode
  variant?: 'side' | 'full'
  children: React.ReactNode
  bodyClassName?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  // 開いている間は後ろの画面をスクロールさせない（iPad の Safari 対策）
  useEffect(() => {
    if (!open) return
    const html = document.documentElement
    const prev = html.style.overflow
    html.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prev
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      aria-label={typeof title === 'string' ? title : undefined}
      className={cn(
        'm-0 max-h-none max-w-none border-0 bg-transparent p-0 text-ink backdrop:bg-black/35',
        variant === 'side' ? 'ml-auto h-dvh w-[min(36rem,100vw)]' : 'h-dvh w-screen',
      )}
    >
      <div className="flex h-full flex-col bg-page shadow-2xl">
        <header className="flex flex-wrap items-center gap-2 border-b border-line bg-white px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4">
          <div className="min-w-0 flex-1 truncate text-base font-black">{title}</div>
          {headerExtra}
          <button type="button" onClick={onClose} className={buttonClass.ghost} aria-label="閉じる">
            <X className="size-5" aria-hidden />
            <span className="hidden sm:inline">閉じる</span>
          </button>
        </header>
        <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4', bodyClassName)}>{children}</div>
      </div>
    </dialog>
  )
}
