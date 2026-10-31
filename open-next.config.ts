// Cloudflare Workers に公開するための OpenNext の設定（npm run deploy）。
// 画面はすべてログインした人ごとに作るので、ページの保存（キャッシュ）は使わない
import { defineCloudflareConfig } from '@opennextjs/cloudflare'

const config = {
  ...defineCloudflareConfig({}),
  // Turbopack はページごとに同じライブラリを何度も入れて、無料枠（圧縮後3MB）を超えるため、公開用は webpack で組み立てる
  buildCommand: 'npx next build --webpack',
}

export default config
