#!/usr/bin/env bash
# Netlify に公開する（公開デモ https://resole-gym-crm.netlify.app）。
#   npm run deploy:preview … 確認用のURLに公開（Netlifyのクレジットを使わない）
#   npm run deploy:prod    … 本番に公開（1回15クレジット。クチコミツールと合わせて月300まで無料）
# Netlify の Next.js 対応はビルド時に手元の .env ファイルを公開物にコピーするので、
# ビルドの間だけ手元の秘密のファイル（.env など）を退避し、終わったら必ず戻す。
# 公開先の値は Netlify の環境変数から入る。
set -euo pipefail
cd "$(dirname "$0")/.."

STASH="$(mktemp -d)"
restore() {
  for f in "$STASH"/.env*; do [ -e "$f" ] && mv "$f" .; done
  rmdir "$STASH" 2>/dev/null || true
}
trap restore EXIT

for f in .env .env.local .env.production .env.production.local .env.development.local; do
  if [ -e "$f" ]; then mv "$f" "$STASH/"; fi
done
rm -rf .netlify/functions-internal .netlify/edge-functions

npx --yes netlify-cli@latest deploy --build "$@"

# 念のため、公開物に .env ファイルが入っていないことを確かめる
if find .netlify/functions-internal .netlify/edge-functions -name '.env*' 2>/dev/null | grep -q .; then
  echo '注意：公開物に .env ファイルが含まれています' >&2
  exit 1
fi
