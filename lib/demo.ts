/**
 * 公開デモ（リンクを知っている人が「デモを見る」でログインなしに入れる版）。
 * Netlify の環境変数 DEMO_MODE=true のときだけ有効。架空のお客様のデータだけを入れ、本当のお客様の情報は入れない。
 * 入ると DEMO_USER_EMAIL のスタッフ権限アカウントになる（設定の変更・アカウント作成・顧客の削除はできない）。
 */
export function isDemo(): boolean {
  return process.env.DEMO_MODE === 'true'
}

export function demoLoginEnabled(): boolean {
  return isDemo() && !!process.env.DEMO_USER_EMAIL && !!process.env.DEMO_USER_PASSWORD
}
