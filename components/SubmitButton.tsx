'use client'

import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { buttonClass } from '@/components/ui'
import { cn } from '@/lib/utils'

export function SubmitButton({ children, variant = 'primary', className, pendingText }: { children: React.ReactNode; variant?: keyof typeof buttonClass; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={cn(buttonClass[variant], className)}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending && pendingText ? pendingText : children}
    </button>
  )
}

export type ActionState = { ok: boolean; message: string; at?: number } | null

export function FormMessage({ state }: { state: ActionState }) {
  if (!state?.message) return null
  return (
    <p role={state.ok ? 'status' : 'alert'} className={cn('rounded-lg px-3 py-2 text-sm font-bold', state.ok ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger')}>
      {state.message}
    </p>
  )
}
