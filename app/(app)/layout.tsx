import { AppNav } from '@/components/AppNav'
import { isDemo } from '@/lib/demo'
import { requireUser } from '@/lib/session'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  return (
    <div className="xl:flex">
      <AppNav userName={user.name} role={user.role ?? 'staff'} />
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
