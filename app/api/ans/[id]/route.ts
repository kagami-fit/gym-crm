import { NextResponse } from 'next/server'
import { getUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

// 自律神経の測定結果のファイルを開く（ログインしている人だけ）
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const m = await prisma.ansMeasurement.findUnique({ where: { id }, select: { data: true, mimeType: true, fileName: true } })
  if (!m) return new NextResponse('Not Found', { status: 404 })
  return new NextResponse(new Uint8Array(m.data), {
    headers: {
      'content-type': m.mimeType,
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(m.fileName)}`,
      // 同じ測定のファイルは変わらないので、見た人の端末に1時間だけ残す（一覧の小さい表示と大きい表示で読み直さない）
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
    },
  })
}
