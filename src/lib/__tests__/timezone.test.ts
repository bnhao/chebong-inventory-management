import { describe, expect, it } from 'vitest'
import {
  addDaysToDateString,
  computeExpirationIso,
  getStoreDateString,
  getStoreDayBoundsUtc,
  getStoreHeaderContext,
  getStoreRangeBoundsUtc,
} from '@/lib/timezone'

describe('timezone helpers (America/Edmonton)', () => {
  const tz = 'America/Edmonton'

  it('computes exact winter MST (-07:00) day boundaries in UTC', () => {
    const bounds = getStoreDayBoundsUtc('2026-01-15', tz)
    expect(bounds.startIso).toBe('2026-01-15T07:00:00.000Z')
    expect(bounds.endIso).toBe('2026-01-16T07:00:00.000Z')
  })

  it('computes exact summer MDT (-06:00) day boundaries in UTC', () => {
    const bounds = getStoreDayBoundsUtc('2026-07-15', tz)
    expect(bounds.startIso).toBe('2026-07-15T06:00:00.000Z')
    expect(bounds.endIso).toBe('2026-07-16T06:00:00.000Z')
  })

  it('handles DST spring-forward (23h) and fall-back (25h) days cleanly', () => {
    // 2026-03-08: spring forward 2am MST -> 3am MDT
    const spring = getStoreDayBoundsUtc('2026-03-08', tz)
    const springHours =
      (new Date(spring.endIso).getTime() - new Date(spring.startIso).getTime()) / 3_600_000
    expect(spring.startIso).toBe('2026-03-08T07:00:00.000Z')
    expect(spring.endIso).toBe('2026-03-09T06:00:00.000Z')
    expect(springHours).toBe(23)

    // 2026-11-01: fall back 2am MDT -> 1am MST
    const fall = getStoreDayBoundsUtc('2026-11-01', tz)
    const fallHours =
      (new Date(fall.endIso).getTime() - new Date(fall.startIso).getTime()) / 3_600_000
    expect(fall.startIso).toBe('2026-11-01T06:00:00.000Z')
    expect(fall.endIso).toBe('2026-11-02T07:00:00.000Z')
    expect(fallHours).toBe(25)
  })

  it('resolves store local date across UTC midnight boundaries', () => {
    // 2026-11-20T04:00:00Z is 2026-11-19 21:00 MST in Edmonton
    const instant = new Date('2026-11-20T04:00:00.000Z')
    expect(getStoreDateString(instant, tz)).toBe('2026-11-19')
  })

  it('adds calendar days safely without local-TZ drift', () => {
    expect(addDaysToDateString('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDaysToDateString('2026-11-01', 1)).toBe('2026-11-02')
  })

  it('computes range bounds for presets and custom inverted dates', () => {
    const now = new Date('2026-11-19T22:00:00.000Z') // 15:00 MST on 2026-11-19

    const today = getStoreRangeBoundsUtc('today', null, null, now, tz)
    expect(today.rangeKey).toBe('today')
    expect(today.fromDate).toBe('2026-11-19')
    expect(today.toDate).toBe('2026-11-19')

    const week = getStoreRangeBoundsUtc('7d', null, null, now, tz)
    expect(week.fromDate).toBe('2026-11-13')
    expect(week.toDate).toBe('2026-11-19')

    const month = getStoreRangeBoundsUtc('month', null, null, now, tz)
    expect(month.fromDate).toBe('2026-11-01')
    expect(month.toDate).toBe('2026-11-19')

    const customSwapped = getStoreRangeBoundsUtc('custom', '2026-11-15', '2026-11-05', now, tz)
    expect(customSwapped.rangeKey).toBe('custom')
    expect(customSwapped.fromDate).toBe('2026-11-05')
    expect(customSwapped.toDate).toBe('2026-11-15')

    const all = getStoreRangeBoundsUtc('all', null, null, now, tz)
    expect(all.startIso).toBeNull()
    expect(all.endIso).toBeNull()
  })

  it('computes expiration ISO at end of store day for YYYY-MM-DD and uses ingredient shelf life when blank', () => {
    const now = new Date('2026-11-19T18:00:00.000Z')

    // Explicit date 2026-11-22 in MST (-07:00) -> 2026-11-23T06:59:59.000Z (not previous day!)
    const explicit = computeExpirationIso('2026-11-22', 3, now, tz)
    expect(explicit).toBe('2026-11-23T06:59:59.000Z')
    expect(getStoreDateString(new Date(explicit), tz)).toBe('2026-11-22')

    // Blank expiration -> now + shelfLifeDays
    const milkDefault = computeExpirationIso(null, 3, now, tz)
    expect(milkDefault).toBe('2026-11-22T18:00:00.000Z')

    const sugarDefault = computeExpirationIso('', 90, now, tz)
    expect(sugarDefault).toBe(new Date(now.getTime() + 90 * 86_400_000).toISOString())
  })

  it('computes deterministic shift greeting and date label in store TZ', () => {
    // 2026-11-19T15:30:00Z = 08:30 MST
    const morning = getStoreHeaderContext(new Date('2026-11-19T15:30:00.000Z'), tz)
    expect(morning.shiftLabel).toBe('Morning shift')
    expect(morning.greeting).toBe('Good morning')
    expect(morning.todayStr).toBe('2026-11-19')

    // 2026-11-20T02:30:00Z = 19:30 MST on Nov 19
    const evening = getStoreHeaderContext(new Date('2026-11-20T02:30:00.000Z'), tz)
    expect(evening.shiftLabel).toBe('Evening shift')
    expect(evening.greeting).toBe('Good evening')
    expect(evening.todayStr).toBe('2026-11-19')
  })
})
