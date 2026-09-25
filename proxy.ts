import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

// ログインのクッキーがなければログイン画面へ（本当の確認は各ページ・アクションの requireUser で行う）
export function proxy(req: NextRequest) {
  if (!getSessionCookie(req)) {
    const url = new URL('/login', req.url)
    if (req.nextUrl.pathname !== '/') url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  // ログイン画面・認証API・画像やアイコン（ロゴ・ホーム画面用）はログインなしで取得できる
  matcher: ['/((?!login|api/auth|api/dev|api/demo|_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'],
}
