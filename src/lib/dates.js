// All dates are handled as local-time 'YYYY-MM-DD' strings so "today"
// always means your today, not UTC's.

export function toISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISO(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso, n) {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function todayISO() {
  return toISO(new Date())
}

export function dateRange(startISO, endISO) {
  const out = []
  for (let d = startISO; d <= endISO; d = addDays(d, 1)) out.push(d)
  return out
}

const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
const longFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
const shortFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

export const weekdayShort = (iso) => weekdayFmt.format(fromISO(iso))
export const formatLong = (iso) => longFmt.format(fromISO(iso))
export const formatShort = (iso) => shortFmt.format(fromISO(iso))
