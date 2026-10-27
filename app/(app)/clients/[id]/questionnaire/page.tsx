import { AlertTriangle } from 'lucide-react'
import { QuestionnaireForm } from '@/components/client/QuestionnaireForm'
import { Section } from '@/components/ui'
import { getClient } from '@/lib/data/clients'
import { getQuestionnaire } from '@/lib/data/questionnaire'
import { todayYmd, ymdJa } from '@/lib/dates'
import { alertsOf, legacyAnswers } from '@/lib/questionnaire'
import { requireUser } from '@/lib/session'
import { saveQuestionnaireAction } from './actions'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return { title: `${(await getClient(id)).name}｜問診票` }
}

export default async function QuestionnairePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser()
  const { id } = await params
  const q = await getQuestionnaire(id)
  const alerts = q ? alertsOf(q.answers) : []
  const legacy = q ? legacyAnswers(q.answers) : []
  return (
    <div className="space-y-5">
      <Section title="指導の前に確認すること" en="Check" aside={q?.answeredOn ? <span className="text-white/80">記入日 {ymdJa(q.answeredOn)}</span> : undefined}>
        {alerts.length === 0 ? (
          <p className="text-sm text-ink-2">{q ? '注意が必要な回答はありません。' : 'まだ問診票が入力されていません。'}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {alerts.map((a) => (
              <li key={a.label} className="flex gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-sm">
                <AlertTriangle className="mt-0.5 size-4 flex-none text-warn" aria-hidden />
                <span>
                  <span className="font-bold text-warn">{a.label}</span>
                  {a.detail && <span className="block text-ink-2">{a.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <QuestionnaireForm action={saveQuestionnaireAction.bind(null, id)} answers={q?.answers ?? {}} answeredOn={q?.answeredOn ?? todayYmd()} />
      {legacy.length > 0 && (
        <Section title="前の問診票の回答（読み取り専用）" en="Previous">
          <p className="mb-3 text-sm text-ink-2">2026年10月にカルテの書式に合わせて問診票を作り直す前に入れた回答です。保存しても消えません。</p>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {legacy.map((l) => (
              <div key={l.label} className="border-b border-line pb-2">
                <dt className="text-xs font-bold text-ink-3">{l.label}</dt>
                <dd className="text-sm">{l.value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}
    </div>
  )
}
