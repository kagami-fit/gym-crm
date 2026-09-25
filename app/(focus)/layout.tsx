import { requireUser } from '@/lib/session'

/** 手書きメモなど、iPad の画面いっぱいに使う画面（メニューなし） */
export default async function FocusLayout({ children }: { children: React.ReactNode }) {
  await requireUser()
  return children
}
