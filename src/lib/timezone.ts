export const DEFAULT_STORE_TIMEZONE = 'America/Edmonton'

export interface StoreRangeBounds {
  rangeKey: 'today' | '7d' | '30d' | 'month' | 'custom' | 'all'
  fromDate: string
  toDate: string
  startIso: string | null
  endIso: string | null
}

export interface StoreHeaderContext {
  formattedDate: string
  shiftLabel: string
  greeting: string
  todayStr: string
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function getStoreTimezone(): string {
  const configured = process.env.NEXT_PUBLIC_STORE_TIMEZONE?.trim()
  if (!configured) return DEFAULT_STORE_TIMEZONE
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: configured })
    return configured
  } catch {
    return DEFAULT_STORE_TIMEZONE
  }
}

export function getStoreDateString(
  date: Date = new Date(),
  timeZone: string = getStoreTimezone()
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const map: Record<string, number> = {}
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = Number(part.value)
    }
  }

  const asUtcMs = Date.UTC(
    map.year,
    (map.month || 1) - 1,
    map.day || 1,
    map.hour ?? 0,
    map.minute ?? 0,
    map.second ?? 0
  )
  const truncatedEpochMs = Math.floor(date.getTime() / 1000) * 1000
  return asUtcMs - truncatedEpochMs
}

export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string = getStoreTimezone()
): Date {
  const guessUtcMs = Date.UTC(year, month - 1, day, hour, minute, second)
  const offset1 = getTimeZoneOffsetMs(new Date(guessUtcMs), timeZone)
  const candidate1 = guessUtcMs - offset1
  const offset2 = getTimeZoneOffsetMs(new Date(candidate1), timeZone)
  return new Date(guessUtcMs - offset2)
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const match = DATE_RE.exec(dateStr)
  if (!match) return dateStr
  const [, y, m, d] = match
  const utc = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d) + days))
  return utc.toISOString().slice(0, 10)
}

export function getStoreDayBoundsUtc(
  dateStr: string,
  timeZone: string = getStoreTimezone()
): { startIso: string; endIso: string } {
  const match = DATE_RE.exec(dateStr)
  if (!match) {
    const fallbackToday = getStoreDateString(new Date(), timeZone)
    return getStoreDayBoundsUtc(fallbackToday, timeZone)
  }

  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  const startUtc = zonedWallTimeToUtc(y, m, d, 0, 0, 0, timeZone)

  const nextDayStr = addDaysToDateString(dateStr, 1)
  const nextMatch = DATE_RE.exec(nextDayStr)!
  const endUtc = zonedWallTimeToUtc(
    Number(nextMatch[1]),
    Number(nextMatch[2]),
    Number(nextMatch[3]),
    0,
    0,
    0,
    timeZone
  )

  return {
    startIso: startUtc.toISOString(),
    endIso: endUtc.toISOString(),
  }
}

export function getStoreRangeBoundsUtc(
  range?: string | null,
  fromParam?: string | null,
  toParam?: string | null,
  now: Date = new Date(),
  timeZone: string = getStoreTimezone()
): StoreRangeBounds {
  const todayStr = getStoreDateString(now, timeZone)
  const normalized = (range || '30d').toLowerCase()

  if (normalized === 'all') {
    return {
      rangeKey: 'all',
      fromDate: '',
      toDate: '',
      startIso: null,
      endIso: null,
    }
  }

  let rangeKey: StoreRangeBounds['rangeKey'] = '30d'
  let fromDate = addDaysToDateString(todayStr, -29)
  let toDate = todayStr

  if (normalized === 'today') {
    rangeKey = 'today'
    fromDate = todayStr
    toDate = todayStr
  } else if (normalized === '7d') {
    rangeKey = '7d'
    fromDate = addDaysToDateString(todayStr, -6)
    toDate = todayStr
  } else if (normalized === 'month') {
    rangeKey = 'month'
    fromDate = `${todayStr.slice(0, 8)}01`
    toDate = todayStr
  } else if (normalized === 'custom') {
    const validFrom = fromParam && DATE_RE.test(fromParam) ? fromParam : null
    const validTo = toParam && DATE_RE.test(toParam) ? toParam : null
    if (validFrom || validTo) {
      rangeKey = 'custom'
      fromDate = validFrom || validTo || todayStr
      toDate = validTo || validFrom || todayStr
      if (fromDate > toDate) {
        const tmp = fromDate
        fromDate = toDate
        toDate = tmp
      }
    }
  }

  const { startIso } = getStoreDayBoundsUtc(fromDate, timeZone)
  const { endIso } = getStoreDayBoundsUtc(toDate, timeZone)

  return {
    rangeKey,
    fromDate,
    toDate,
    startIso,
    endIso,
  }
}

export function computeExpirationIso(
  expirationDateInput: string | null | undefined,
  shelfLifeDays: number,
  now: Date = new Date(),
  timeZone: string = getStoreTimezone()
): string {
  const trimmed = expirationDateInput?.trim() || ''
  if (trimmed) {
    const dateMatch = DATE_RE.exec(trimmed)
    if (dateMatch) {
      const endOfLocalDay = zonedWallTimeToUtc(
        Number(dateMatch[1]),
        Number(dateMatch[2]),
        Number(dateMatch[3]),
        23,
        59,
        59,
        timeZone
      )
      return endOfLocalDay.toISOString()
    }

    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }

  const days = Number.isFinite(shelfLifeDays) && shelfLifeDays > 0 ? Math.round(shelfLifeDays) : 7
  return new Date(now.getTime() + days * 86_400_000).toISOString()
}

export function getStoreHeaderContext(
  now: Date = new Date(),
  timeZone: string = getStoreTimezone()
): StoreHeaderContext {
  const todayStr = getStoreDateString(now, timeZone)
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(now)

  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(now)
  const hour = Number(hourStr) || 0

  let shiftLabel = 'Evening shift'
  let greeting = 'Good evening'
  if (hour < 12) {
    shiftLabel = 'Morning shift'
    greeting = 'Good morning'
  } else if (hour < 17) {
    shiftLabel = 'Afternoon shift'
    greeting = 'Good afternoon'
  }

  return {
    formattedDate,
    shiftLabel,
    greeting,
    todayStr,
  }
}

export function formatStoreTimestamp(
  isoString: string,
  timeZone: string = getStoreTimezone()
): string {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return isoString
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
