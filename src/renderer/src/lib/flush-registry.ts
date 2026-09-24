type Flushable = () => Promise<void> | void

const flushables = new Set<Flushable>()

/** Register something that must finish saving before the window closes. Returns an unregister function. */
export function registerFlushable(flush: Flushable): () => void {
  flushables.add(flush)
  return () => flushables.delete(flush)
}

/** Run every registered flush. One failing does not stop the others. */
export async function flushAll(): Promise<void> {
  // `async` turns a synchronous throw into a rejection, so allSettled still sees it.
  await Promise.allSettled([...flushables].map(async (flush) => flush()))
}
