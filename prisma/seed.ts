// 初期データの投入。何度実行しても壊れない（設定・種目は不足分だけ足す）。
// - 計算設定の初期値（参考シートと同じ）
// - 種目マスタ（参考シートの6部位132種目）
// - 開発用オーナー（DEV_LOGIN=true のときだけ）
// - デモ顧客（SEED_DEMO=1 かつ顧客が0人のときだけ。日付は実行日を基準に作る）
import { readFileSync } from 'node:fs'
import { PrismaClient, type Prisma } from '@prisma/client'
import { hashPassword } from 'better-auth/crypto'
import { DEFAULT_SETTINGS } from '../lib/calc/settings'
import { addDays, addMonthsKey, fromDbDate, monthKey, todayYmd, toDbDate, weekStartOf, type Ymd } from '../lib/dates'
import { detailKey, type QAnswers } from '../lib/questionnaire'
import { drawingThumb, parseDrawing } from '../lib/drawing'

const prisma = new PrismaClient()

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
 * デモで顧客ステップ・宿題を見られるようにする（SEED_DEMO=1 のとき1回だけ。AppSetting "demo:steps" に印を残す）
 * 日付は各お客様の入会日・来店日から決める（デモ顧客を作った日と、この関数を実行した日がずれても合うように）
 * - 期：太郎さん 自律神経期→ピラティス期→筋力アップ期（名前を自由につけた例）、花子さん 自律神経期→ピラティス期、美咲さん 休会前まで
 * - 月ごとのテーマ（来月の分は空けておく）
 * - 宿題：確認待ちと、これまでの結果
 * - 自律神経の測定結果（見本の PDF）を来店日に
 */
async function seedDemoSteps(trainerId: string | null) {
  if (process.env.SEED_DEMO !== '1') return
  if (await prisma.appSetting.findUnique({ where: { key: 'demo:steps' } })) return
  const find = (name: string) => prisma.client.findFirst({ where: { name }, select: { id: true, joinedOn: true } })
  const [taro, hanako, misaki] = await Promise.all([find('デモ 太郎'), find('デモ 花子'), find('デモ 美咲')])
  if (!taro?.joinedOn || !hanako?.joinedOn) return console.log('steps: デモ顧客がいないため投入しない')
  const visits = async (clientId: string) =>
    (await prisma.trainingSession.findMany({ where: { clientId }, orderBy: { date: 'asc' }, select: { date: true } })).map((x) => fromDbDate(x.date))
  /** その日以降で最初の来店日（なければその日） */
  const visitFrom = (list: Ymd[], day: Ymd) => list.find((d) => d >= day) ?? day

  // ── 期
  const phase = (clientId: string, name: string, start: Ymd, end: Ymd | null = null, note?: string) =>
    prisma.clientPhase.create({ data: { clientId, name, startDate: toDbDate(start), endDate: end ? toDbDate(end) : null, note: note ?? null, createdById: trainerId } })
  const tj = fromDbDate(taro.joinedOn)
  const hj = fromDbDate(hanako.joinedOn)
  await phase(taro.id, '自律神経期', tj, null, '睡眠5〜6時間・デスクワークで肩が上がりやすい。まず呼吸と睡眠から')
  await phase(taro.id, 'ピラティス期', addDays(tj, 42), null, '睡眠が6.5時間まで伸びたので移行')
  await phase(taro.id, '筋力アップ期', addDays(tj, 105), null, '期の名前は自由につけられる例')
  await phase(hanako.id, '自律神経期', hj, null, '夜勤で睡眠が乱れやすいので長めに')
  await phase(hanako.id, 'ピラティス期', addDays(hj, 49))
  if (misaki?.joinedOn) {
    const mj = fromDbDate(misaki.joinedOn)
    const mv = await visits(misaki.id)
    await phase(misaki.id, '自律神経期', mj)
    await phase(misaki.id, 'ピラティス期', addDays(mj, 28), mv[mv.length - 1] ?? addDays(mj, 110), '休会のため、いったん終了')
  }

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
  console.log('steps: デモの期・テーマ・宿題・自律神経の測定結果を用意')
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
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
