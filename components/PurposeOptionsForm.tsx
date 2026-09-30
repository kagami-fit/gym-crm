'use client'

import { useActionState, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { FormMessage, SubmitButton, type ActionState } from '@/components/SubmitButton'
import { buttonClass, inputClass } from '@/components/ui'
import { MAX_PURPOSE_LENGTH, MAX_PURPOSES, type PurposeEdit } from '@/lib/purposes'
import { cn } from '@/lib/utils'

type Item = PurposeEdit & { key: string }
let seq = 0
const newKey = () => `p${Date.now().toString(36)}${(seq++).toString(36)}`
const toItems = (options: string[]): Item[] => options.map((o) => ({ key: newKey(), label: o, from: o }))

/**
 * 種目の目的の選択肢（オーナーが編集）。名前を変えると、これまでの記録と種目マスタの目的も新しい名前になる。
 * 消しても、これまでの記録の目的は残る（種目マスタの「いつもの目的」だけ外れる）。
 */
export function PurposeOptionsForm({ action, options, usage }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; options: string[]; usage: Record<string, number> }) {
  const [state, formAction] = useActionState(action, null)
  const [items, setItems] = useState<Item[]>(() => toItems(options))
  // 保存したあと（サーバーから新しい選択肢が届いたら）入力欄を作り直す。「もとの名前」も新しい名前になる
  const [loaded, setLoaded] = useState(options.join('\n'))
  if (loaded !== options.join('\n')) {
    setLoaded(options.join('\n'))
    setItems(toItems(options))
  }

  const update = (key: string, label: string) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, label } : x)))
  const remove = (key: string) => setItems((xs) => xs.filter((x) => x.key !== key))
  const move = (key: string, d: -1 | 1) =>
    setItems((xs) => {
      const i = xs.findIndex((x) => x.key === key)
      const j = i + d
      if (i < 0 || j < 0 || j >= xs.length) return xs
      const next = [...xs]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  const add = () => setItems((xs) => [...xs, { key: newKey(), label: '', from: null }])

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="payload" value={JSON.stringify(items.map(({ label, from }) => ({ label, from })))} />
      <ul className="grid gap-x-6 gap-y-2 lg:grid-cols-2">
        {items.map((it, i) => {
          const used = it.from ? (usage[it.from] ?? 0) : 0
          return (
            <li key={it.key} className="flex items-center gap-1">
              <span className="num w-6 flex-none text-right text-sm text-ink-3">{i + 1}</span>
              <input value={it.label} onChange={(e) => update(it.key, e.target.value)} maxLength={MAX_PURPOSE_LENGTH} placeholder="目的の名前" className={cn(inputClass, 'min-w-0 flex-1 py-1.5')} aria-label={`${i + 1}番目の目的`} />
              <span className="num w-14 flex-none text-right text-xs text-ink-3" title="この目的を選んでいる記録の数">
                {used > 0 ? `記録${used}` : ''}
              </span>
              <button type="button" onClick={() => move(it.key, -1)} disabled={i === 0} className={cn(buttonClass.ghost, 'min-w-9 px-1.5')} aria-label="上へ">
                <ArrowUp className="size-4" aria-hidden />
              </button>
              <button type="button" onClick={() => move(it.key, 1)} disabled={i === items.length - 1} className={cn(buttonClass.ghost, 'min-w-9 px-1.5')} aria-label="下へ">
                <ArrowDown className="size-4" aria-hidden />
              </button>
              <button type="button" onClick={() => remove(it.key)} disabled={items.length === 1} className={cn(buttonClass.danger, 'min-w-9 px-1.5')} aria-label={`${it.label || '目的'}を削除`}>
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={add} disabled={items.length >= MAX_PURPOSES} className={buttonClass.secondary}>
          <Plus className="size-4" aria-hidden />
          選択肢を追加
        </button>
        <SubmitButton pendingText="保存しています">選択肢を保存</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  )
}
