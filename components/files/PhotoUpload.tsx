'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2 } from 'lucide-react'
import { uploadClientFileAction } from '@/app/(app)/clients/[id]/files/actions'
import { buttonClass } from '@/components/ui'
import { shrinkImage } from '@/lib/image'
import { cn } from '@/lib/utils'

/**
 * 写真（と PDF）を入れるボタン。何枚でも選べて、1枚ずつ小さくしてから保存する。
 * iPad ではその場で撮影もできる。sessionId があれば、その回のログの写真になる
 */
export function PhotoUpload({ clientId, date, sessionId, title, label = '写真を追加', accept = 'image/*', className }: { clientId: string; date: string; sessionId?: string | null; title?: string; label?: string; accept?: string; className?: string }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function upload(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    const list = [...files]
    const failed: string[] = []
    for (const [i, f] of list.entries()) {
      setProgress(list.length > 1 ? `${list.length}件中${i + 1}件目を保存しています` : '保存しています')
      const fd = new FormData()
      fd.set('file', await shrinkImage(f))
      fd.set('date', date)
      if (sessionId) fd.set('sessionId', sessionId)
      if (title) fd.set('title', title)
      const r = await uploadClientFileAction(clientId, fd)
      if (!r.ok) failed.push(r.message)
    }
    setProgress(null)
    if (failed.length) setError(failed.join('／'))
    if (input.current) input.current.value = ''
    router.refresh()
  }

  return (
    <span className={cn('inline-flex flex-wrap items-center gap-2', className)}>
      <input ref={input} type="file" accept={accept} multiple className="sr-only" onChange={(e) => void upload(e.target.files)} aria-label={label} />
      <button type="button" onClick={() => input.current?.click()} disabled={!!progress} className={buttonClass.small}>
        {progress ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Camera className="size-4" aria-hidden />}
        {progress ?? label}
      </button>
      {error && (
        <span role="alert" className="text-sm font-bold text-danger">
          {error}
        </span>
      )}
    </span>
  )
}
