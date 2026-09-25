import { z } from 'zod'
import { isYmd, toDbDate } from '@/lib/dates'
import { toNumberOrNull, textOrNull } from '@/lib/format'
import { GENDERS, PURPOSES, REFERRALS, STATUSES } from '@/lib/labels'

const ymdOrNull = z
  .string()
  .nullable()
  .refine((v) => v == null || isYmd(v), '日付の形式が正しくありません')

const clientSchema = z.object({
  name: z.string().trim().min(1, '氏名を入れてください').max(60, '氏名が長すぎます'),
  kana: z.string().trim().max(60).nullable(),
  memberNo: z.string().trim().max(30).nullable(),
  gender: z.enum(Object.keys(GENDERS) as [string, ...string[]]).nullable(),
  birthDate: ymdOrNull,
  heightCm: z.number().min(100, '身長は100〜230cmで入れてください').max(230, '身長は100〜230cmで入れてください').nullable(),
  phone: z.string().trim().max(30).nullable(),
  email: z.string().trim().max(120).nullable(),
  address: z.string().trim().max(200).nullable(),
  occupation: z.string().trim().max(60).nullable(),
  emergencyName: z.string().trim().max(60).nullable(),
  emergencyRelation: z.string().trim().max(30).nullable(),
  emergencyPhone: z.string().trim().max(30).nullable(),
  status: z.enum(Object.keys(STATUSES) as [string, ...string[]]),
  joinedOn: ymdOrNull,
  leftOn: ymdOrNull,
  trainerId: z.string().nullable(),
  referral: z.string().trim().max(40).nullable(),
  purposes: z.array(z.string()).max(10),
  note: z.string().trim().max(2000).nullable(),
})

export type ClientFormData = z.infer<typeof clientSchema>

export function parseClientForm(fd: FormData): { ok: true; data: ClientFormData } | { ok: false; message: string } {
  const raw = {
    name: String(fd.get('name') ?? ''),
    kana: textOrNull(fd.get('kana')),
    memberNo: textOrNull(fd.get('memberNo')),
    gender: textOrNull(fd.get('gender')),
    birthDate: textOrNull(fd.get('birthDate')),
    heightCm: toNumberOrNull(fd.get('heightCm')),
    phone: textOrNull(fd.get('phone')),
    email: textOrNull(fd.get('email')),
    address: textOrNull(fd.get('address')),
    occupation: textOrNull(fd.get('occupation')),
    emergencyName: textOrNull(fd.get('emergencyName')),
    emergencyRelation: textOrNull(fd.get('emergencyRelation')),
    emergencyPhone: textOrNull(fd.get('emergencyPhone')),
    status: String(fd.get('status') ?? 'active'),
    joinedOn: textOrNull(fd.get('joinedOn')),
    leftOn: textOrNull(fd.get('leftOn')),
    trainerId: textOrNull(fd.get('trainerId')),
    referral: textOrNull(fd.get('referral')),
    purposes: fd.getAll('purposes').map(String).filter((p) => PURPOSES.includes(p)),
    note: textOrNull(fd.get('note')),
  }
  const r = clientSchema.safeParse(raw)
  if (!r.success) return { ok: false, message: r.error.issues[0]?.message ?? '入力内容を確認してください' }
  if (r.data.referral && !REFERRALS.includes(r.data.referral)) r.data.referral = r.data.referral.slice(0, 40)
  return { ok: true, data: r.data }
}

/** Prisma に渡す形（日付は @db.Date 用） */
export function toClientData(d: ClientFormData) {
  return {
    ...d,
    birthDate: d.birthDate ? toDbDate(d.birthDate) : null,
    joinedOn: d.joinedOn ? toDbDate(d.joinedOn) : null,
    leftOn: d.leftOn ? toDbDate(d.leftOn) : null,
  }
}
