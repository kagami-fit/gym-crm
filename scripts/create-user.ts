// ログイン用アカウントを作る（公開の新規登録はしないため、このスクリプトか「設定 → スタッフ」で作成する）
// 使い方: npm run user:create -- --email you@example.com --name 名前 --role owner
// パスワードは画面に表示されない入力で2回たずねる（コマンド履歴に残さないため）
import { createInterface } from 'node:readline'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from 'better-auth/crypto'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    const write = (rl as unknown as { _writeToOutput: (s: string) => void })
    const original = write._writeToOutput.bind(rl)
    write._writeToOutput = (s: string) => original(s.startsWith(question) ? s : '')
    rl.question(question, (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer)
    })
  })
}

async function main() {
  const email = arg('email')
  const name = arg('name') ?? email
  const role = arg('role') === 'owner' ? 'owner' : 'staff'
  if (!email || !name) throw new Error('--email と --name を指定してください')

  const password = await askHidden('パスワード（10文字以上）: ')
  if (password.length < 10) throw new Error('パスワードは10文字以上にしてください')
  if ((await askHidden('もう一度: ')) !== password) throw new Error('パスワードが一致しません')

  const prisma = new PrismaClient()
  try {
    const existing = await prisma.user.findUnique({ where: { email }, include: { accounts: true } })
    const hash = await hashPassword(password)
    if (existing) {
      await prisma.user.update({ where: { id: existing.id }, data: { name, role } })
      const credential = existing.accounts.find((a) => a.providerId === 'credential')
      if (credential) await prisma.account.update({ where: { id: credential.id }, data: { password: hash } })
      else await prisma.account.create({ data: { id: crypto.randomUUID(), accountId: existing.id, providerId: 'credential', userId: existing.id, password: hash } })
      console.log(`更新しました: ${email}（${role}）`)
    } else {
      const id = crypto.randomUUID()
      await prisma.user.create({
        data: { id, email, name, role, emailVerified: true, accounts: { create: { id: crypto.randomUUID(), accountId: id, providerId: 'credential', password: hash } } },
      })
      console.log(`作成しました: ${email}（${role}）`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
