import { NextResponse } from 'next/server'
import { getUser } from '@/lib/session'
import { getDrawing } from '@/lib/data/training'

// 一覧の小さな表示をタップしたときに、手書きメモ全体（元の線）を返す。
// サーバーアクションは1つずつ順番に処理されるので、先読みと同時に開けるよう普通の取得（GET）にしている
export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { sessionId } = await params
  const data = await getDrawing(sessionId)
  return NextResponse.json({ data }, { headers: { 'cache-control': 'private, no-store' } })
}
