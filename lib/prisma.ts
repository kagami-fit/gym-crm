import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { getCloudflareContext } from '@opennextjs/cloudflare'

/**
 * データベースへの接続（Prisma を pg アダプターでつなぐ）。
 * - 手元（npm run dev）：1つを使い回す。開発中はホットリロードで何度も作られやすいので `globalThis` に置く
 * - 公開先（Cloudflare Workers）：リクエストをまたいで接続を使い回せないので、リクエストごとに1つ作り、
 *   同じリクエストの中では同じものを使う（`prisma.$transaction([...])` で同じ接続が要るため）
 * どちらの場合も、アプリの中では `prisma` をそのまま使えばよい。
 */
declare global {
  var prisma: PrismaClient | undefined
}

/** 新しく接続を作る（シード・スクリプトからも使う） */
export function createPrisma(connectionString = process.env.DATABASE_URL): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

const onWorkers = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers'
const perRequest = new WeakMap<object, PrismaClient>()

function current(): PrismaClient {
  if (onWorkers) {
    const { ctx } = getCloudflareContext()
    let client = perRequest.get(ctx)
    if (!client) {
      client = createPrisma()
      perRequest.set(ctx, client)
    }
    return client
  }
  return (globalThis.prisma ??= createPrisma())
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_, key) {
    const client = current()
    const value = Reflect.get(client, key)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
