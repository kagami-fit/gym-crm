// 初期データの投入。何度実行しても壊れない（設定・種目は不足分だけ足す）。
// - 計算設定の初期値（参考シートと同じ）
// - 種目マスタ（参考シートの6部位132種目）
// - 開発用オーナー（DEV_LOGIN=true のときだけ）
// - デモ顧客（SEED_DEMO=1 かつ顧客が0人のときだけ。日付は実行日を基準に作る）
import { readFileSync } from 'node:fs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Prisma } from '@prisma/client'
import { hashPassword } from 'better-auth/crypto'
import { DEFAULT_SETTINGS } from '../lib/calc/settings'
import { addDays, addMonthsKey, fromDbDate, monthKey, todayYmd, toDbDate, weekStartOf, type Ymd } from '../lib/dates'
import { detailKey, type QAnswers } from '../lib/questionnaire'
import { drawingThumb, parseDrawing } from '../lib/drawing'
import { normalizePurposes } from '../lib/purposes'

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

async function seedSettings() {
  const existing = await prisma.appSetting.findUnique({ where: { key: 'calc' } })
  if (existing) return console.log('settings: 既存の設定を使用')
  await prisma.appSetting.create({ data: { key: 'calc', value: DEFAULT_SETTINGS as unknown as Prisma.InputJsonValue } })
  console.log('settings: 初期値を作成')
}

async function seedExercises() {
  const list: Array<{ bodyPart: string; name: string }> = JSON.parse(readFileSync(new URL('./seed-data/exercises.json', import.meta.url), 'utf8'))
  let added = 0
  for (const [i, e] of list.entries()) {
    const r = await prisma.exercise.upsert({
      where: { bodyPart_name: { bodyPart: e.bodyPart, name: e.name } },
      update: {},
      create: { bodyPart: e.bodyPart, name: e.name, sortOrder: i },
    })
    if (r) added++
  }
  console.log(`exercises: ${added}件`)
}

async function seedDevOwner(): Promise<string | null> {
  const email = process.env.DEV_OWNER_EMAIL
  const password = process.env.DEV_OWNER_PASSWORD
  // 公開先のDBに投入するとき（npm run prod:seed は NODE_ENV=production）は作らない
  if (process.env.NODE_ENV === 'production' || process.env.DEV_LOGIN !== 'true' || !email || !password) return null
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return existing.id
  const id = crypto.randomUUID()
  await prisma.user.create({
    data: {
      id,
      email,
      name: 'オーナー（開発用）',
      role: 'owner',
      emailVerified: true,
      accounts: { create: { id: crypto.randomUUID(), accountId: id, providerId: 'credential', password: await hashPassword(password) } },
    },
  })
  console.log(`dev owner: ${email}`)
  return id
}

/** 公開デモ（DEMO_MODE=true）で「デモを見る」から入るアカウント。スタッフ権限（設定の変更はできない） */
async function seedDemoUser(): Promise<string | null> {
  const email = process.env.DEMO_USER_EMAIL
  const password = process.env.DEMO_USER_PASSWORD
  if (process.env.DEMO_MODE !== 'true' || !email || !password) return null
  const hash = await hashPassword(password)
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { role: 'staff' } })
    await prisma.account.updateMany({ where: { userId: existing.id, providerId: 'credential' }, data: { password: hash } })
    return existing.id
  }
  const id = crypto.randomUUID()
  await prisma.user.create({
    data: {
      id,
      email,
      name: 'デモ トレーナー',
      role: 'staff',
      emailVerified: true,
      accounts: { create: { id: crypto.randomUUID(), accountId: id, providerId: 'credential', password: hash } },
    },
  })
  console.log(`demo user: ${email}`)
  return id
}

// ── デモ顧客 ─────────────────────────────────────

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const round = (v: number, step: number) => Math.round(v / step) * step
const r1 = (v: number) => Math.round(v * 10) / 10

type Lift = { part: string; name: string; from: number; to: number; step: number; reps: number; sets: number }

async function createDemoClient(opts: {
  seed: number
  today: Ymd
  trainerId: string | null
  client: Omit<Prisma.ClientCreateInput, 'trainer'>
  body?: { fromDay: number; toDay: number; ratio: number; w0: number; w1: number; f0: number; f1: number }
  goals?: Array<{ day: number; target: number; pace: string; activity: number; note?: string }>
  sessions?: { fromDay: number; toDay: number; weekdays: number[]; plans: Lift[][] }
  meals?: { days: number }
  questionnaire?: QAnswers
}) {
  const rand = rng(opts.seed)
  const c = await prisma.client.create({
    data: { ...opts.client, trainer: opts.trainerId ? { connect: { id: opts.trainerId } } : undefined },
  })

  // 体重・体脂肪率
  const weightAt = new Map<number, { w: number; f: number }>()
  if (opts.body) {
    const b = opts.body
    const span = b.toDay - b.fromDay || 1
    for (let d = b.fromDay; d <= b.toDay; d++) {
      const t = (d - b.fromDay) / span
      const weekend = [0, 6].includes(new Date(`${addDays(opts.today, d)}T00:00:00Z`).getUTCDay()) ? 0.25 : 0
      const w = b.w0 - (b.w0 - b.w1) * Math.pow(t, 0.85) + (rand() - 0.5) * 0.5 + weekend
      const f = b.f0 - (b.f0 - b.f1) * Math.pow(t, 0.8) + (rand() - 0.5) * 0.7
      weightAt.set(d, { w, f })
      if (d !== b.fromDay && d !== b.toDay && rand() > b.ratio) continue
      await prisma.bodyLog.create({ data: { clientId: c.id, date: toDbDate(addDays(opts.today, d)), weightKg: r1(w), bodyFatPct: r1(f) } })
    }
  }

  for (const g of opts.goals ?? []) {
    const s = weightAt.get(g.day)
    await prisma.goal.create({
      data: {
        clientId: c.id,
        startDate: toDbDate(addDays(opts.today, g.day)),
        startWeightKg: s ? r1(s.w) : null,
        startBodyFatPct: s ? r1(s.f) : null,
        targetWeightKg: g.target,
        paceKey: g.pace,
        activityFactor: g.activity,
        note: g.note ?? null,
        createdById: opts.trainerId,
      },
    })
  }

  if (opts.sessions) {
    const s = opts.sessions
    const dates: number[] = []
    for (let d = s.fromDay; d <= s.toDay; d++) {
      const wd = new Date(`${addDays(opts.today, d)}T00:00:00Z`).getUTCDay()
      if (s.weekdays.includes(wd) && rand() > 0.08) dates.push(d)
    }
    for (const [i, d] of dates.entries()) {
      const plan = s.plans[i % s.plans.length]
      const t = dates.length > 1 ? i / (dates.length - 1) : 1
      await prisma.trainingSession.create({
        data: {
          clientId: c.id,
          date: toDbDate(addDays(opts.today, d)),
          trainerId: opts.trainerId,
          memo: i === dates.length - 1 ? 'フォーム良好。次回は重量を少し上げる' : null,
          sets: {
            create: plan.map((l, order) => {
              const weight = l.to === 0 ? 0 : Math.max(l.step, round(l.from + (l.to - l.from) * t + (rand() - 0.5) * l.step, l.step))
              const reps = Math.max(5, l.reps + Math.round((rand() - 0.5) * 3))
              return { order, bodyPart: l.part, exercise: l.name, weightKg: weight, reps, sets: l.sets }
            }),
          },
        },
      })
    }
  }

  if (opts.meals) {
    const pools = {
      breakfast: ['トースト1枚、ゆで卵2個、ブラックコーヒー', 'おにぎり1個、味噌汁、納豆', 'オートミール40g＋プロテイン、バナナ', '食べていない（寝坊）', 'ヨーグルト、グラノーラ少し', 'ご飯150g、焼き鮭、味噌汁'],
      lunch: ['社食の生姜焼き定食（ご飯少なめ）', 'コンビニのサラダチキン、おにぎり2個', 'ざるそば、ミニ親子丼', 'ラーメン、半チャーハン', '鶏むね肉のお弁当（ご飯150g）', 'パスタ（ペペロンチーノ）、サラダ'],
      dinner: ['鶏むね肉のソテー、サラダ、味噌汁、ご飯100g', '焼き魚定食（外食）', '飲み会：焼き鳥、ビール2杯、ハイボール1杯', '豚しゃぶサラダ、冷奴（ご飯なし）', 'カレーライス（普通盛り）', '刺身、冷奴、ご飯120g'],
      snack: ['プロテインバー', 'チョコレート2かけ', 'ナッツひとつかみ', 'トレーニング後にプロテイン', 'せんべい2枚'],
      note: ['水は1.5Lくらい', '在宅勤務で歩数が少なめ', '寝不足で間食が増えた', '外食が続いた'],
    }
    for (let d = -opts.meals.days + 1; d <= 0; d++) {
      for (const [slot, pool] of Object.entries(pools)) {
        const chance = slot === 'note' ? 0.25 : slot === 'snack' ? 0.6 : 0.92
        if (rand() > chance) continue
        await prisma.mealMemo.create({
          data: { clientId: c.id, date: toDbDate(addDays(opts.today, d)), slot, text: pool[Math.floor(rand() * pool.length)] },
        })
      }
    }
  }

  if (opts.questionnaire) {
    await prisma.questionnaire.create({
      data: { clientId: c.id, answeredOn: c.joinedOn ?? toDbDate(opts.today), answers: opts.questionnaire as Prisma.InputJsonValue, updatedById: opts.trainerId },
    })
  }
  return c
}

async function seedDemo(trainerId: string | null) {
  if (process.env.SEED_DEMO !== '1') return
  if ((await prisma.client.count()) > 0) return console.log('demo: 顧客がいるため投入しない')
  const today = todayYmd()

  const upper: Lift[] = [
    { part: '胸', name: 'ベンチプレス', from: 30, to: 50, step: 2.5, reps: 10, sets: 3 },
    { part: '背中', name: 'ラットプルダウン（プロネイト）', from: 30, to: 47.5, step: 2.5, reps: 10, sets: 3 },
    { part: '肩', name: 'ダンベルショルダープレス（座位）', from: 6, to: 12, step: 1, reps: 10, sets: 3 },
    { part: '腕', name: 'ケーブルプレスダウン', from: 12.5, to: 25, step: 2.5, reps: 12, sets: 3 },
  ]
  const lower: Lift[] = [
    { part: '脚', name: 'バックスクワット（ハイバー）', from: 30, to: 57.5, step: 2.5, reps: 10, sets: 3 },
    { part: '脚', name: 'ルーマニアンデッドリフト', from: 30, to: 52.5, step: 2.5, reps: 10, sets: 3 },
    { part: '脚', name: 'ブルガリアンスクワット', from: 6, to: 12, step: 1, reps: 10, sets: 3 },
    { part: '体幹', name: 'ケーブルクランチ', from: 15, to: 27.5, step: 2.5, reps: 15, sets: 3 },
  ]

  await createDemoClient({
    seed: 11,
    today,
    trainerId,
    client: {
      memberNo: 'D0001',
      name: 'デモ 太郎',
      kana: 'でも たろう',
      gender: 'male',
      birthDate: toDbDate('1989-05-12'),
      heightCm: 175.5,
      phone: '090-0000-0001',
      email: 'taro@example.com',
      occupation: '会社員（デスクワーク）',
      status: 'active',
      joinedOn: toDbDate(addDays(today, -150)),
      referral: '紹介',
      purposes: ['ダイエット', 'ボディメイク'],
      note: '平日夜（19時以降）の来店が多い。飲み会が週1回程度。',
    },
    body: { fromDay: -150, toDay: 0, ratio: 0.85, w0: 74.2, w1: 67.2, f0: 24.8, f1: 18.1 },
    goals: [
      { day: -150, target: 68, pace: 'normal', activity: 1.2, note: '初回カウンセリングで設定' },
      { day: -35, target: 65, pace: 'gentle', activity: 1.2, note: '68kg目前のため目標を更新。ペースはゆるめに' },
    ],
    sessions: { fromDay: -148, toDay: 0, weekdays: [2, 5], plans: [lower, upper] },
    meals: { days: 10 },
    questionnaire: {
      purposes: ['ダイエット（減量）', 'ボディメイク'],
      goalDetail: '体重を65kgまで落として、お腹まわりをすっきりさせたい',
      deadline: '半年後の健康診断',
      underTreatment: 'なし',
      history: ['脂質異常症'],
      historyDetail: '健康診断で指摘（服薬なし）',
      surgery: 'なし',
      medication: 'なし',
      allergy: 'なし',
      doctorRestriction: 'なし',
      chestSymptom: 'なし',
      currentPain: 'あり',
      [detailKey('currentPain')]: '腰（右）。長く座ったあとに張る感じ。強さ3/10',
      pastInjury: 'なし',
      exerciseHabit: 'なし',
      sportsHistory: '学生時代にサッカー',
      weightTraining: '少しある',
      workStyle: 'デスクワーク中心',
      sleepHours: '5〜6時間',
      sleepQuality: 'ふつう',
      alcohol: '週1〜3回',
      smoking: '吸わない',
      stress: 'ふつう',
      mealsPerDay: '3回',
      breakfast: 'ときどき食べる',
      eatingOut: '週4〜6回',
      snacking: 'ときどき',
    },
  })

  await createDemoClient({
    seed: 22,
    today,
    trainerId,
    client: {
      memberNo: 'D0002',
      name: 'デモ 花子',
      kana: 'でも はなこ',
      gender: 'female',
      birthDate: toDbDate('1983-11-03'),
      heightCm: 158.2,
      phone: '090-0000-0002',
      occupation: '看護師',
      status: 'active',
      joinedOn: toDbDate(addDays(today, -90)),
      referral: 'Instagram',
      purposes: ['ダイエット', '姿勢改善'],
    },
    body: { fromDay: -90, toDay: 0, ratio: 0.7, w0: 61.8, w1: 58.9, f0: 31.5, f1: 29.0 },
    goals: [{ day: -90, target: 56, pace: 'normal', activity: 1.5, note: '初回カウンセリングで設定' }],
    sessions: {
      fromDay: -88,
      toDay: 0,
      weekdays: [6],
      plans: [
        [
          { part: '脚', name: 'ワイドスタンススクワット', from: 10, to: 25, step: 2.5, reps: 12, sets: 3 },
          { part: '脚', name: 'ヒップリフト', from: 10, to: 30, step: 2.5, reps: 15, sets: 3 },
          { part: '背中', name: 'ラットプルダウン（パラレルグリップ）', from: 15, to: 27.5, step: 2.5, reps: 12, sets: 3 },
          { part: '胸', name: 'ベンチプレス（ダンベル）', from: 4, to: 8, step: 1, reps: 12, sets: 3 },
          { part: '肩', name: 'サイドレイズ', from: 2, to: 4, step: 0.5, reps: 15, sets: 3 },
        ],
      ],
    },
    meals: { days: 7 },
    questionnaire: {
      purposes: ['ダイエット（減量）', '姿勢改善', '肩こり・腰痛の改善'],
      goalDetail: '夜勤があっても続けられる形で、体重を56kgにしたい。猫背を直したい',
      underTreatment: 'なし',
      surgery: 'なし',
      medication: 'なし',
      allergy: 'あり',
      [detailKey('allergy')]: 'えび・かに',
      doctorRestriction: 'なし',
      chestSymptom: 'なし',
      pregnancy: 'なし',
      currentPain: 'あり',
      [detailKey('currentPain')]: '首から肩にかけてのこり。強さ4/10',
      pastInjury: 'あり',
      [detailKey('pastInjury')]: '右足首の捻挫（5年前）。今は痛みなし',
      exerciseHabit: '月に数回',
      exerciseDetail: 'ヨガ',
      weightTraining: 'なし',
      workStyle: '立ち仕事中心',
      sleepHours: '5時間未満',
      sleepQuality: 'よくない',
      alcohol: '月に数回',
      smoking: '吸わない',
      stress: '多い',
      mealsPerDay: '3回',
      breakfast: '毎日食べる',
      eatingOut: '週1〜3回',
      snacking: 'ほぼ毎日',
      foodRestriction: 'えび・かに（アレルギー）',
    },
  })

  await createDemoClient({
    seed: 33,
    today,
    trainerId,
    client: {
      memberNo: 'D0003',
      name: 'デモ 次郎',
      kana: 'でも じろう',
      gender: 'male',
      birthDate: toDbDate('1996-02-20'),
      heightCm: 170.0,
      status: 'trial',
      referral: 'Web検索',
      purposes: ['ダイエット'],
      note: '本日体験。入会を検討中',
    },
    body: { fromDay: 0, toDay: 0, ratio: 1, w0: 78.4, w1: 78.4, f0: 26.1, f1: 26.1 },
    goals: [{ day: 0, target: 70, pace: 'normal', activity: 1.5, note: '体験時に設定' }],
  })

  await createDemoClient({
    seed: 44,
    today,
    trainerId,
    client: {
      memberNo: 'D0004',
      name: 'デモ 美咲',
      kana: 'でも みさき',
      gender: 'female',
      birthDate: toDbDate('1991-07-08'),
      heightCm: 162.0,
      status: 'paused',
      joinedOn: toDbDate(addDays(today, -210)),
      referral: 'Googleマップ',
      purposes: ['健康維持', '筋力アップ'],
      note: '仕事の繁忙期のため休会中（再開予定は来月）',
    },
    body: { fromDay: -210, toDay: -100, ratio: 0.45, w0: 66.0, w1: 64.8, f0: 33.0, f1: 31.6 },
    goals: [{ day: -210, target: 60, pace: 'gentle', activity: 1.5 }],
    sessions: {
      fromDay: -205,
      toDay: -100,
      weekdays: [3],
      plans: [
        [
          { part: '脚', name: 'ゴブレットスクワット', from: 8, to: 14, step: 1, reps: 12, sets: 3 },
          { part: '背中', name: 'シーテッドロウイング', from: 15, to: 25, step: 2.5, reps: 12, sets: 3 },
          { part: '体幹', name: 'クランチ', from: 0, to: 0, step: 1, reps: 20, sets: 3 },
        ],
      ],
    },
  })
  console.log('demo: 4人を作成')
}

/**
 * デモ顧客の会話メモ（SEED_DEMO=1 のとき。会話メモがまだないデモ顧客にだけ入れるので、
 * すでに動いているデモ環境にもあとから入れられる）
 */
async function seedDemoTalk(trainerId: string | null) {
  if (process.env.SEED_DEMO !== '1') return
  const today = todayYmd()
  const notes: Record<string, Array<[number, string, string]>> = {
    'デモ 太郎': [
      [-140, 'talk', '飲み会が週1回あり、つい食べすぎてしまうのが悩み。まずは飲み会の翌日の食事を整えるところから'],
      [-98, 'change', 'ベルトの穴が1つ縮んだと、うれしそうに話していた'],
      [-70, 'negative', '仕事が忙しく「今月は続けられるか不安」と話していた。週1回でも来られる曜日を一緒に確認'],
      [-45, 'good', '会社の健康診断でLDLコレステロールが下がっていた'],
      [-21, 'body', '右ひざに少し違和感。スクワットは浅めにして様子を見る'],
      [-10, 'change', '階段で息が切れにくくなった。朝の通勤が楽になったとのこと'],
      [-3, 'talk', '来月、家族で沖縄旅行。それまでにお腹まわりをすっきりさせたい'],
    ],
    'デモ 花子': [
      [-85, 'talk', '夜勤明けは甘いものが欲しくなる。夜勤明けの食事の選び方を一緒に考えた'],
      [-60, 'body', '首から肩のこりが強い日（4/10）。ストレッチを多めに'],
      [-40, 'change', '同僚に「姿勢が良くなったね」と言われた'],
      [-25, 'negative', '体重が思うように落ちず落ち込み気味。体脂肪率は下がっていることを一緒に確認した'],
      [-8, 'good', '仕事終わりに階段を使うようになった。自分から始めたとのこと'],
    ],
    'デモ 次郎': [
      [0, 'talk', '体験の感想：思っていたよりきつくなく、続けられそうとのこと'],
      [0, 'negative', '以前ほかのジムを3ヶ月でやめた経験あり。「今度こそ続けたい」と話していた'],
    ],
    'デモ 美咲': [
      [-180, 'talk', '在宅勤務で1日の歩数が3,000歩ほど。まずは散歩の習慣から'],
      [-130, 'good', '前より疲れにくくなって、週末に出かけるのが楽しくなった'],
      [-105, 'negative', '繁忙期で来月は来られそうにない。休会を相談された'],
    ],
  }
  for (const [name, rows] of Object.entries(notes)) {
    const c = await prisma.client.findFirst({ where: { name }, select: { id: true } })
    if (!c || (await prisma.talkNote.count({ where: { clientId: c.id } })) > 0) continue
    for (const [day, kind, text] of rows) {
      await prisma.talkNote.create({ data: { clientId: c.id, date: toDbDate(addDays(today, day)), kind, text, createdById: trainerId } })
    }
    console.log(`talk: ${name} ${rows.length}件`)
  }
}

/**
 * デモ顧客の手書きメモの見本（SEED_DEMO=1 のとき）。prisma/seed-data/demo-memos.json（作り方は scripts/gen-demo-memos.py）。
 * 手書きメモがまだ1件もないデモ顧客にだけ、種目の記録がある新しい回から順に入れる（下半身の日・上半身の日に合わせる）
 */
async function seedDemoMemos(trainerId: string | null) {
  if (process.env.SEED_DEMO !== '1') return
  const memos: Array<{ client: string; match: 'upper' | 'lower' | 'any'; data: unknown }> = JSON.parse(readFileSync(new URL('./seed-data/demo-memos.json', import.meta.url), 'utf8'))
  const byClient = new Map<string, typeof memos>()
  for (const m of memos) byClient.set(m.client, [...(byClient.get(m.client) ?? []), m])
  for (const [name, list] of byClient) {
    const c = await prisma.client.findFirst({ where: { name }, select: { id: true } })
    if (!c || (await prisma.sessionDrawing.count({ where: { session: { clientId: c.id } } })) > 0) continue
    const sessions = await prisma.trainingSession.findMany({
      where: { clientId: c.id, sets: { some: {} } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: { sets: { select: { bodyPart: true } } },
    })
    const used = new Set<string>()
    for (const m of list) {
      const s = sessions.find((x) => !used.has(x.id) && (m.match === 'any' || (m.match === 'lower') === x.sets.some((r) => r.bodyPart === '脚')))
      if (!s) continue
      used.add(s.id)
      const data = parseDrawing(m.data)
      const thumb = drawingThumb(data) ?? undefined
      await prisma.sessionDrawing.create({
        data: { sessionId: s.id, data: data as unknown as Prisma.InputJsonValue, thumb: thumb as unknown as Prisma.InputJsonValue, updatedById: trainerId },
      })
    }
    console.log(`memo: ${name} ${used.size}件`)
  }
}

/**
 * デモでお知らせを見られるようにする（SEED_DEMO=1 のとき1回だけ。AppSetting "demo:alerts" に印を残す）
 * - 花子さん：直近20日の体重を横ばいに（停滞）、週ごとの食事の数字をほぼ同じに（食事の変化なし）、気になる会話メモ
 * - 太郎さん：週ごとの食事の数字（変化あり）
 * - 自分で作るお知らせの見本
 */
async function seedDemoAlerts(trainerId: string | null) {
  if (process.env.SEED_DEMO !== '1') return
  if (await prisma.appSetting.findUnique({ where: { key: 'demo:alerts' } })) return
  const today = todayYmd()
  const find = (name: string) => prisma.client.findFirst({ where: { name }, select: { id: true } })
  const [hanako, taro, misaki] = await Promise.all([find('デモ 花子'), find('デモ 太郎'), find('デモ 美咲')])
  if (!hanako || !taro) return console.log('alerts: デモ顧客がいないため投入しない')

  // 花子さん：停滞（直近20日の体重を、それより前の最低体重より少し上で横ばいに。最近の記録も足す）
  const logs = await prisma.bodyLog.findMany({ where: { clientId: hanako.id, weightKg: { not: null }, date: { gte: toDbDate(addDays(today, -90)) } }, orderBy: { date: 'asc' } })
  const cut = addDays(today, -20)
  const before = logs.filter((l) => fromDbDate(l.date) < cut).map((l) => l.weightKg!)
  if (before.length) {
    const floor = Math.min(...before)
    const rand = rng(77)
    const flat = () => Math.round((floor + 0.2 + rand() * 0.5) * 10) / 10
    for (const l of logs.filter((x) => fromDbDate(x.date) >= cut)) await prisma.bodyLog.update({ where: { id: l.id }, data: { weightKg: flat() } })
    for (const d of [-3, -1]) {
      const date = toDbDate(addDays(today, d))
      await prisma.bodyLog.upsert({ where: { clientId_date: { clientId: hanako.id, date } }, update: { weightKg: flat() }, create: { clientId: hanako.id, date, weightKg: flat() } })
    }
  }

  // 週ごとの食事の数字（先週から3週分）
  const week = (i: number) => toDbDate(addDays(weekStartOf(today), -7 * i))
  const put = async (clientId: string, rows: Array<[number, number, number, number, number, number]>) => {
    for (const [i, targetKcal, avgKcal, proteinG, fatG, carbsG] of rows) {
      const weekStart = week(i)
      await prisma.nutritionWeek.upsert({ where: { clientId_weekStart: { clientId, weekStart } }, update: {}, create: { clientId, weekStart, targetKcal, avgKcal, proteinG, fatG, carbsG, updatedById: trainerId } })
    }
  }
  await put(hanako.id, [
    [3, 1600, 1735, 80, 57, 210],
    [2, 1600, 1710, 83, 58, 206],
    [1, 1600, 1720, 82, 58, 205],
  ])
  await put(taro.id, [
    [3, 1900, 2150, 120, 70, 240],
    [2, 1900, 1980, 125, 64, 230],
    [1, 1900, 1890, 128, 60, 215],
  ])

  await prisma.talkNote.create({
    data: { clientId: hanako.id, date: toDbDate(addDays(today, -2)), kind: 'negative', text: '体重が落ちなくて焦っていると話していた。体脂肪率は下がっていることを伝えた', createdById: trainerId },
  })

  const reminders: Array<{ clientId: string; text: string; trigger: string; due: Ymd; level: string }> = [
    { clientId: taro.id, text: '体組成（InBody）を測る', trigger: 'next_visit', due: today, level: 'info' },
    { clientId: taro.id, text: '旅行前に目標と減量ペースを見直す', trigger: 'date', due: addDays(today, 5), level: 'info' },
    { clientId: hanako.id, text: '夜勤明けの食事の選び方を資料で渡す', trigger: 'date', due: addDays(today, -1), level: 'warn' },
  ]
  if (misaki) reminders.push({ clientId: misaki.id, text: '休会明けの予定を電話で確認する', trigger: 'date', due: today, level: 'info' })
  for (const r of reminders) {
    await prisma.reminder.create({ data: { clientId: r.clientId, text: r.text, trigger: r.trigger, dueDate: toDbDate(r.due), level: r.level, createdById: trainerId } })
  }

  await prisma.appSetting.create({ data: { key: 'demo:alerts', value: { at: today } } })
  console.log(`alerts: デモのお知らせを用意（自分で作るお知らせ ${reminders.length}件）`)
}

/**
 * デモで月ごとのテーマ・宿題・自律神経の測定を見られるようにする（SEED_DEMO=1 のとき1回だけ。AppSetting "demo:steps" に印を残す）
 * 日付は各お客様の入会日・来店日から決める（デモ顧客を作った日と、この関数を実行した日がずれても合うように）
 * - フェーズは seedDemoPlan で作る
 * - 月ごとのテーマ（来月の分は空けておく）
 * - 宿題：確認待ちと、これまでの結果
 * - 自律神経の測定結果（見本の PDF）を来店日に
 */
async function seedDemoSteps(trainerId: string | null) {
  if (process.env.SEED_DEMO !== '1') return
  if (await prisma.appSetting.findUnique({ where: { key: 'demo:steps' } })) return
  const find = (name: string) => prisma.client.findFirst({ where: { name }, select: { id: true, joinedOn: true } })
  const [taro, hanako] = await Promise.all([find('デモ 太郎'), find('デモ 花子')])
  if (!taro?.joinedOn || !hanako?.joinedOn) return console.log('steps: デモ顧客がいないため投入しない')
  const visits = async (clientId: string) =>
    (await prisma.trainingSession.findMany({ where: { clientId }, orderBy: { date: 'asc' }, select: { date: true } })).map((x) => fromDbDate(x.date))
  /** その日以降で最初の来店日（なければその日） */
  const visitFrom = (list: Ymd[], day: Ymd) => list.find((d) => d >= day) ?? day

  const tj = fromDbDate(taro.joinedOn)
  const hj = fromDbDate(hanako.joinedOn)
  // フェーズは seedDemoPlan で作る（2026-10-04 に「自律神経期・ピラティス期・筋トレ期」から「フェーズ1・フェーズ2」に整理）

  // ── 月ごとのテーマ（入会月から今月まで。古い月から順に）
  const themes = async (clientId: string, joined: Ymd, rows: Array<[string, string]>) => {
    const first = monthKey(joined)
    const now = monthKey(todayYmd())
    for (let i = 0; i < rows.length; i++) {
      const month = addMonthsKey(first, i)
      if (month > now) break
      await prisma.monthlyTheme.create({ data: { clientId, month, theme: rows[i][0], trainingTheme: rows[i][1], updatedById: trainerId } })
    }
  }
  await themes(taro.id, tj, [
    ['睡眠と呼吸を整える', '呼吸と体幹を安定させる'],
    ['朝の過ごし方を整える', '股関節を動かせるようにする'],
    ['座り姿勢を意識して過ごす', 'ピラティスで背骨を動かす'],
    ['食事のリズムを崩さない', '脚の筋力を上げる'],
    ['飲み会の翌日にリセットする', 'スクワットの重さを伸ばす'],
    ['目標65kgに向けて食事を見直す', '背中とお尻の筋力アップ'],
  ])
  await themes(hanako.id, hj, [
    ['夜勤明けの睡眠を確保する', '呼吸と肩まわりをゆるめる'],
    ['寝る前のスマホを減らす', '骨盤まわりを安定させる'],
    ['甘いものとのつきあい方', 'ピラティスで姿勢を整える'],
    ['体重より体脂肪率を見る', 'お尻と背中を使えるようにする'],
  ])

  // ── 宿題（出した日・確認した日は来店日に合わせる）
  const hw = async (clientId: string, list: Ymd[], rows: Array<{ text: string; ago: number; status?: string; note?: string }>) => {
    for (const r of rows) {
      // ago：何回前の来店で出したか（0＝最後の来店）。確認はその次の来店
      const i = Math.max(0, list.length - 1 - r.ago)
      const assignedOn = list[i] ?? todayYmd()
      const checkedOn = r.status ? (list[i + 1] ?? assignedOn) : null
      await prisma.homework.create({
        data: { clientId, text: r.text, assignedOn: toDbDate(assignedOn), status: r.status ?? 'open', checkedOn: checkedOn ? toDbDate(checkedOn) : null, note: r.note ?? null, createdById: trainerId, checkedById: r.status ? trainerId : null },
      })
    }
  }
  const tv = await visits(taro.id)
  const hv = await visits(hanako.id)
  await hw(taro.id, tv, [
    { text: '寝る前の深呼吸 3分', ago: 30, status: 'done' },
    { text: '腸腰筋のストレッチ（左右30秒）', ago: 20, status: 'not_done', note: '仕事が忙しくてできなかった' },
    { text: '1日8000歩', ago: 8, status: 'partial', note: '平日はできた。週末は5000歩くらい' },
    { text: '飲み会の翌朝も体重を測る', ago: 3, status: 'done' },
    { text: 'ヒップヒンジ 10回×2（毎日）', ago: 0 },
  ])
  await hw(hanako.id, hv, [
    { text: '湯船に10分つかる', ago: 14, status: 'done' },
    { text: '寝る前のスマホを30分前にやめる', ago: 9, status: 'partial', note: '夜勤明けの日はできなかった' },
    { text: '階段を使う', ago: 4, status: 'done' },
    { text: '寝る前ストレッチ5分', ago: 0 },
    { text: '夜勤明けは甘いものを1つまで', ago: 0 },
  ])

  // ── 自律神経の測定結果（見本の PDF）。自律神経期のはじめと、最近の来店日に
  const pdf = (n: number) => readFileSync(new URL(`./seed-data/ans-sample-${n}.pdf`, import.meta.url))
  const ans = async (clientId: string, day: Ymd, n: number, note: string) => {
    const data = pdf(n)
    await prisma.ansMeasurement.create({ data: { clientId, measuredOn: toDbDate(day), fileName: `自律神経測定_${day}.pdf`, mimeType: 'application/pdf', size: data.length, data, note, createdById: trainerId } })
  }
  await ans(taro.id, visitFrom(tv, tj), 1, '初回。交感神経が優位')
  if (tv.length) await ans(taro.id, tv[Math.max(0, tv.length - 2)], 2, '前回より副交感神経の値が上がった')
  await ans(hanako.id, visitFrom(hv, hj), 1, '初回。夜勤明けで疲労感が強い')
  if (hv.length) await ans(hanako.id, hv[hv.length - 1], 2, 'ピラティス期に入ってからの再測定')

  await prisma.appSetting.create({ data: { key: 'demo:steps', value: { at: todayYmd() } } })
  console.log('steps: デモのテーマ・宿題・自律神経の測定結果を用意')
}

const TARO_STRENGTH_NOTE = 'ピラティスで姿勢と体幹が安定してきたので、筋トレを増やす'

/** デモの記録に入れる「種目の目的」（種目名 → 目的。目的は初期の選択肢の名前） */
const DEMO_PURPOSES: Record<string, string> = {
  ベンチプレス: '筋力アップ',
  'ラットプルダウン（プロネイト）': '姿勢を整える',
  'ダンベルショルダープレス（座位）': '筋力アップ',
  ケーブルプレスダウン: 'ボディメイク',
  'バックスクワット（ハイバー）': '筋力アップ',
  ルーマニアンデッドリフト: '痛みの予防・改善',
  ブルガリアンスクワット: '筋力アップ',
  ケーブルクランチ: '体幹を安定させる',
  ワイドスタンススクワット: '脂肪燃焼',
  ヒップリフト: '姿勢を整える',
  'ラットプルダウン（パラレルグリップ）': '姿勢を整える',
  'ベンチプレス（ダンベル）': 'ボディメイク',
  サイドレイズ: 'ボディメイク',
  ゴブレットスクワット: '筋力アップ',
  シーテッドロウイング: '姿勢を整える',
  クランチ: '体幹を安定させる',
}

/**
 * デモで「種目の目的」を見られるようにする（SEED_DEMO=1 のとき1回だけ。AppSetting "demo:purposes" に印を残す）
 * - デモで使う種目に、種目マスタの「いつもの目的」を入れる（まだ入っていないものだけ）
 * - デモ顧客のこれまでの記録に目的を入れる（まだ入っていないものだけ）
 * - 前のデモの「筋力アップ期」を「筋トレ期」に（京角さんの流れ：自律神経 → ピラティス → 筋トレ）
 */
async function seedDemoPurposes() {
  if (process.env.SEED_DEMO !== '1') return
  if (await prisma.appSetting.findUnique({ where: { key: 'demo:purposes' } })) return
  const options = normalizePurposes((await prisma.appSetting.findUnique({ where: { key: 'purposes' } }))?.value)
  let master = 0
  let records = 0
  for (const [exercise, purpose] of Object.entries(DEMO_PURPOSES)) {
    if (!options.includes(purpose)) continue
    master += (await prisma.exercise.updateMany({ where: { name: exercise, purpose: null }, data: { purpose } })).count
    records += (await prisma.trainingSet.updateMany({ where: { exercise, purpose: null, session: { client: { name: { startsWith: 'デモ ' } } } }, data: { purpose } })).count
  }
  const renamed = await prisma.clientPhase.updateMany({ where: { name: '筋力アップ期', client: { name: 'デモ 太郎' } }, data: { name: '筋トレ期', note: TARO_STRENGTH_NOTE } })
  await prisma.appSetting.create({ data: { key: 'demo:purposes', value: { at: todayYmd() } } })
  console.log(`purposes: 種目マスタ ${master}件・記録 ${records}件に目的を入れた（期の名前の変更 ${renamed.count}件）`)
}

/**
 * デモで指導計画を見られるようにする（SEED_DEMO=1 のとき1回だけ。AppSetting "demo:plan" に印を残す。2026-10-04 の整理）
 * 日付は各お客様の入会日・来店日から決める。「今日」から決めるもの（見直し予定日など）は、この関数を実行した日が基準。
 * - フェーズ：前のデモの「自律神経期・ピラティス期・筋トレ期」を消して、フェーズ1・フェーズ2で作り直す（理由・来店頻度・見直し予定日つき）
 *   太郎さん フェーズ1→フェーズ2（減量）／花子さん フェーズ1（回復食→バランス食）／美咲さん 休会前までフェーズ1
 * - 食事方針：前の目標に方針を入れ、方針を変えた日を足す
 * - 自律神経の測定に、活性度の数値・位置・型（仮）を入れる（太郎さんは途中の測定も足す）
 * - 動作の評価・体調チェック・体重の評価
 * - 太郎さん：直近の体重を横ばいにして「体重の停滞」（減量中）の見本に
 * - 由美さん（新しいデモ顧客）：コーフラックスの終了予定日を過ぎている見本
 */
async function seedDemoPlan(trainerId: string | null) {
  if (process.env.SEED_DEMO !== '1') return
  if (await prisma.appSetting.findUnique({ where: { key: 'demo:plan' } })) return
  const today = todayYmd()
  const find = (name: string) => prisma.client.findFirst({ where: { name }, select: { id: true, joinedOn: true } })
  const [taro, hanako, misaki] = await Promise.all([find('デモ 太郎'), find('デモ 花子'), find('デモ 美咲')])
  if (!taro?.joinedOn || !hanako?.joinedOn) return console.log('plan: デモ顧客がいないため投入しない')
  const visits = async (clientId: string) =>
    (await prisma.trainingSession.findMany({ where: { clientId }, orderBy: { date: 'asc' }, select: { date: true } })).map((x) => fromDbDate(x.date))
  /** その日以降で最初の来店日（なければその日。今日より後にはしない） */
  const visitFrom = (list: Ymd[], day: Ymd) => {
    const d = list.find((x) => x >= day) ?? day
    return d > today ? today : d
  }
  const weightOn = async (clientId: string, day: Ymd) =>
    (await prisma.bodyLog.findFirst({ where: { clientId, date: { lte: toDbDate(day) }, weightKg: { not: null } }, orderBy: { date: 'desc' } }))?.weightKg ?? null
  const pdf = (n: number) => readFileSync(new URL(`./seed-data/ans-sample-${n}.pdf`, import.meta.url))
  const by = trainerId

  type PhaseDemo = { name: string; start: Ymd; end?: Ymd | null; review?: Ymd | null; freq?: string; note: string }
  const phases = async (clientId: string, rows: PhaseDemo[]) => {
    await prisma.clientPhase.deleteMany({ where: { clientId } })
    for (const r of rows)
      await prisma.clientPhase.create({
        data: { clientId, name: r.name, startDate: toDbDate(r.start), endDate: r.end ? toDbDate(r.end) : null, reviewDate: r.review ? toDbDate(r.review) : null, visitFrequency: r.freq ?? null, note: r.note, createdById: by },
      })
  }
  type PolicyDemo = { policy: string; start: Ymd; target?: number | null; pace?: string | null; activity?: number | null; targetDate?: Ymd | null; endDate?: Ymd | null; review?: Ymd | null; note: string }
  const addPolicy = async (clientId: string, r: PolicyDemo) =>
    prisma.goal.create({
      data: {
        clientId,
        startDate: toDbDate(r.start),
        policy: r.policy,
        startWeightKg: await weightOn(clientId, r.start),
        targetWeightKg: r.target ?? null,
        paceKey: r.pace ?? null,
        activityFactor: r.activity ?? null,
        targetDate: r.targetDate ? toDbDate(r.targetDate) : null,
        endDate: r.endDate ? toDbDate(r.endDate) : null,
        reviewDate: r.review ? toDbDate(r.review) : null,
        note: r.note,
        createdById: by,
      },
    })
  type Ans = { s: number; sl: string; p: number; pl: string; type?: string | null; note: string }
  const ansData = (a: Ans) => ({ sympathetic: a.s, sympatheticLevel: a.sl, parasympathetic: a.p, parasympatheticLevel: a.pl, ansType: a.type ?? null, note: a.note })
  const addAns = async (clientId: string, day: Ymd, n: number, a: Ans) => {
    const data = pdf(n)
    await prisma.ansMeasurement.create({ data: { clientId, measuredOn: toDbDate(day), fileName: `自律神経測定_${day}.pdf`, mimeType: 'application/pdf', size: data.length, data, createdById: by, ...ansData(a) } })
  }
  const move = (clientId: string, date: Ymd, movement: string, status: string, checks?: Record<string, string>, note?: string) =>
    prisma.movementCheck.create({ data: { clientId, date: toDbDate(date), movement, status, checks: checks ?? undefined, note: note ?? null, createdById: by } })
  const cond = (clientId: string, date: Ymd, items: Record<string, string>, painArea?: string, note?: string) =>
    prisma.conditionCheck.upsert({
      where: { clientId_date: { clientId, date: toDbDate(date) } },
      update: { items, painArea: painArea ?? null, note: note ?? null },
      create: { clientId, date: toDbDate(date), items, painArea: painArea ?? null, note: note ?? null, createdById: by },
    })

  // ── 太郎さん：フェーズ1（回復食→バランス食）→ フェーズ2（減量）
  const tj = fromDbDate(taro.joinedOn)
  const tv = await visits(taro.id)
  const t2 = addDays(tj, 105)
  await phases(taro.id, [
    { name: 'フェーズ1', start: tj, freq: '週2回', note: '睡眠5〜6時間・デスクワークで肩が上がりやすい。交感神経が高く、副交感神経が低い。まず体を整える' },
    { name: 'フェーズ2', start: t2, freq: '週2回', review: addDays(today, 21), note: '自律神経が2回続けて両方基準内。屈曲・伸展ができるようになり、肩の痛みもないので筋トレ中心へ' },
  ])
  const tGoals = await prisma.goal.findMany({ where: { clientId: taro.id }, orderBy: { startDate: 'asc' } })
  const tTargetDate = addDays(tj, 180)
  if (tGoals[0])
    await prisma.goal.update({ where: { id: tGoals[0].id }, data: { policy: 'recovery', paceKey: null, reviewDate: toDbDate(addDays(tj, 21)), targetDate: toDbDate(tTargetDate), note: '夜遅い食事と飲み会で胃腸が疲れている。まず消化にやさしい食事から' } })
  for (const g of tGoals.slice(1)) await prisma.goal.update({ where: { id: g.id }, data: { policy: 'loss', targetDate: toDbDate(tTargetDate) } })
  await addPolicy(taro.id, { policy: 'balance', start: addDays(tj, 28), target: 68, activity: 1.2, targetDate: tTargetDate, note: '胃腸の調子が戻ったので、バランス食へ' })
  await addPolicy(taro.id, { policy: 'loss', start: t2, target: 68, pace: 'normal', activity: 1.2, targetDate: tTargetDate, note: 'フェーズ2へ。半年後の健康診断に向けて68kgまで減量（ペースは普通）' })

  // 自律神経：初回（交感神経が高い・副交感神経が低い）→ 途中 → フェーズ2の前に2回続けて両方基準内 → 最近
  const tAns = await prisma.ansMeasurement.findMany({ where: { clientId: taro.id }, orderBy: { measuredOn: 'asc' } })
  if (tAns[0]) await prisma.ansMeasurement.update({ where: { id: tAns[0].id }, data: ansData({ s: 8.1, sl: 'high', p: 4.3, pl: 'low', type: 'A', note: '初回。交感神経が高く、副交感神経が低い。寝つきが悪く、肩が上がりやすい' }) })
  if (tAns.length > 1) await prisma.ansMeasurement.update({ where: { id: tAns[tAns.length - 1].id }, data: ansData({ s: 6.9, sl: 'normal', p: 6.2, pl: 'normal', note: '両方基準内。良い状態を保てている' }) })
  await addAns(taro.id, visitFrom(tv, addDays(tj, 70)), 2, { s: 7.6, sl: 'normal', p: 4.9, pl: 'low', type: 'B', note: '交感神経は基準内に。副交感神経はまだ低い' })
  await addAns(taro.id, visitFrom(tv, addDays(tj, 98)), 1, { s: 7.0, sl: 'normal', p: 5.7, pl: 'normal', note: '両方基準内。睡眠が6.5時間まで伸びた' })

  // 動作：6つとも達成してフェーズ2へ（前の段階に戻った記録も1つ）
  const tAt = (d: number) => visitFrom(tv, addDays(tj, d))
  await move(taro.id, tAt(7), 'imprint', 'practicing')
  await move(taro.id, tAt(21), 'imprint', 'achieved')
  await move(taro.id, tAt(14), 'flexion', 'practicing', { heel: 'つかない' })
  await move(taro.id, tAt(49), 'flexion', 'practicing', { heel: 'つかない' }, 'パイクアップは上がるようになった')
  await move(taro.id, tAt(70), 'flexion', 'achieved', { heel: 'つく' })
  await move(taro.id, tAt(28), 'extension', 'practicing', { backPain: 'なし', returning: 'むずかしい' })
  await move(taro.id, tAt(56), 'extension', 'achieved', { backPain: 'なし', returning: 'できる' })
  await move(taro.id, tAt(63), 'extension', 'practicing', { backPain: 'なし', returning: 'むずかしい' }, '飲み会続きで戻る動きが崩れた。一つ前に戻して確認')
  await move(taro.id, tAt(77), 'extension', 'achieved', { backPain: 'なし', returning: 'できる' })
  await move(taro.id, tAt(63), 'antiGravity', 'practicing', { pain: 'なし', motion: '1段階目まで' })
  await move(taro.id, tAt(91), 'antiGravity', 'achieved', { pain: 'なし', motion: '2段階目まで楽に上がる' })
  await move(taro.id, tAt(84), 'lateral', 'practicing', { left: 'achieved', right: 'practicing' })
  await move(taro.id, tAt(98), 'lateral', 'achieved', { left: 'achieved', right: 'achieved' })
  await move(taro.id, tAt(84), 'rotation', 'practicing', { sideDiff: '大きい', ease: '右を向きにくい' })
  await move(taro.id, tAt(98), 'rotation', 'achieved', { sideDiff: '小さい', ease: '右も向きやすくなった' })

  // 体調：初回の訴え → よくなっていく
  await cond(taro.id, visitFrom(tv, tj), { fatigue: 'strong', pain: 'mild', malaise: 'none', postMeal: 'strong', sleep: 'strong' }, '肩・首', '夕方に疲れが出る。昼食後に眠くなる。寝つきが悪い')
  await cond(taro.id, tAt(49), { fatigue: 'mild', pain: 'mild', malaise: 'none', postMeal: 'mild', sleep: 'mild' }, '肩')
  await cond(taro.id, tAt(98), { fatigue: 'none', pain: 'none', malaise: 'none', postMeal: 'none', sleep: 'mild' })
  if (tv.length) await cond(taro.id, tv[tv.length - 1], { fatigue: 'none', pain: 'none', malaise: 'none', postMeal: 'none', sleep: 'none' }, undefined, '旅行の準備で忙しいが、疲れは残っていない')

  // 体重：直近18日を横ばいに（減量中の「体重の停滞」の見本）
  const tLogs = await prisma.bodyLog.findMany({ where: { clientId: taro.id, weightKg: { not: null }, date: { gte: toDbDate(addDays(today, -90)) } }, orderBy: { date: 'asc' } })
  const cut = addDays(today, -18)
  const tBefore = tLogs.filter((l) => fromDbDate(l.date) < cut).map((l) => l.weightKg!)
  if (tBefore.length) {
    const floor = Math.min(...tBefore)
    const rand = rng(91)
    const flat = () => Math.round((floor + 0.2 + rand() * 0.4) * 10) / 10
    for (const l of tLogs.filter((x) => fromDbDate(x.date) >= cut)) await prisma.bodyLog.update({ where: { id: l.id }, data: { weightKg: flat() } })
    for (const d of [-7, 0]) {
      const date = toDbDate(addDays(today, d))
      await prisma.bodyLog.upsert({ where: { clientId_date: { clientId: taro.id, date } }, update: { weightKg: flat() }, create: { clientId: taro.id, date, weightKg: flat() } })
    }
  }
  await prisma.weightReview.create({ data: { clientId: taro.id, date: toDbDate(addDays(today, -30)), verdict: 'expected', reason: '週0.5%前後で減っている。想定内', createdById: by } })
  await prisma.weightReview.create({ data: { clientId: taro.id, date: toDbDate(addDays(today, -1)), verdict: 'review', reason: '旅行前で外食が増え、2週間ほど最低体重を更新していない。食事の記録を見直す', createdById: by } })

  // ── 花子さん：フェーズ1（回復食 → バランス食）。移行チェックの見本（副交感神経がまだ低い・屈曲は練習中）
  const hj = fromDbDate(hanako.joinedOn)
  const hv = await visits(hanako.id)
  const hAt = (d: number) => visitFrom(hv, addDays(hj, d))
  await phases(hanako.id, [{ name: 'フェーズ1', start: hj, freq: '週1回', review: addDays(today, 14), note: '夜勤で睡眠が乱れやすい。交感神経・副交感神経がどちらも低く、疲れが強い' }])
  const hGoals = await prisma.goal.findMany({ where: { clientId: hanako.id }, orderBy: { startDate: 'asc' } })
  if (hGoals[0]) await prisma.goal.update({ where: { id: hGoals[0].id }, data: { policy: 'recovery', paceKey: null, reviewDate: toDbDate(addDays(hj, 28)), note: '夜勤明けで疲れが強く、食事が不規則。まず回復食から' } })
  await addPolicy(hanako.id, { policy: 'balance', start: hAt(35), target: 56, activity: 1.5, review: addDays(today, 10), note: '胃腸の調子が整ってきたので、バランス食へ' })
  const hAns = await prisma.ansMeasurement.findMany({ where: { clientId: hanako.id }, orderBy: { measuredOn: 'asc' } })
  if (hAns[0]) await prisma.ansMeasurement.update({ where: { id: hAns[0].id }, data: ansData({ s: 4.4, sl: 'low', p: 4.1, pl: 'low', type: 'C', note: '初回。夜勤明けで疲労感が強い。どちらも低い' }) })
  if (hAns.length > 1) await prisma.ansMeasurement.update({ where: { id: hAns[hAns.length - 1].id }, data: ansData({ s: 7.68, sl: 'normal', p: 4.96, pl: 'low', type: 'B', note: '交感神経は基準内に。副交感神経はまだ低い。夜勤明けの疲れは減ってきた' }) })
  await move(hanako.id, hAt(7), 'imprint', 'practicing')
  await move(hanako.id, hAt(28), 'imprint', 'achieved')
  await move(hanako.id, hAt(21), 'flexion', 'practicing', { heel: 'つかない' })
  if (hv.length) await move(hanako.id, hv[hv.length - 1], 'flexion', 'practicing', { heel: 'つかない' }, 'パイクアップは補助ありで上がる')
  await move(hanako.id, hAt(42), 'extension', 'practicing', { backPain: 'なし', returning: 'むずかしい' })
  await cond(hanako.id, visitFrom(hv, hj), { fatigue: 'strong', pain: 'mild', malaise: 'mild', postMeal: 'strong', sleep: 'strong' }, '首・肩', '夜勤明けは一日中だるい。冷えもある')
  await cond(hanako.id, hAt(42), { fatigue: 'mild', pain: 'mild', malaise: 'mild', postMeal: 'mild', sleep: 'strong' }, '首')
  if (hv.length) await cond(hanako.id, hv[hv.length - 1], { fatigue: 'mild', pain: 'none', malaise: 'none', postMeal: 'none', sleep: 'mild' }, undefined, '夜勤明けの疲れが前より軽い')
  await prisma.weightReview.create({ data: { clientId: hanako.id, date: toDbDate(addDays(today, -2)), verdict: 'hold', reason: 'フェーズ1で体を整えている段階。体重より体調と体脂肪率を見る', createdById: by } })

  // ── 美咲さん：休会前までフェーズ1
  if (misaki?.joinedOn) {
    const mj = fromDbDate(misaki.joinedOn)
    const mv = await visits(misaki.id)
    await phases(misaki.id, [{ name: 'フェーズ1', start: mj, end: mv[mv.length - 1] ?? addDays(mj, 110), freq: '週1回', note: '在宅勤務で活動量が少ない。まず生活リズムから（休会のため、いったん終了）' }])
    await prisma.goal.updateMany({ where: { clientId: misaki.id }, data: { policy: 'balance', paceKey: null } })
  }

  // ── 由美さん（新しいデモ顧客）：フェーズ1 → フェーズ2（コーフラックス）。終了予定日を5日過ぎている
  if (!(await prisma.client.findFirst({ where: { name: 'デモ 由美' } }))) {
    await createDemoClient({
      seed: 55,
      today,
      trainerId,
      client: {
        memberNo: 'D0005',
        name: 'デモ 由美',
        kana: 'でも ゆみ',
        gender: 'female',
        birthDate: toDbDate('1990-11-03'),
        heightCm: 158.0,
        status: 'active',
        joinedOn: toDbDate(addDays(today, -120)),
        referral: 'Instagram',
        purposes: ['ボディメイク', '健康維持'],
        note: '1,200kcal前後の食事で体重が止まっていた。食べる量を増やすことに不安がある',
      },
      body: { fromDay: -120, toDay: 0, ratio: 0.75, w0: 52.6, w1: 52.2, f0: 29.6, f1: 27.9 },
      goals: [{ day: -120, target: 50, pace: 'gentle', activity: 1.5, note: '初回カウンセリング' }],
      sessions: {
        fromDay: -118,
        toDay: -1,
        weekdays: [3, 6],
        plans: [
          [
            { part: '脚', name: 'ヒップリフト', from: 0, to: 0, step: 1, reps: 15, sets: 3 },
            { part: '脚', name: 'ゴブレットスクワット', from: 4, to: 10, step: 1, reps: 12, sets: 3 },
            { part: '背中', name: 'ラットプルダウン（パラレルグリップ）', from: 12.5, to: 22.5, step: 2.5, reps: 12, sets: 3 },
          ],
        ],
      },
      meals: { days: 7 },
      questionnaire: {
        purposes: ['ボディメイク', '健康維持・体力向上'],
        goalDetail: '食べる量を増やしても太らない体にしたい。疲れにくくなりたい',
        underTreatment: 'なし',
        surgery: 'なし',
        exerciseHabit: '月に数回',
        stress: 'ふつう',
      },
    })
    const yumi = await prisma.client.findFirst({ where: { name: 'デモ 由美' }, select: { id: true } })
    if (yumi) {
      const yv = await visits(yumi.id)
      const yAt = (d: number) => visitFrom(yv, addDays(today, d))
      const y2 = addDays(today, -63)
      await phases(yumi.id, [
        { name: 'フェーズ1', start: addDays(today, -120), freq: '週2回', note: '1,200kcalで体重が止まり、疲れやすい。交感神経・副交感神経がどちらも低い' },
        { name: 'フェーズ2', start: y2, freq: '週2回', note: '自律神経が両方基準内に。屈曲・伸展ができるようになったので、筋トレとコーフラックスへ' },
      ])
      const yGoal = await prisma.goal.findFirst({ where: { clientId: yumi.id }, orderBy: { startDate: 'asc' } })
      const yTarget = addDays(today, 240)
      if (yGoal) await prisma.goal.update({ where: { id: yGoal.id }, data: { policy: 'recovery', paceKey: null, reviewDate: toDbDate(addDays(today, -92)), targetDate: toDbDate(yTarget), note: '食事量が少なく、胃腸も弱い。まず回復食から' } })
      await addPolicy(yumi.id, { policy: 'balance', start: addDays(today, -91), target: 50, activity: 1.5, targetDate: yTarget, note: '3食とれるようになったので、バランス食へ' })
      await addPolicy(yumi.id, {
        policy: 'reverse',
        start: y2,
        target: 50,
        activity: 1.5,
        targetDate: yTarget,
        endDate: addDays(today, -5),
        note: '1,200kcalで体重が止まっていたので、体重を増やさずに1,700kcalまで上げてから減量へ',
      })
      await addAns(yumi.id, yAt(-118), 1, { s: 4.2, sl: 'low', p: 4.0, pl: 'low', type: 'C', note: '初回。どちらも低い。疲れやすく、手足が冷える' })
      await addAns(yumi.id, yAt(-66), 2, { s: 6.6, sl: 'normal', p: 5.9, pl: 'normal', note: '両方基準内' })
      for (const [d, mv, st, checks] of [
        [-110, 'imprint', 'achieved', undefined],
        [-100, 'flexion', 'practicing', { heel: 'つかない' }],
        [-75, 'flexion', 'achieved', { heel: 'つく' }],
        [-90, 'extension', 'achieved', { backPain: 'なし', returning: 'できる' }],
        [-80, 'antiGravity', 'achieved', { pain: 'なし' }],
        [-70, 'lateral', 'achieved', { left: 'achieved', right: 'achieved' }],
        [-70, 'rotation', 'achieved', { sideDiff: 'なし' }],
      ] as Array<[number, string, string, Record<string, string> | undefined]>)
        await move(yumi.id, yAt(d), mv, st, checks)
      await cond(yumi.id, yAt(-118), { fatigue: 'strong', pain: 'none', malaise: 'mild', postMeal: 'mild', sleep: 'mild' }, undefined, '疲れやすい。手足が冷える')
      await cond(yumi.id, yAt(-66), { fatigue: 'mild', pain: 'none', malaise: 'none', postMeal: 'none', sleep: 'none' })
      await cond(yumi.id, yAt(-4), { fatigue: 'none', pain: 'none', malaise: 'none', postMeal: 'none', sleep: 'none' }, undefined, '食べる量が増えても体が軽い')
      // 週ごとの食事の数字：コーフラックスで設定カロリーを少しずつ上げる（体重は横ばい）
      for (let i = 1; i <= 9; i++) {
        const weekStart = toDbDate(addDays(weekStartOf(today), -7 * i))
        const targetKcal = 1700 - (i - 1) * 50
        await prisma.nutritionWeek.upsert({
          where: { clientId_weekStart: { clientId: yumi.id, weekStart } },
          update: {},
          create: { clientId: yumi.id, weekStart, targetKcal, avgKcal: targetKcal - 40 + ((i * 37) % 60), proteinG: 85, fatG: 50, carbsG: Math.round((targetKcal - 85 * 4 - 50 * 9) / 4), updatedById: by },
        })
      }
      await prisma.weightReview.create({ data: { clientId: yumi.id, date: toDbDate(addDays(today, -4)), verdict: 'expected', reason: '摂取カロリーを1,650kcalまで上げても体重は横ばい（±0.3kg）。想定内', createdById: by } })
      await prisma.talkNote.create({ data: { clientId: yumi.id, date: toDbDate(addDays(today, -4)), kind: 'good', text: '「こんなに食べても太らないんですね」と安心していた', createdById: by } })
      await prisma.talkNote.create({ data: { clientId: yumi.id, date: toDbDate(addDays(today, -60)), kind: 'negative', text: '食べる量を増やすのが怖いと話していた。体重は増やさない計画だと説明した', createdById: by } })
    }
  }

  await prisma.appSetting.create({ data: { key: 'demo:plan', value: { at: today } } })
  console.log('plan: デモの指導計画（フェーズ・食事方針・自律神経・動作・体調・体重の評価）を用意')
}

/**
 * デモ顧客の問診票を、紙の「Resole カウンセリングカルテ」の項目に移す（SEED_DEMO=1 のとき1回だけ。AppSetting "demo:karte" に印を残す。2026-10-27）
 * 前の項目のうち、カルテの質問と重なるもの（目的・なりたい姿・治療中の病気・痛み・運動習慣）を移して消す。ほかの前の回答は読み取り専用で残る
 */
async function seedDemoKarte() {
  if (process.env.SEED_DEMO !== '1') return
  if (await prisma.appSetting.findUnique({ where: { key: 'demo:karte' } })) return
  const GOALS: Record<string, string> = {
    'ダイエット（減量）': 'ダイエット',
    ボディメイク: 'シェイプアップ',
    筋力アップ: '筋肉を増やす',
    '健康維持・体力向上': '体力の向上',
    '肩こり・腰痛の改善': 'けが予防・改善',
    '競技パフォーマンス向上': 'スポーツパフォーマンス向上',
  }
  const SOURCE: Record<string, string> = { Instagram: 'Instagram', 紹介: '友人・知人からの紹介', Web検索: 'Resole公式サイト' }
  const rows = await prisma.questionnaire.findMany({ where: { client: { name: { startsWith: 'デモ ' } } }, include: { client: { select: { referral: true } } } })
  for (const q of rows) {
    const a = { ...((q.answers ?? {}) as Record<string, unknown>) }
    if (a.source) continue
    const old = Array.isArray(a.purposes) ? (a.purposes as string[]) : []
    const goals = [...new Set(old.map((p) => GOALS[p] ?? 'その他'))]
    const others = old.filter((p) => !GOALS[p] && p !== 'その他')
    const habit =
      a.exerciseHabit === '週1〜2回' ? '運動習慣あり。ジムやスポーツを週に1〜2回' : a.exerciseHabit === '週3回以上' ? '運動習慣あり。ジムやスポーツを週に3回以上' : a.workStyle === 'デスクワーク中心' ? '運動習慣なし。デスクワーク中心' : a.exerciseHabit ? '運動習慣なし。よく歩く' : undefined
    const next: Record<string, unknown> = {
      source: [SOURCE[q.client.referral ?? ''] ?? 'その他'],
      ...(habit ? { habit } : {}),
      ...(a.exerciseDetail ? { habitNote: a.exerciseDetail } : {}),
      ...(goals.length ? { goals } : {}),
      ...(others.length ? { goalsNote: others.join('・') } : {}),
      ...(a.underTreatment ? { illness: a.underTreatment, illness__detail: a.underTreatment__detail } : {}),
      injury: 'なし',
      ...(a.currentPain ? { discomfort: a.currentPain, discomfort__detail: a.currentPain__detail } : {}),
      ...(a.goalDetail ? { wish: a.goalDetail } : {}),
    }
    for (const k of ['purposes', 'goalDetail', 'underTreatment', 'underTreatment__detail', 'currentPain', 'currentPain__detail', 'exerciseHabit', 'exerciseDetail']) delete a[k]
    for (const [k, v] of Object.entries(next)) if (v != null && v !== '') a[k] = v
    await prisma.questionnaire.update({ where: { id: q.id }, data: { answers: a as Prisma.InputJsonValue } })
  }
  await prisma.appSetting.create({ data: { key: 'demo:karte', value: { at: todayYmd() } } })
  console.log(`karte: デモの問診票 ${rows.length}件をカルテの項目に移した`)
}

/**
 * デモ 花子の最近2回の来店を、作り直したログ（器具・バネ・セットごと・左右・秒・できばえ・その回のテーマ・写真）で見られるようにする
 * （SEED_DEMO=1 のとき1回だけ。AppSetting "demo:log" に印を残す。2026-10-31）。写真は「デモ用の写真」と書いた仮の画像
 */
async function seedDemoLog() {
  if (process.env.SEED_DEMO !== '1') return
  if (await prisma.appSetting.findUnique({ where: { key: 'demo:log' } })) return
  const hanako = await prisma.client.findFirst({ where: { name: 'デモ 花子' }, select: { id: true } })
  const [last, prev] = hanako ? await prisma.trainingSession.findMany({ where: { clientId: hanako.id }, orderBy: { date: 'desc' }, take: 2 }) : []
  if (!last || !prev) return console.log('log: デモ 花子の来店がないため投入しない')

  type D = { w?: number; r?: number; s?: number; side?: 'R' | 'L' }
  type L = { part: string; name: string; eq: string; springs?: string; d: D[]; rating: string; note?: string }
  const row = (l: L, order: number) => {
    const top = l.d.reduce((a, b) => ((b.w ?? 0) > (a.w ?? 0) ? b : a), l.d[0])
    return { order, bodyPart: l.part, exercise: l.name, equipment: l.eq, springs: l.springs ?? null, detail: l.d as Prisma.InputJsonValue, weightKg: top.w ?? 0, reps: top.r ?? 0, sets: l.d.length, rating: l.rating, note: l.note ?? null }
  }
  const prevRows: L[] = [
    { part: '脚', name: 'フットワーク', eq: 'リフォーマー', springs: '2R＋1Y', d: [{ r: 10 }, { r: 10 }], rating: 'good', note: '膝が内に入りやすい' },
    { part: '体幹', name: 'パイクアップ', eq: 'チェア', springs: 'W2', d: [{ r: 4 }, { r: 4 }], rating: 'hard', note: 'ブロックを足して実施。前ももに効くとのこと' },
    { part: '背中', name: 'ロールダウン', eq: 'タワー', springs: 'B2', d: [{ r: 6 }, { r: 6 }], rating: 'good' },
    { part: '体幹', name: 'サイドキック', eq: 'マット', d: [{ r: 8, side: 'R' }, { r: 5, side: 'L' }], rating: 'hard', note: '左で骨盤がぶれる' },
    { part: '体幹', name: 'プランク', eq: 'マット', d: [{ s: 30 }, { s: 30 }], rating: 'good' },
    { part: '脚', name: 'ワイドスタンススクワット', eq: 'フリーウェイト', d: [{ w: 20, r: 12 }, { w: 20, r: 12 }, { w: 22.5, r: 10 }], rating: 'good' },
  ]
  const lastRows: L[] = [
    { part: '脚', name: 'フットワーク', eq: 'リフォーマー', springs: '2R＋1Y', d: [{ r: 10 }, { r: 10 }, { r: 10 }], rating: 'great', note: '膝とつま先の向きがそろってきた' },
    { part: '体幹', name: 'パイクアップ', eq: 'チェア', springs: 'W2', d: [{ r: 6 }, { r: 6 }], rating: 'hard', note: '前ももの力が抜けてきた。次回も W2 で' },
    { part: '背中', name: 'ロールダウン', eq: 'タワー', springs: 'B2', d: [{ r: 8 }, { r: 8 }], rating: 'great', note: '背中を丸める感覚がつかめた' },
    { part: '体幹', name: 'サイドキック', eq: 'マット', d: [{ r: 10, side: 'R' }, { r: 7, side: 'L' }], rating: 'good', note: '左のぶれが小さくなった' },
    { part: '体幹', name: 'プランク', eq: 'マット', d: [{ s: 45 }, { s: 45 }], rating: 'good' },
    { part: '脚', name: 'ワイドスタンススクワット', eq: 'フリーウェイト', d: [{ w: 20, r: 12 }, { w: 25, r: 10 }, { w: 25, r: 10 }], rating: 'good' },
  ]
  for (const [s, theme, rows] of [
    [prev, '体幹', prevRows],
    [last, '伸展', lastRows],
  ] as const) {
    await prisma.trainingSet.deleteMany({ where: { sessionId: s.id } })
    await prisma.trainingSession.update({ where: { id: s.id }, data: { theme, sets: { create: rows.map(row) } } })
  }
  for (const [file, title, note] of [
    ['demo-photo-chair.jpg', 'パイクアップ（W2）', '横から撮影。足の位置の確認用'],
    ['demo-photo-reformer.jpg', 'フットワーク（2R＋1Y）', '正面から撮影。膝の向きの確認用'],
  ]) {
    const data = readFileSync(new URL(`./seed-data/${file}`, import.meta.url))
    await prisma.clientFile.create({ data: { clientId: hanako!.id, sessionId: last.id, date: last.date, kind: 'photo', title, fileName: file, mimeType: 'image/jpeg', size: data.length, data, note } })
  }
  await prisma.appSetting.create({ data: { key: 'demo:log', value: { at: todayYmd() } } })
  console.log('log: デモ 花子の最近2回を、作り直したログの形にした（写真2枚）')
}

async function main() {
  await seedSettings()
  await seedExercises()
  const ownerId = await seedDevOwner()
  const demoUserId = await seedDemoUser()
  await seedDemo(ownerId ?? demoUserId)
  await seedDemoTalk(ownerId ?? demoUserId)
  await seedDemoMemos(ownerId ?? demoUserId)
  await seedDemoAlerts(ownerId ?? demoUserId)
  await seedDemoSteps(ownerId ?? demoUserId)
  await seedDemoPurposes()
  await seedDemoPlan(ownerId ?? demoUserId)
  await seedDemoKarte()
  await seedDemoLog()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
