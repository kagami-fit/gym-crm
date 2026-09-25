/** 数値の表示（null は「—」） */
export function num(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return v.toLocaleString('ja-JP', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function int(v: number | null | undefined): string {
  return num(v, 0)
}

/** +1.2 / −0.8 のように符号つき */
export function signed(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const s = num(Math.abs(v), digits)
  if (Math.abs(v) < 0.5 * 10 ** -digits) return `±${num(0, digits)}`
  return v > 0 ? `+${s}` : `−${s}`
}

export function toNumberOrNull(v: FormDataEntryValue | null | undefined): number | null {
  if (v == null) return null
  const s = String(v).trim().replace(/,/g, '').replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function textOrNull(v: FormDataEntryValue | null | undefined): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}
