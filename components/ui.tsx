import Link from 'next/link'
import { cn } from '@/lib/utils'
import { STATUSES, type ClientStatus } from '@/lib/labels'

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

/** 参考シートの「見出し帯＋中身」のブロック（帯はチャコール、英字は Resole サイトの見出しに合わせた斜体） */
export function Section({
  title,
  en,
  aside,
  children,
  className,
  bodyClassName,
  id,
}: {
  title: string
  en?: string
  aside?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  id?: string
}) {
  return (
    <section id={id} className={cn('overflow-hidden rounded-2xl border border-line bg-white shadow-[0_4px_18px_rgba(80,60,0,0.05)]', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 bg-dark px-5 py-3 text-white">
        <h2 className="flex items-baseline gap-3">
          {en && <span className="en text-lg leading-none text-brand">{en}</span>}
          <span className="text-base font-black tracking-wide">{title}</span>
        </h2>
        {aside && <div className="flex flex-wrap items-center gap-2 text-sm">{aside}</div>}
      </div>
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  )
}

export function Card({ title, description, children, className, actions }: { title?: string; description?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={cn('rounded-2xl border border-line bg-white p-5 shadow-[0_4px_18px_rgba(80,60,0,0.05)]', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-base font-black text-ink">{title}</h2>}
            {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={cn(title || description || actions ? 'mt-4' : '')}>{children}</div>
    </section>
  )
}

export function Badge({ children, tone = 'neutral', className }: { children: React.ReactNode; tone?: 'neutral' | 'dark' | 'brand' | 'ok' | 'warn' | 'danger' | 'muted'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold',
        tone === 'neutral' && 'bg-soft text-ink-2 ring-1 ring-line',
        tone === 'dark' && 'bg-dark text-white',
        tone === 'brand' && 'bg-brand-soft text-brand-ink ring-1 ring-brand-deep/50',
        tone === 'ok' && 'bg-ok-soft text-ok',
        tone === 'warn' && 'bg-warn-soft text-warn',
        tone === 'danger' && 'bg-danger-soft text-danger',
        tone === 'muted' && 'bg-soft text-ink-3',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const s = (status in STATUSES ? status : 'active') as ClientStatus
  const tone = s === 'active' ? 'ok' : s === 'trial' ? 'brand' : s === 'paused' ? 'warn' : 'muted'
  return <Badge tone={tone}>{STATUSES[s]}</Badge>
}

export const buttonClass = {
  /** Resole サイトの「体験のお申し込み」と同じ黄色のボタン（iPad で押しやすい高さ44px） */
  primary:
    'inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-brand px-5 text-sm font-black text-ink shadow-[0_4px_12px_rgba(251,175,0,0.28)] hover:bg-brand-deep active:brightness-95 disabled:opacity-40 disabled:shadow-none',
  dark: 'inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-dark px-5 text-sm font-bold text-white hover:bg-dark-2 disabled:opacity-40',
  secondary:
    'inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-line-2 bg-white px-5 text-sm font-bold text-ink-2 hover:bg-soft active:bg-brand-soft disabled:opacity-40',
  ghost: 'inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-bold text-ink-2 hover:bg-brand-soft active:bg-brand-soft disabled:opacity-35',
  danger: 'inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-bold text-danger hover:bg-danger-soft active:bg-danger-soft disabled:opacity-35',
  small:
    'inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-line-2 bg-white px-3.5 text-sm font-bold text-ink-2 hover:bg-soft active:bg-brand-soft disabled:opacity-40',
}

export const inputClass =
  'min-h-11 w-full rounded-xl border border-line-2 bg-white px-3 py-2 text-base text-ink outline-none placeholder:text-ink-3 focus:border-brand-deep focus:ring-2 focus:ring-brand-soft disabled:bg-soft'

export const numInputClass = `${inputClass} num text-right tnum`

export function Field({ label, hint, children, required, className }: { label: string; hint?: string; children: React.ReactNode; required?: boolean; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="text-sm font-bold text-ink">
        {label}
        {required && <span className="ml-1 text-xs text-danger">必須</span>}
      </span>
      {hint && <span className="mt-0.5 block text-xs text-ink-3">{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
    </label>
  )
}

export function Notice({ tone = 'info', children, className }: { tone?: 'info' | 'warn' | 'danger' | 'ok'; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-xl px-4 py-3 text-sm',
        tone === 'info' && 'bg-tint text-dark',
        tone === 'warn' && 'bg-warn-soft text-warn',
        tone === 'danger' && 'bg-danger-soft text-danger',
        tone === 'ok' && 'bg-ok-soft text-ok',
        className,
      )}
      role={tone === 'danger' || tone === 'warn' ? 'alert' : undefined}
    >
      {children}
    </div>
  )
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: { href: string; label: string } }) {
  return (
    <div className="rounded-xl border border-dashed border-line-2 bg-soft px-5 py-8 text-center">
      <p className="font-bold text-ink-2">{title}</p>
      {children && <div className="mt-1 text-sm text-ink-3">{children}</div>}
      {action && (
        <Link href={action.href} className={`${buttonClass.secondary} mt-4`}>
          {action.label}
        </Link>
      )}
    </div>
  )
}

/** 数値＋単位（数値は Outfit） */
export function Value({ value, unit, className, unitClassName }: { value: string; unit?: string; className?: string; unitClassName?: string }) {
  return (
    <span className={cn('whitespace-nowrap', className)}>
      <span className="num font-semibold">{value}</span>
      {unit && value !== '—' && <span className={cn('ml-0.5 text-[0.7em] font-bold text-ink-3', unitClassName)}>{unit}</span>}
    </span>
  )
}
