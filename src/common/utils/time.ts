export function floorToHour(ts: number) {
  return Math.floor(ts / 3600) * 3600;
}

export function toSec(ts: number): number {
  return ts > 10_000_000_000 ? Math.floor(ts / 1000) : ts
}

/**
 * Get the start of the current UTC month (in seconds)
 * Returns timestamp at 00:00:00 UTC on the 1st day of the month
 */
export function floorToMonthUTC(tsSec: number): number {
  const date = new Date(tsSec * 1000)
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  return Math.floor(Date.UTC(year, month, 1) / 1000)
}

/**
 * Get the start of the next UTC month (in seconds)
 * Returns timestamp at 00:00:00 UTC on the 1st day of the next month
 */
export function nextMonthStartUTC(monthStartTs: number): number {
  const date = new Date(monthStartTs * 1000)
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  return Math.floor(Date.UTC(year, month + 1, 1) / 1000)
}

/**
 * Get the number of seconds in the UTC month that contains monthStartTs
 * Returns the number of seconds from monthStartTs to the start of the next month
 */
export function secondsInMonthUTC(monthStartTs: number): number {
  const nextMonth = nextMonthStartUTC(monthStartTs)
  return nextMonth - monthStartTs
}


export const SECONDS_PER_DAY = 86400

export function dayStart(tsSec: number) {
  return Math.floor(tsSec / SECONDS_PER_DAY) * SECONDS_PER_DAY
}

