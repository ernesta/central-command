import type { TrackingYear } from './types'

/**
 * The rules for a Work client's name (`docs/CLIENT_LISTS_PLAN.md`, stage 2). A client is also a top-level Tasks list, so a name
 * is one list: the same name in two contracts is one client (compared ignoring case), and renaming or removing it must
 * take the list with it. Plain functions, no files: the store applies them.
 */

/** The longest a client's name may be. */
export const MAX_CLIENT_NAME = 40

/** A client's name as typed: spaces collapsed and trimmed. Null when it is empty or too long. */
export function cleanClientName(text: string): string | null {
  const name = text.trim().replace(/\s+/g, ' ')
  return name && name.length <= MAX_CLIENT_NAME ? name : null
}

const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

type Clients = Pick<TrackingYear['plan'], 'clients'>

/** Every client name in the plans, once each (ignoring case), in the order met. */
export function allClients(plans: readonly Clients[]): string[] {
  const names: string[] = []
  for (const plan of plans) {
    for (const c of plan.clients ?? []) if (!names.some((n) => same(n, c))) names.push(c)
  }
  return names
}

/** The spelling a name already has in some plan (so the client has one list), else the name itself. */
export function canonicalClient(plans: readonly Clients[], name: string): string {
  return allClients(plans).find((c) => same(c, name)) ?? name
}

/**
 * The clients a plan loses when its list changes from `before` to `after` and that no other plan has: those whose list
 * would have no client behind it. Names only in one of two contracts stay a client.
 */
export function clientsLost(
  before: readonly string[],
  after: readonly string[],
  others: readonly Clients[]
): string[] {
  const kept = allClients(others)
  return before.filter((c) => !after.some((a) => same(a, c)) && !kept.some((k) => same(k, c)))
}

export type RenameCheck =
  { ok: true; to: string } | { ok: false; reason: 'bad-name' | 'unknown-client' | 'client-exists' }

/** Whether `from` may be renamed `to`: `from` must be a client, `to` a valid name no other client has (a change of case is fine). */
export function checkRename(plans: readonly Clients[], from: string, to: string): RenameCheck {
  const name = cleanClientName(to)
  if (name === null) return { ok: false, reason: 'bad-name' }
  if (!allClients(plans).some((c) => same(c, from))) return { ok: false, reason: 'unknown-client' }
  if (allClients(plans).some((c) => same(c, name) && !same(c, from))) {
    return { ok: false, reason: 'client-exists' }
  }
  return { ok: true, to: name }
}

/** A year with a client renamed in its plan, its sessions and its typed time (ignoring case). Reported minutes are untouched. */
export function renameClientInYear(year: TrackingYear, from: string, to: string): TrackingYear {
  const swap = <T extends { client?: string }>(e: T): T =>
    e.client !== undefined && same(e.client, from) ? { ...e, client: to } : e
  return {
    ...year,
    plan: year.plan.clients
      ? { ...year.plan, clients: year.plan.clients.map((c) => (same(c, from) ? to : c)) }
      : year.plan,
    sessions: year.sessions.map(swap),
    adjusts: year.adjusts.map(swap)
  }
}

/** Why a client cannot be removed or renamed, for the person: a few words. */
export function clientRefusal(reason: string, client?: string, tasks?: number): string {
  switch (reason) {
    case 'client-has-tasks':
      return `${client ?? 'This client'} still has ${tasks === 1 ? '1 task' : `${tasks ?? 'some'} tasks`}. Move or delete them first.`
    case 'client-exists':
      return 'There is a client with that name.'
    case 'bad-name':
      return 'Give the client a name of up to 40 characters.'
    default:
      return 'Couldn’t change it. Try again.'
  }
}
