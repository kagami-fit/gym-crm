'use client'

import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { createReminderAction } from '@/app/(app)/alerts/actions'
import { buttonClass, inputClass } from '@/components/ui'
import { addDays, todayYmd } from '@/lib/dates'
import { LEVELS, type Level } from '@/lib/alerts/rules'
import { cn } from '@/lib/utils'
import { LEVEL_STYLE } from './Level'

/**
 * 自分で作るお知らせ。お客様・内容・いつ知らせるか（日付／次の来店時）・段階を選ぶ。
 * clients を渡すとお客様を選べる（お知らせの一覧）。clientId を渡すとそのお客様に固定（顧客ページ）。
 */
export function ReminderForm({ clients, clientId, onDone }: { clients?: Array<{ id: string; name: string }>; clientId?: string; onDone?: () => void }) {
  const [client, setClient] = useState(clientId ?? '')
  const [text, setText] = useState('')
  const [trigger, setTrigger] = useState<'next_visit' | 'date'>('next_visit')
  const [date, setDate] = useState(addDays(todayYmd(), 7))
  const [level, setLevel] = useState<Level>('info')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    setPending(true)
    setMessage(null)
    const r = await createReminderAction({ clientId: client, text, trigger, dueDate: trigger === 'date' ? date : undefined, level })
    setPending(false)
    if (!r.ok) return setMessage({ ok: false, text: r.message })
    setText('')
    setMessage({ ok: true, text: 'お知らせを作りました' })
    onDone?.()
  }

  const choice = (on: boolean) => cn('inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold', on ? 'bg-dark text-white' : 'bg-white text-ink-2 ring-1 ring-line-2 hover:bg-soft')

  return (
    <form onSubmit={submit} className="space-y-3">
      {clients && (
        <label className="block text-sm font-bold">
          お客様
          <select value={client} onChange={(e) => setClient(e.target.value)} className={cn(inputClass, 'mt-1.5')} required>
            <option value="">選んでください</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block text-sm font-bold">
        内容
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={300} required placeholder="例：体組成を測る／目標と減量ペースを見直す" className={cn(inputClass, 'mt-1.5 leading-relaxed')} />
      </label>
      <div className="space-y-2">
        <p className="text-sm font-bold">いつ知らせる</p>
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="いつ知らせる">
          <button type="button" role="radio" aria-checked={trigger === 'next_visit'} onClick={() => setTrigger('next_visit')} className={choice(trigger === 'next_visit')}>
            次の来店時
          </button>
          <button type="button" role="radio" aria-checked={trigger === 'date'} onClick={() => setTrigger('date')} className={choice(trigger === 'date')}>
            日付を決める
          </button>
          {trigger === 'date' && (
            <input type="date" value={date} min={todayYmd()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="知らせる日" className="h-10 rounded-xl border border-line-2 bg-white px-3 text-base outline-none focus:border-brand-deep" />
          )}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-bold">段階</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="段階">
          {(Object.keys(LEVELS) as Level[]).map((l) => {
            const { icon: Icon, label, chip } = LEVEL_STYLE[l]
            return (
              <button key={l} type="button" role="radio" aria-checked={level === l} onClick={() => setLevel(l)} className={cn('inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold', level === l ? chip : 'bg-white text-ink-2 ring-1 ring-line-2 hover:bg-soft')}>
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || !text.trim() || !client} className={buttonClass.primary}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          お知らせを作る
        </button>
        {message && (
          <p role="status" className={cn('text-sm font-bold', message.ok ? 'text-ok' : 'text-danger')}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  )
}
