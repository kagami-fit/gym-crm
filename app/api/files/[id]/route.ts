import { NextResponse } from 'next/server'
import { getUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

// お客様の写真・資料のファイルを開く（ログインしている人だけ）
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const f = await prisma.clientFile.findUnique({ where: { id }, select: { data: true, mimeType: true, fileName: true } })
  if (!f) return new NextResponse('Not Found', { status: 404 })
  return new NextResponse(new Uint8Array(f.data), {
    headers: {
      'content-type': f.mimeType,
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(f.fileName)}`,
      // 同じファイルは変わらないので、見た人の端末に1時間だけ残す
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
    },
  })
}
