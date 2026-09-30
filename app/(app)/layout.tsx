import { Suspense } from 'react'
import { AppNav } from '@/components/AppNav'
import { NavBell } from '@/components/alerts/NavBell'
import { NavBellCount } from '@/components/alerts/NavBellCount'
import { isDemo } from '@/lib/demo'
import { requireUser } from '@/lib/session'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  return (
    <div className="xl:flex">
      <AppNav
        userName={user.name}
        role={user.role ?? 'staff'}
        bell={
          <Suspense fallback={<NavBell count={null} level={null} />}>
            <NavBellCount userId={user.id} role={user.role ?? 'staff'} />
          </Suspense>
        }
        bellSide={
          <Suspense fallback={<NavBell count={null} level={null} variant="side" />}>
            <NavBellCount userId={user.id} role={user.role ?? 'staff'} variant="side" />
          </Suspense>
        }
      />
      <main className="min-w-0 flex-1 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 sm:px-6 xl:px-8 xl:py-8">
        <div className="mx-auto max-w-[1280px]">
          {isDemo() && (
            <p className="no-print mb-4 rounded-xl bg-brand-soft px-4 py-2.5 text-sm font-bold text-ink">
              デモ版です。架空のお客様のデータなので、本当のお客様の情報は入力しないでください。
            </p>
          )}
          {children}
        </div>
      </main>
    </div>
  )
}
