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
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  })
}
