import { ClientFileGallery } from '@/components/files/FileGalleryParts'
import { PhotoUpload } from '@/components/files/PhotoUpload'
import { AnsGallery } from '@/components/plan/AnsGallery'
import { Section } from '@/components/ui'
import { resolveBaseDate } from '@/lib/base-date'
import { getAnsMeasurements } from '@/lib/data/ans'
import { getClient } from '@/lib/data/clients'
import { getClientFiles } from '@/lib/data/files'
import { ymdJa } from '@/lib/dates'
import { requireUser } from '@/lib/session'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return { title: `${(await getClient(id)).name}｜写真・資料` }
}

/**
 * 写真・資料：このお客様の写真と資料を1か所にまとめる（来店ごとのログにつけた写真も、ここにすべて並ぶ）。
 * カルテの原本などの資料（PDF）と、自律神経の測定票も一緒に見られる。
 */
export default async function FilesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  await requireUser()
  const { id } = await params
  const base = resolveBaseDate((await searchParams).date)
  const [files, ans] = await Promise.all([getClientFiles(id), getAnsMeasurements(id)])
  const photos = files.filter((f) => f.kind === 'photo')
  const docs = files.filter((f) => f.kind === 'document')

  return (
    <div className="space-y-5">
      <Section title="写真" en="Photos" aside={<span className="text-white/80">{photos.length}枚</span>}>
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-soft px-4 py-3">
          <PhotoUpload clientId={id} date={base} label={`写真を追加（${ymdJa(base, false)}）`} />
          <p className="text-sm text-ink-2">来店ごとのログ（トレーニングのタブ）につけた写真も、ここにまとまります。押すと大きく開きます。</p>
        </div>
        {photos.length ? <ClientFileGallery clientId={id} files={photos} viewerTitle="写真" /> : <p className="rounded-xl border border-dashed border-line-2 bg-white/60 px-4 py-5 text-center text-sm text-ink-2">まだ写真はありません</p>}
      </Section>

      <Section title="資料" en="Documents" aside={<span className="text-white/80">{docs.length}件</span>}>
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-soft px-4 py-3">
          <PhotoUpload clientId={id} date={base} label="資料（PDF・写真）を追加" accept="application/pdf,image/*" />
          <p className="text-sm text-ink-2">カウンセリングカルテの原本など。PDF は資料、写真は写真に入ります。</p>
        </div>
        {docs.length ? <ClientFileGallery clientId={id} files={docs} viewerTitle="資料" /> : <p className="rounded-xl border border-dashed border-line-2 bg-white/60 px-4 py-5 text-center text-sm text-ink-2">まだ資料はありません</p>}
      </Section>

      <Section title="自律神経の測定票" en="ANS">
        {ans.length ? <AnsGallery files={ans} /> : <p className="rounded-xl border border-dashed border-line-2 bg-white/60 px-4 py-5 text-center text-sm text-ink-2">まだ測定票はありません（指導計画のタブで入れます）</p>}
      </Section>
    </div>
  )
}
