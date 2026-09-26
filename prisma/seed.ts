// 初期データの投入。何度実行しても壊れない（設定・種目は不足分だけ足す）。
// - 計算設定の初期値（参考シートと同じ）
// - 種目マスタ（参考シートの6部位132種目）
// - 開発用オーナー（DEV_LOGIN=true のときだけ）
// - デモ顧客（SEED_DEMO=1 かつ顧客が0人のときだけ。日付は実行日を基準に作る）
import { readFileSync } from 'node:fs'
import { PrismaClient, type Prisma } from '@prisma/client'
import { hashPassword } from 'better-auth/crypto'
import { DEFAULT_SETTINGS } from '../lib/calc/settings'
import { addDays, todayYmd, toDbDate, type Ymd } from '../lib/dates'
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

async function main() {
  await seedSettings()
  await seedExercises()
  const ownerId = await seedDevOwner()
  const demoUserId = await seedDemoUser()
  await seedDemo(ownerId ?? demoUserId)
  await seedDemoTalk(ownerId ?? demoUserId)
  await seedDemoMemos(ownerId ?? demoUserId)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
