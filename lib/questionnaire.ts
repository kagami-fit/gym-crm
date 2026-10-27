// 問診票の項目定義。ここを書き換えれば画面と保存内容が変わる（回答はJSONで保存しているのでDBの変更は不要）。
// 2026-10-27：紙の「Resole カウンセリングカルテ」と同じ並び・選択肢に作り直した（QUESTIONNAIRE）。
// 前の問診票の項目（LEGACY_QUESTIONNAIRE）は入力欄から外し、すでに入っている回答だけ読み取り専用で出す（注意事項にも使う）。

export type QField =
  | { key: string; label: string; type: 'text'; placeholder?: string; hint?: string }
  | { key: string; label: string; type: 'textarea'; placeholder?: string; hint?: string }
  | { key: string; label: string; type: 'radio'; options: string[]; hint?: string }
  | { key: string; label: string; type: 'checkbox'; options: string[]; hint?: string }
  /**
   * あり／なし＋詳細。「あり」のとき注意事項として概要にも表示する（alertLabel はそのときの短い名前）。
   * 保存する値はいつも「あり」「なし」。画面のボタンの文字だけ yesNo で変えられる（カルテは「はい」「いいえ」）
   */
  | { key: string; label: string; type: 'yesno'; detailPlaceholder?: string; alert?: boolean; alertLabel?: string; yesNo?: [string, string] }

export type QSection = { key: string; title: string; fields: QField[] }

/** Resole カウンセリングカルテ（紙と同じ1〜7の質問）と、カウンセリングで聞いたことのまとめ */
export const QUESTIONNAIRE: QSection[] = [
  {
    key: 'karte',
    title: 'Resole カウンセリングカルテ',
    fields: [
      { key: 'karteWeight', label: '体重（カルテに書いた値）', type: 'text', placeholder: '例：65kg' },
      { key: 'karteTargetWeight', label: '目標体重（任意）', type: 'text', placeholder: '例：53kg（ベスト52kg）' },
      { key: 'source', label: '1. Resoleを何から見聞きして知りましたか？', type: 'checkbox', options: ['Twitter', 'Instagram', 'Facebook', 'Resole公式サイト', 'オンラインサロン', '友人・知人からの紹介', 'その他'] },
      { key: 'sourceNote', label: '1. の「その他」・書き込み', type: 'text', placeholder: '例：Instagram広告／ネットで見つけた' },
      {
        key: 'habit',
        label: '2. 運動習慣について、当てはまるもの',
        type: 'radio',
        options: ['運動習慣なし。デスクワーク中心', '運動習慣なし。よく歩く', '運動習慣あり。ジムやスポーツを週に1〜2回', '運動習慣あり。ジムやスポーツを週に3回以上'],
      },
      { key: 'habitNote', label: '2. 運動の内容・書き込み', type: 'text', placeholder: '例：ピラティス、トレーニング、有酸素' },
      { key: 'goals', label: '3. Resoleご利用の目的（複数可）', type: 'checkbox', options: ['シェイプアップ', 'ダイエット', '筋肉を増やす', '体力の向上', '柔軟性の向上', 'スポーツパフォーマンス向上', 'けが予防・改善', 'その他'] },
      { key: 'goalsNote', label: '3. の「その他」・書き込み', type: 'text', placeholder: '例：子どもと遊ぶため' },
      { key: 'illness', label: '4. 現在かかっている病気はありますか？', type: 'yesno', yesNo: ['はい', 'いいえ'], detailPlaceholder: '具体的な病名', alert: true, alertLabel: '治療中の病気' },
      { key: 'injury', label: '5. 現在ケガをしている場所はありますか？', type: 'yesno', yesNo: ['はい', 'いいえ'], detailPlaceholder: '具体的な部位', alert: true, alertLabel: 'ケガ' },
      {
        key: 'discomfort',
        label: '6. 肩こり腰痛など、ケガというほどではないが調子の悪い部位はありますか？',
        type: 'yesno',
        yesNo: ['はい', 'いいえ'],
        detailPlaceholder: '具体的な部位',
        alert: true,
        alertLabel: '調子の悪い部位',
      },
      { key: 'wish', label: '7. Resoleでお客様が達成したい目標', type: 'textarea' },
    ],
  },
  {
    key: 'summary',
    title: '目標・要望まとめ（カウンセリングで聞いたこと）',
    fields: [
      { key: 'concerns', label: '目標・悩み（優先順位・気になる部位など）', type: 'textarea', placeholder: '例：①姿勢×ボディライン　産後で骨の歪みを感じる…' },
      { key: 'karteNotes', label: 'カルテへの書き込み・聞き取りメモ', type: 'textarea', placeholder: '余白や欄外に書いたこと' },
    ],
  },
]

/** 前の問診票の項目（2026-10-27 まで）。入力欄には出さず、すでに入っている回答を読み取り専用で出す */
export const LEGACY_QUESTIONNAIRE: QSection[] = [
  {
    key: 'purpose',
    title: 'ご来店の目的',
    fields: [
      {
        key: 'purposes',
        label: '目的（複数可）',
        type: 'checkbox',
        options: ['ダイエット（減量）', 'ボディメイク', '筋力アップ', '健康維持・体力向上', '姿勢改善', '肩こり・腰痛の改善', '競技パフォーマンス向上', 'その他'],
      },
      { key: 'goalDetail', label: '具体的な目標・なりたい姿', type: 'textarea', placeholder: '例：ウエストを5cm細くしたい、階段で息切れしない体力をつけたい' },
      { key: 'deadline', label: '期限・目標にしているイベント', type: 'text', placeholder: '例：3ヶ月後の結婚式' },
    ],
  },
  {
    key: 'health',
    title: '健康状態',
    fields: [
      { key: 'underTreatment', label: '現在治療中の病気', type: 'yesno', detailPlaceholder: '病名・通院先など', alert: true },
      {
        key: 'history',
        label: '既往歴（これまでにかかった病気）',
        type: 'checkbox',
        options: ['高血圧', '心臓の病気', '糖尿病', '脂質異常症', '喘息', 'てんかん', '脳卒中', '腎臓の病気', 'がん', 'その他'],
      },
      { key: 'historyDetail', label: '既往歴の詳細', type: 'text', placeholder: '時期・現在の状態など' },
      { key: 'surgery', label: '手術歴', type: 'yesno', detailPlaceholder: '部位・時期', alert: true },
      { key: 'medication', label: '服用中の薬', type: 'yesno', detailPlaceholder: '薬の名前・目的', alert: true },
      { key: 'allergy', label: 'アレルギー（食物・薬など）', type: 'yesno', detailPlaceholder: '内容', alert: true },
      { key: 'doctorRestriction', label: '医師から運動を制限されている', type: 'yesno', detailPlaceholder: '制限の内容', alert: true },
      { key: 'chestSymptom', label: '運動中に胸の痛み・息苦しさ・めまいを感じたことがある', type: 'yesno', detailPlaceholder: 'いつ・どんなときに', alert: true },
      { key: 'pregnancy', label: '妊娠中・妊娠の可能性（女性の方）', type: 'radio', options: ['なし', 'あり', '回答しない'] },
      { key: 'bloodPressure', label: '血圧（わかれば）', type: 'text', placeholder: '例：120/80' },
    ],
  },
  {
    key: 'pain',
    title: '痛み・ケガ',
    fields: [
      { key: 'currentPain', label: '現在痛みがある', type: 'yesno', detailPlaceholder: '部位・いつから・どんな動きで痛むか・強さ（0〜10）', alert: true },
      { key: 'pastInjury', label: '過去のケガ（骨折・捻挫・ヘルニアなど）', type: 'yesno', detailPlaceholder: '部位・時期・現在の状態', alert: true },
    ],
  },
  {
    key: 'exercise',
    title: '運動歴',
    fields: [
      { key: 'exerciseHabit', label: '現在の運動習慣', type: 'radio', options: ['なし', '月に数回', '週1〜2回', '週3回以上'] },
      { key: 'exerciseDetail', label: '運動の内容', type: 'text', placeholder: '例：ウォーキング30分、ヨガ' },
      { key: 'sportsHistory', label: '過去の運動・スポーツ歴', type: 'textarea' },
      { key: 'weightTraining', label: '筋トレの経験', type: 'radio', options: ['なし', '少しある', '継続してやっていた'] },
    ],
  },
  {
    key: 'lifestyle',
    title: '生活習慣',
    fields: [
      { key: 'workStyle', label: '仕事中の姿勢', type: 'radio', options: ['デスクワーク中心', '立ち仕事中心', '外回り・移動が多い', '体を使う仕事', 'その他'] },
      { key: 'sleepHours', label: '睡眠時間', type: 'radio', options: ['5時間未満', '5〜6時間', '6〜7時間', '7時間以上'] },
      { key: 'sleepQuality', label: '睡眠の質', type: 'radio', options: ['よい', 'ふつう', 'よくない'] },
      { key: 'alcohol', label: '飲酒', type: 'radio', options: ['飲まない', '月に数回', '週1〜3回', '週4回以上'] },
      { key: 'smoking', label: '喫煙', type: 'radio', options: ['吸わない', '以前吸っていた', '吸う'] },
      { key: 'stress', label: 'ストレス', type: 'radio', options: ['少ない', 'ふつう', '多い'] },
    ],
  },
  {
    key: 'diet',
    title: '食習慣',
    fields: [
      { key: 'mealsPerDay', label: '1日の食事回数', type: 'radio', options: ['1回', '2回', '3回', '4回以上'] },
      { key: 'breakfast', label: '朝食', type: 'radio', options: ['毎日食べる', 'ときどき食べる', '食べない'] },
      { key: 'eatingOut', label: '外食・コンビニ', type: 'radio', options: ['ほとんどない', '週1〜3回', '週4〜6回', 'ほぼ毎日'] },
      { key: 'snacking', label: '間食', type: 'radio', options: ['ほとんどない', 'ときどき', 'ほぼ毎日'] },
      { key: 'foodRestriction', label: '苦手な食べ物・食事制限', type: 'text' },
      { key: 'supplements', label: 'プロテイン・サプリメント', type: 'text' },
    ],
  },
  {
    key: 'other',
    title: 'その他',
    fields: [{ key: 'notes', label: 'トレーナーに伝えておきたいこと', type: 'textarea' }],
  },
]

export type QAnswers = Record<string, string | string[]>

/** yesno 項目の詳細は `${key}__detail` に入れる */
export const detailKey = (key: string) => `${key}__detail`

export function parseAnswers(form: FormData): QAnswers {
  const out: QAnswers = {}
  for (const section of QUESTIONNAIRE) {
    for (const f of section.fields) {
      if (f.type === 'checkbox') {
        const values = form.getAll(f.key).map(String).filter((v) => f.options.includes(v))
        if (values.length) out[f.key] = values
      } else if (f.type === 'radio') {
        const v = String(form.get(f.key) ?? '')
        if (f.options.includes(v)) out[f.key] = v
      } else if (f.type === 'yesno') {
        const v = String(form.get(f.key) ?? '')
        if (v === 'あり' || v === 'なし') out[f.key] = v
        const d = String(form.get(detailKey(f.key)) ?? '').trim().slice(0, 500)
        if (d) out[detailKey(f.key)] = d
      } else {
        const v = String(form.get(f.key) ?? '').trim().slice(0, f.type === 'textarea' ? 2000 : 300)
        if (v) out[f.key] = v
      }
    }
  }
  return out
}

export function asAnswers(value: unknown): QAnswers {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: QAnswers = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v
    else if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === 'string')
  }
  return out
}

/** いまの入力欄の項目のキー（詳細の欄も含む）。これ以外の回答は前の問診票のもの */
export const CURRENT_KEYS = new Set(QUESTIONNAIRE.flatMap((s) => s.fields.flatMap((f) => (f.type === 'yesno' ? [f.key, detailKey(f.key)] : [f.key]))))

/** 前の問診票の回答のうち、入っているもの（読み取り専用の表示用） */
export function legacyAnswers(a: QAnswers): Array<{ label: string; value: string }> {
  const out: Array<{ label: string; value: string }> = []
  for (const section of LEGACY_QUESTIONNAIRE) {
    for (const f of section.fields) {
      const v = a[f.key]
      const detail = f.type === 'yesno' ? a[detailKey(f.key)] : undefined
      const text = [Array.isArray(v) ? v.join('・') : v, typeof detail === 'string' ? detail : ''].filter(Boolean).join('：')
      if (text) out.push({ label: f.label, value: text })
    }
  }
  return out
}

/** 概要やヘッダーに出す注意事項（「あり」の項目と既往歴。前の問診票の回答も見る） */
export function alertsOf(a: QAnswers): Array<{ label: string; detail: string }> {
  const out: Array<{ label: string; detail: string }> = []
  for (const section of [...QUESTIONNAIRE, ...LEGACY_QUESTIONNAIRE]) {
    for (const f of section.fields) {
      if (f.type === 'yesno' && f.alert && a[f.key] === 'あり') {
        out.push({ label: f.alertLabel ?? f.label, detail: String(a[detailKey(f.key)] ?? '') })
      }
      if (f.key === 'history' && Array.isArray(a.history) && a.history.length) {
        out.push({ label: '既往歴', detail: [a.history.join('・'), typeof a.historyDetail === 'string' ? a.historyDetail : ''].filter(Boolean).join('／') })
      }
    }
  }
  return out
}
