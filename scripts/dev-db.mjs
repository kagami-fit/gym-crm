// 開発用のPostgreSQL（プロジェクト内の .data/postgres に保存）。本番は Neon などを使う。
// 単体で起動: npm run db:up ／ npm run dev からも自動で起動される
import { existsSync } from 'node:fs'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import EmbeddedPostgres from 'embedded-postgres'

export const DEV_DB_PORT = Number(process.env.DEV_DB_PORT ?? 54330)
const dataDir = fileURLToPath(new URL('../.data/postgres', import.meta.url))
const dbName = 'gymcrm'

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' })
    socket.once('connect', () => { socket.end(); resolve(true) })
    socket.once('error', () => resolve(false))
  })
}

/** 起動して stop 関数を返す（すでに起動済みなら何もしない） */
export async function startDevDb() {
  if (await isPortOpen(DEV_DB_PORT)) {
    console.log(`dev db: already running on ${DEV_DB_PORT}`)
    return async () => {}
  }
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'gymcrm',
    password: 'gymcrm',
    port: DEV_DB_PORT,
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
  })
  if (!existsSync(`${dataDir}/PG_VERSION`)) await pg.initialise()
  await pg.start()
  try {
    await pg.createDatabase(dbName)
  } catch {
    // 既に作成済み
  }
  console.log(`dev db ready: postgresql://gymcrm:gymcrm@localhost:${DEV_DB_PORT}/${dbName}`)
  return () => pg.stop()
}

// 直接実行されたときは起動したまま待つ
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const stop = await startDevDb()
  const shutdown = async () => {
    await stop()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
