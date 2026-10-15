import type { Fetcher, FetchedResponse } from './checker'
import { validSourceUrl } from './repository'

const MAX_BYTES = 5 * 1024 * 1024
const TIMEOUT_MS = 20_000

type RawFetch = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal; redirect: 'follow' }
) => Promise<{
  status: number
  url: string
  headers: { get(name: string): string | null }
  text(): Promise<string>
}>

/**
 * The checker's way to the network, around Electron's `net.fetch`: a timeout, a size limit, and a refusal to follow
 * a redirect to anything that is not a public web address. A request carries a plain User-Agent and nothing else.
 */
export function makeNetFetcher(rawFetch: RawFetch, timeoutMs = TIMEOUT_MS): Fetcher {
  return async (url, init): Promise<FetchedResponse> => {
    validSourceUrl(url)
    const response = await rawFetch(url, {
      headers: init.headers,
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow'
    })
    validSourceUrl(response.url || url)
    const length = Number(response.headers.get('content-length') ?? 0)
    if (length > MAX_BYTES) throw new Error('The page is too large to read')
    if (response.status === 304)
      return { status: 304, headers: response.headers, text: async () => '' }
    const body = await response.text()
    if (body.length > MAX_BYTES) throw new Error('The page is too large to read')
    return { status: response.status, headers: response.headers, text: async () => body }
  }
}
