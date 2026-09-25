import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import { prisma } from './prisma'
import { lanHosts } from './dev-hosts.mjs'

/** BETTER_AUTH_URL のほかにログインを受け付けるURL（カンマ区切り。例：Netlify の確認用URL https://*--resole-gym-crm.netlify.app） */
function envOrigins(): string[] {
  return (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 開発中は同じWi-Fiの iPad（この Mac の IP・〜.local）からのログインも受け付ける */
function devOrigins(): string[] {
  if (process.env.NODE_ENV === 'production') return []
  const port = new URL(process.env.BETTER_AUTH_URL ?? 'http://localhost:3020').port || '3020'
  return lanHosts().map((h) => `http://${h}:${port}`)
}

// トレーナー用のログイン。アカウントはオーナーが作成する（一般公開の新規登録はしない）
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  trustedOrigins: [...envOrigins(), ...devOrigins()],
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 10,
  },
  user: {
    additionalFields: {
      role: { type: 'string', required: false, defaultValue: 'staff', input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
  },
  plugins: [nextCookies()],
})

export type AppUser = typeof auth.$Infer.Session.user
