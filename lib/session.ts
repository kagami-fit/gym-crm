import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth, type AppUser } from './auth'

export async function getUser(): Promise<AppUser | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user ?? null
}

/** ページ・サーバーアクションの先頭で呼ぶ。未ログインならログイン画面へ */
export async function requireUser(): Promise<AppUser> {
  const user = await getUser()
  if (!user) redirect('/login')
  return user
}

/** 設定の変更・スタッフ管理などオーナーだけの操作 */
export async function requireOwner(): Promise<AppUser> {
  const user = await requireUser()
  if (user.role !== 'owner') redirect('/clients?denied=1')
  return user
}
