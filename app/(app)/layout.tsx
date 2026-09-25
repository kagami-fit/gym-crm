import { AppNav } from '@/components/AppNav'
import { requireUser } from '@/lib/session'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  return (
    <div className="xl:flex">
      <AppNav userName={user.name} role={user.role ?? 'staff'} />
      <main className="min-w-0 flex-1 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 sm:px-6 xl:px-8 xl:py-8">
        <div className="mx-auto max-w-[1280px]">{children}</div>
      </main>
    </div>
  )
}
