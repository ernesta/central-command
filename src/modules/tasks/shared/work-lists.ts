import type { TaskWorkspace } from './types'

/**
 * Work's top-level lists are exactly its clients (`docs/CLIENT_LISTS_PLAN.md`). Research's lists are topical and free.
 * A sublist is free text in both and is not checked here.
 */

/** Every client of every contract, past and present, once each, in the order given (a client in two contracts has one list). */
export function workClients(plans: readonly { clients?: readonly string[] }[]): string[] {
  const seen = new Map<string, string>()
  for (const plan of plans) {
    for (const raw of plan.clients ?? []) {
      const client = raw.trim()
      if (client && !seen.has(client.toLowerCase())) seen.set(client.toLowerCase(), client)
    }
  }
  return [...seen.values()]
}

/**
 * The top-level list a task may be given: the client's own spelling when `list` names one (case and outer spaces ignored),
 * `list` trimmed anywhere that has no rule (Research), and null in Work when `list` is no client.
 */
export function listFor(
  workspace: TaskWorkspace,
  list: string,
  clients: readonly string[]
): string | null {
  const name = list.trim()
  if (workspace !== 'work') return name
  return clients.find((c) => c.toLowerCase() === name.toLowerCase()) ?? null
}

/** Whether a top-level list may be used in a workspace. */
export function canUseList(
  workspace: TaskWorkspace,
  list: string,
  clients: readonly string[]
): boolean {
  return listFor(workspace, list, clients) !== null
}

/** The live top-level Work tasks whose list is no client: what `npm run check:work-lists` reports (expected: none). */
export function outsideRule<T extends { list: string }>(
  tasks: readonly T[],
  clients: readonly string[]
): T[] {
  return tasks.filter((t) => !canUseList('work', t.list, clients))
}

/**
 * The lists and sublists a task may be moved to, as (list, sublist) pairs for the list menu: in Work every client (even with
 * no task) and the sublists in use under it, in the client's own spelling, and no list that is no client; in Research (`clients`
 * null) the lists in use as they are.
 */
export function offeredLists(
  tasks: readonly { list: string; sublist: string }[],
  clients: readonly string[] | null
): { list: string; sublist: string }[] {
  if (clients === null) return [...tasks]
  const own = clients.map((list) => ({ list, sublist: '' }))
  const held = tasks.flatMap((t) => {
    const list = listFor('work', t.list, clients)
    return list === null ? [] : [{ list, sublist: t.sublist }]
  })
  return [...own, ...held]
}

/**
 * The tasks a contract's page shows: those whose top-level list is one of its clients (case and outer spaces ignored). A task in no
 * list, or in a list that is no client of the contract, belongs to another contract or to none. `clients` undefined is every
 * task (All contracts, or a workspace with no contracts).
 */
export function inContractLists<T extends { task: { list: string } }>(
  rows: readonly T[],
  clients: readonly string[] | undefined
): T[] {
  if (clients === undefined) return [...rows]
  const mine = new Set(clients.map((c) => c.trim().toLowerCase()))
  return rows.filter((r) => mine.has(r.task.list.trim().toLowerCase()))
}
