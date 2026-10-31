'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteClientFileAction, updateClientFileAction } from '@/app/(app)/clients/[id]/files/actions'
import { AnsGallery } from '@/components/plan/AnsGallery'
import { buttonClass, inputClass } from '@/components/ui'
import type { ClientFileRow } from '@/lib/data/files'
import { md, ymdJa } from '@/lib/dates'
import { cn } from '@/lib/utils'

const fileSrc = (id: string) => `/api/files/${id}`
const toGallery = (f: ClientFileRow) => ({ id: f.id, measuredOn: f.date, fileName: f.fileName, mimeType: f.mimeType, note: f.note, title: f.title })

/** 来店ごとのログの写真（小さい正方形で並べる。押すと大きく開く） */
export function SessionPhotos({ files }: { files: ClientFileRow[] }) {
  if (!files.length) return null
  return <AnsGallery files={files.map(toGallery)} src={fileSrc} viewerTitle="写真" square gridClassName="grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-2" />
}

/**
 * お客様ごとの写真・資料の一覧。各ファイルの下で、何の写真か（タイトル）を直す・その回のログへ移る・削除ができる
 */
export function ClientFileGallery({ clientId, files, viewerTitle }: { clientId: string; files: ClientFileRow[]; viewerTitle: string }) {
  const router = useRouter()
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const list = files.filter((f) => !removed.has(f.id))
  const byId = new Map(list.map((f) => [f.id, f]))

  async function remove(f: ClientFileRow) {
    if (!confirm(`${ymdJa(f.date, false)}の「${f.title ?? f.fileName}」を削除しますか？`)) return
    setRemoved((s) => new Set(s).add(f.id))
    const r = await deleteClientFileAction(clientId, f.id)
    if (!r.ok) setRemoved((s) => new Set([...s].filter((x) => x !== f.id)))
  }
  async function rename(f: ClientFileRow, title: string) {
    if (title.trim() === (f.title ?? '')) return
    await updateClientFileAction(clientId, f.id, { title, note: f.note ?? '' })
    router.refresh()
  }

  if (!list.length) return null
  return (
    <AnsGallery
      files={list.map(toGallery)}
      src={fileSrc}
      viewerTitle={viewerTitle}
      square={viewerTitle === '写真'}
      footer={(g) => {
        const f = byId.get(g.id)!
        return (
          <div className="space-y-1">
            <input defaultValue={f.title ?? ''} onBlur={(e) => void rename(f, e.target.value)} maxLength={60} placeholder="何の写真か（例：パイクアップ B4）" className={cn(inputClass, 'h-9 min-h-9 py-1 text-sm')} aria-label={`${md(f.date)}の写真の名前`} />
            <div className="flex items-center justify-between gap-2">
              {f.sessionId ? (
                <Link href={`/clients/${clientId}/training?date=${f.date}`} className="text-xs font-bold text-brand-ink underline-offset-2 hover:underline">
                  {md(f.date)}のログ
                </Link>
              ) : (
                <span className="text-xs text-ink-3">資料</span>
              )}
              <button type="button" onClick={() => void remove(f)} className={cn(buttonClass.danger, 'h-9 min-w-9')} aria-label={`${md(f.date)}の写真を削除`}>
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        )
      }}
    />
  )
}
