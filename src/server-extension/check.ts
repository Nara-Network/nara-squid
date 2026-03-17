import {
  RequestCheckContext
} from '@subsquid/graphql-server/src/check'
import { LRUCache } from 'lru-cache'

const MAX_PER_MINUTE = 500
interface Entry { count: number; reset: number }
const rateCache = new LRUCache<string, Entry>({
  max: 50_000,
  ttl: 60_000, // 1 minute
})

export async function requestCheck(
  req: RequestCheckContext
): Promise<boolean | string> {
  const masterToken = req.http.headers.get('x-subsquid-token')
  const devMode = process.env.DEV_MODE === 'true'

  if (masterToken === process.env.SUBSQUID_MASTER_TOKEN || devMode) {
    return true
  }

  const session = req.http.headers.get('x-session-id')
  if (!session) {
    return false
  }

  const now = Date.now()
  let entry = rateCache.get(session)
  if (!entry || now > entry.reset) {
    entry = { count: 1, reset: now + 60_000 }
  } else {
    entry.count++
  }
  rateCache.set(session, entry, { ttl: entry.reset - now })

  if (entry.count > MAX_PER_MINUTE) {
    console.log(`Rate limit exceeded (${entry.count}/${MAX_PER_MINUTE})`)
    return false
  }

  return true
}
