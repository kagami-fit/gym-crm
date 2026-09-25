import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { devLoginEnabled } from '@/lib/dev-access'

// 開発中だけ使える、開発用オーナーでのログイン（本番・DEV_LOGIN未設定・この Mac 以外からは404）
export async function GET(req: Request) {
  if (!devLoginEnabled(req.headers)) return new NextResponse('Not Found', { status: 404 })
  const res = await auth.api.signInEmail({
    body: { email: process.env.DEV_OWNER_EMAIL!, password: process.env.DEV_OWNER_PASSWORD! },
    asResponse: true,
  })
  // 転送先は開いている画面と同じホストのまま（相対パス）にする
  const redirect = new NextResponse(null, { status: 303, headers: { location: '/clients' } })
  for (const cookie of res.headers.getSetCookie()) redirect.headers.append('set-cookie', cookie)
  return redirect
}
