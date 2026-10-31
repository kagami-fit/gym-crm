#!/usr/bin/env bash
# Cloudflare Workers に公開する（公開デモ https://resole-gym-crm.resole-exercise-library.workers.dev）。
#   npm run deploy          … 本番に公開（Cloudflare の無料枠。Netlify のようなクレジットは使わない）
#   npm run deploy:preview  … 確認用の版だけを上げる（本番は変わらない。URL は結果に出る）
# 組み立て（OpenNext）は手元の .env ファイルを公開物に入れることがあるので、組み立ての間だけ退避し、終わったら必ず戻す。
# 公開先の値は wrangler.jsonc の vars と、Cloudflare に入れた secret から入る。
set -euo pipefail
cd "$(dirname "$0")/.."

STASH="$(mktemp -d)"
restore() {
  for f in "$STASH"/.env* "$STASH"/.dev.vars; do [ -e "$f" ] && mv "$f" .; done
  rmdir "$STASH" 2>/dev/null || true
}
trap restore EXIT

for f in .env .env.local .env.production .env.production.local .env.development.local .dev.vars; do
  if [ -e "$f" ]; then mv "$f" "$STASH/"; fi
done

npx opennextjs-cloudflare build

# 念のため、退避した .env の値（8文字以上のもの）が公開物に入っていないことを確かめる（値は画面に出さない）
PATTERNS="$STASH/.patterns"
cat "$STASH"/.env* "$STASH"/.dev.vars 2>/dev/null | grep -vE '^\s*(#|$)' | sed -E 's/^[^=]+=//; s/^["'"'"']//; s/["'"'"']$//' | awk 'length >= 8' > "$PATTERNS" || true
if [ -s "$PATTERNS" ] && grep -rqsF -f "$PATTERNS" .open-next/worker.js .open-next/server-functions .open-next/middleware 2>/dev/null; then
  rm -f "$PATTERNS"
  echo '注意：公開物に .env の値が含まれています。公開を止めました' >&2
  exit 1
fi
rm -f "$PATTERNS"

if [ "${1:-}" = "--preview" ]; then
  shift
  npx wrangler versions upload "$@"
else
  npx wrangler deploy "$@"
fi
