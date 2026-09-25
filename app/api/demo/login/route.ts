import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { demoLoginEnabled } from '@/lib/demo'

// 公開デモの「デモを見る」ボタン（DEMO_MODE=true のときだけ。それ以外は404）
export async function POST() {
  if (!demoLoginEnabled()) return new NextResponse('Not Found', { status: 404 })
  const res = await auth.api.signInEmail({
    body: { email: process.env.DEMO_USER_EMAIL!, password: process.env.DEMO_USER_PASSWORD! },
    asResponse: true,
  })
  const redirect = new NextResponse(null, { status: 303, headers: { location: '/clients' } })
  for (const cookie of res.headers.getSetCookie()) redirect.headers.append('set-cookie', cookie)
  return redirect
}
