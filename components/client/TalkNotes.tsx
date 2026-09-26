'use client'

import { useMemo, useState } from 'react'
import { Loader2, MessageSquareText, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Sheet } from '@/components/Sheet'
import { TALK_KIND_STYLE, TalkKindBadge } from '@/components/client/TalkKindBadge'
import { Badge, buttonClass, inputClass } from '@/components/ui'
import { mdw, type Ymd } from '@/lib/dates'
import { TALK_KINDS, talkKindOf, type TalkKind } from '@/lib/labels'
import type { TalkInput, TalkNoteRow, TalkResult } from '@/lib/data/talk'
import { cn } from '@/lib/utils'

export type TalkNotesProps = {
  initial: TalkNoteRow[]
  /** 追加するメモの日付の初期値（基準日＝来店日） */
  defaultDate: Ymd
  today: Ymd
  add: (input: TalkInput) => Promise<TalkResult>
  update: (id: string, input: TalkInput) => Promise<TalkResult>
  remove: (id: string) => Promise<{ ok: boolean; message?: string }>
  onCountChange?: (count: number) => void
}

/** 新しい日付が上。同じ日付の中は後から書いたものが上（並べ替えても順番が崩れないよう、先頭に足してから並べる） */
const byDateDesc = (list: TalkNoteRow[]) => [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

function highlight(text: string, q: string): React.ReactNode {
  if (!q) return text
  const lower = text.toLowerCase()
  const out: React.ReactNode[] = []
  let from = 0
  for (let at = lower.indexOf(q); at >= 0; at = lower.indexOf(q, from)) {
    if (at > from) out.push(text.slice(from, at))
    out.push(
      <mark key={at} className="rounded bg-brand-soft px-0.5 text-ink">
        {text.slice(at, at + q.length)}
      </mark>,
    )
    from = at + q.length
  }
  out.push(text.slice(from))
  return out
}

function KindChips({ value, onChange, size = 'md' }: { value: TalkKind; onChange: (k: TalkKind) => void; size?: 'md' | 'sm' }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="メモの種類">
      {TALK_KINDS.map((k) => {
        const st = TALK_KIND_STYLE[k.key]
        const on = value === k.key
        return (
          <button
            key={k.key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(k.key)}
            title={k.hint}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border font-bold',
              size === 'md' ? 'h-10 px-3.5 text-sm' : 'h-9 px-3 text-xs',
              on ? cn(st.chipOn, 'border-transparent') : 'border-line-2 bg-white text-ink-2 hover:bg-soft',
            )}
          >
            <st.icon className="size-4" aria-hidden />
            {k.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * 会話メモ（会話で出た変化・良かったこと・ネガティブな言動・身体の変化などを日付つきで残す）。
 * 追加・変更・削除はその場で一覧に反映する。種類で絞り込み、キーワードで探せる。
 */
export function TalkNotes({ initial, defaultDate, today, add, update, remove, onCountChange }: TalkNotesProps) {
  const [notes, setNotes] = useState(() => byDateDesc(initial))
  const [kind, setKind] = useState<TalkKind>('talk')
  const [date, setDate] = useState<Ymd>(defaultDate)
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | TalkKind>('all')
  const [query, setQuery] = useState('')
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string; kind: TalkKind; date: Ymd; text: string; pending: boolean; error: string | null } | null>(null)

  const apply = (next: TalkNoteRow[]) => {
    setNotes(next)
    onCountChange?.(next.length)
  }

  async function submit() {
    if (!text.trim() || pending) return
    setPending(true)
    setError(null)
    const res = await add({ date, kind, text })
    setPending(false)
    if (!res.ok) return setError(res.message)
    apply(byDateDesc([res.note, ...notes]))
    setText('')
    setJustAdded(res.note.id)
    if (filter !== 'all' && filter !== res.note.kind) setFilter('all')
  }

  async function saveEdit() {
    if (!editing || editing.pending) return
    setEditing({ ...editing, pending: true, error: null })
    const res = await update(editing.id, { date: editing.date, kind: editing.kind, text: editing.text })
    if (!res.ok) return setEditing({ ...editing, pending: false, error: res.message })
    apply(byDateDesc(notes.map((n) => (n.id === res.note.id ? res.note : n))))
    setEditing(null)
  }

  async function del(n: TalkNoteRow) {
    if (!confirm(`${mdw(n.date)}の「${n.text.slice(0, 20)}${n.text.length > 20 ? '…' : ''}」を削除しますか？`)) return
    const res = await remove(n.id)
    if (!res.ok) return alert(res.message ?? '削除できませんでした')
    apply(notes.filter((x) => x.id !== n.id))
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const n of notes) c[n.kind] = (c[n.kind] ?? 0) + 1
    return c
  }, [notes])
  const q = query.trim().toLowerCase()
  const groups = useMemo(() => {
    const out: Array<{ date: Ymd; items: TalkNoteRow[] }> = []
    for (const n of notes) {
      if (filter !== 'all' && n.kind !== filter) continue
      if (q && !n.text.toLowerCase().includes(q)) continue
      const last = out[out.length - 1]
      if (last && last.date === n.date) last.items.push(n)
      else out.push({ date: n.date, items: [n] })
    }
    return out
  }, [notes, filter, q])

  const filterBtn = (on: boolean) => cn('inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-bold', on ? 'bg-dark text-white' : 'bg-white text-ink-2 ring-1 ring-line hover:bg-soft')

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="rounded-2xl border border-line bg-white p-3 shadow-[0_4px_18px_rgba(80,60,0,0.05)] sm:p-4"
      >
        <KindChips value={kind} onChange={setKind} />
        <p className="mt-1.5 text-xs text-ink-3">{talkKindOf(kind).hint}</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              void submit()
            }
          }}
          rows={2}
          maxLength={1000}
          placeholder={talkKindOf(kind).example}
          aria-label="会話の内容"
          className={cn(inputClass, 'mt-2 min-h-20 resize-y leading-relaxed')}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-sm font-bold text-ink-2">
            日付
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-10 rounded-xl border border-line-2 bg-white px-3 text-base text-ink outline-none focus:border-brand-deep focus:ring-2 focus:ring-brand-soft" />
          </label>
          {date === today && <Badge tone="brand">今日</Badge>}
          <span className="flex-1" />
          {error && (
            <p role="alert" className="text-sm font-bold text-danger">
              {error}
            </p>
          )}
          <button type="submit" disabled={pending || !text.trim()} className={buttonClass.primary}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            追加
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="種類で絞り込む">
          <button type="button" className={filterBtn(filter === 'all')} onClick={() => setFilter('all')} aria-pressed={filter === 'all'}>
            すべて <span className="num text-xs opacity-80">{notes.length}</span>
          </button>
          {TALK_KINDS.map((k) => (
            <button key={k.key} type="button" className={filterBtn(filter === k.key)} onClick={() => setFilter(filter === k.key ? 'all' : k.key)} aria-pressed={filter === k.key} disabled={!counts[k.key] && filter !== k.key}>
              {k.label} <span className="num text-xs opacity-80">{counts[k.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <label className="relative ml-auto w-full sm:w-60">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="キーワードで探す" aria-label="会話メモをキーワードで探す" className={cn(inputClass, 'h-10 min-h-10 pl-9')} />
        </label>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-2 bg-white/60 px-4 py-8 text-center text-sm text-ink-2">
          {notes.length === 0 ? '会話で出た「変化を感じたこと」「良かったこと」「ネガティブな言動」「身体の変化」などを、日付と一緒に残せます' : '当てはまるメモはありません'}
        </p>
      ) : (
        <ol className="space-y-4">
          {groups.map((g) => (
            <li key={g.date}>
              <h3 className="mb-1.5 flex items-center gap-2 text-sm font-black">
                <span className="num">{mdw(g.date)}</span>
                {g.date === today && <Badge tone="brand">今日</Badge>}
                <span className="text-xs font-bold text-ink-3">{g.items.length}件</span>
              </h3>
              <ul className="space-y-2">
                {g.items.map((n) =>
                  editing?.id === n.id ? (
                    <li key={n.id} className="rounded-xl border border-brand-deep bg-white p-3">
                      <KindChips value={editing.kind} onChange={(k) => setEditing({ ...editing, kind: k })} size="sm" />
                      <textarea value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} rows={3} maxLength={1000} aria-label="会話の内容" className={cn(inputClass, 'mt-2 leading-relaxed')} />
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input type="date" value={editing.date} onChange={(e) => e.target.value && setEditing({ ...editing, date: e.target.value })} aria-label="日付" className="h-10 rounded-xl border border-line-2 bg-white px-3 text-base outline-none focus:border-brand-deep" />
                        <span className="flex-1" />
                        {editing.error && <p className="text-sm font-bold text-danger">{editing.error}</p>}
                        <button type="button" onClick={() => setEditing(null)} className={buttonClass.secondary}>
                          やめる
                        </button>
                        <button type="button" onClick={() => void saveEdit()} disabled={editing.pending || !editing.text.trim()} className={buttonClass.primary}>
                          {editing.pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                          保存
                        </button>
                      </div>
                    </li>
                  ) : (
                    <li key={n.id} className={cn('rounded-xl border border-line bg-white py-2 pl-3 pr-1.5', justAdded === n.id && 'ring-2 ring-brand')}>
                      <div className="flex items-start gap-2">
                        <TalkKindBadge kind={n.kind} className="mt-1 flex-none" />
                        <p className="min-w-0 flex-1 whitespace-pre-wrap break-words py-0.5 text-[15px] leading-relaxed">{highlight(n.text, q)}</p>
                        <div className="flex flex-none">
                          <button type="button" onClick={() => setEditing({ id: n.id, kind: n.kind, date: n.date, text: n.text, pending: false, error: null })} className={cn(buttonClass.ghost, 'h-10 min-w-10 px-2')} aria-label="編集">
                            <Pencil className="size-4" aria-hidden />
                          </button>
                          <button type="button" onClick={() => void del(n)} className={cn(buttonClass.danger, 'h-10 min-w-10 px-2')} aria-label="削除">
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </div>
                      </div>
                      {n.authorName && <p className="mt-0.5 text-xs text-ink-3">記録 {n.authorName}</p>}
                    </li>
                  ),
                )}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** 会話メモを右から出すボタン（トレーニング中の画面・手書きメモの画面から、その場で書いて見返せる） */
export function TalkSheetButton({ title, className, ...props }: TalkNotesProps & { title: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(props.initial.length)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <MessageSquareText className="size-4 flex-none" aria-hidden />
        会話メモ
        {count > 0 && <span className="num rounded-full bg-dark/10 px-1.5 text-xs">{count}</span>}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <TalkNotes {...props} onCountChange={setCount} />
      </Sheet>
    </>
  )
}
