'use server'

import { revalidatePath } from 'next/cache'
import { hashPassword } from 'better-auth/crypto'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/session'
import type { ActionState } from '@/components/SubmitButton'

const done = (message: string, ok = true): ActionState => ({ ok, message, at: Date.now() })

/** スタッフのアカウントを作る（一般公開の新規登録はしないため、オーナーがここで作成する） */
export async function createStaffAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireOwner()
  const name = String(fd.get('name') ?? '').trim().slice(0, 40)
  const email = String(fd.get('email') ?? '').trim().toLowerCase()
  const password = String(fd.get('password') ?? '')
  const role = fd.get('role') === 'owner' ? 'owner' : 'staff'
  if (!name) return done('名前を入れてください', false)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return done('メールアドレスの形式が正しくありません', false)
  if (password.length < 10) return done('パスワードは10文字以上にしてください', false)
  if (await prisma.user.findUnique({ where: { email } })) return done('このメールアドレスはすでに登録されています', false)
  const id = crypto.randomUUID()
  await prisma.user.create({
    data: { id, email, name, role, emailVerified: true, accounts: { create: { id: crypto.randomUUID(), accountId: id, providerId: 'credential', password: await hashPassword(password) } } },
  })
  revalidatePath('/settings/staff')
  return done(`${name} さんのアカウントを作成しました。メールアドレスとパスワードを本人に伝えてください`)
}

export async function updateStaffAction(userId: string, fd: FormData) {
  const me = await requireOwner()
  const role = fd.get('role') === 'owner' ? 'owner' : 'staff'
  const password = String(fd.get('password') ?? '')
  // 自分をスタッフに下げると誰もオーナーでなくなる恐れがあるため、自分の権限は変えない
  if (userId !== me.id) await prisma.user.update({ where: { id: userId }, data: { role } })
  if (password.length >= 10) {
    await prisma.account.updateMany({ where: { userId, providerId: 'credential' }, data: { password: await hashPassword(password) } })
    await prisma.session.deleteMany({ where: { userId } })
  }
  revalidatePath('/settings/staff')
}

export async function deleteStaffAction(userId: string) {
  const me = await requireOwner()
  if (userId === me.id) return
  await prisma.user.delete({ where: { id: userId } })
  revalidatePath('/settings/staff')
}
