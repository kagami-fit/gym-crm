// npm run setup: 初回だけ。開発用DBを起動 → テーブル作成 → 初期データ投入 → DBを止める
import { execSync } from 'node:child_process'
import { startDevDb } from './dev-db.mjs'

const stop = await startDevDb()
try {
  execSync('npx prisma migrate deploy', { stdio: 'inherit' })
  execSync('npx prisma db seed', { stdio: 'inherit' })
  console.log('\nセットアップ完了。npm run dev で起動してください（http://localhost:3020）')
} finally {
  await stop()
}
