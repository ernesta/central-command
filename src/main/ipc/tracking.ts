import { BrowserWindow, ipcMain } from 'electron'
import { INVOICES, TIME_OFF_TYPES, type Invoice, type TimeOffType } from '@shared/tracking/types'
import { TRACKING_IPC } from '@shared/tracking/api'
import { WORKSPACES, type Workspace } from '@shared/settings'
import type { TrackingStore } from '../tracking/store'

function workspace(value: unknown): Workspace {
  const found = WORKSPACES.find((w) => w === value)
  if (!found) throw new Error('Unknown workspace')
  return found
}

function text(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Expected text')
  return value
}

function optionalText(value: unknown): string | undefined {
  return value === undefined || value === null ? undefined : text(value)
}

function whole(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value))
    throw new Error('Expected a whole number')
  return value
}

function timeOffType(value: unknown): TimeOffType {
  const found = TIME_OFF_TYPES.find((t) => t.id === value)
  if (!found) throw new Error('Unknown type')
  return found.id
}

function invoice(value: unknown): Invoice {
  const found = INVOICES.find((i) => i === value)
  if (!found) throw new Error('Unknown invoice')
  return found
}

/** Thin handlers: check the arguments' types and hand over to the store, which holds every rule. */
export function registerTrackingIpc(store: TrackingStore): void {
  const h = ipcMain.handle.bind(ipcMain)
  h(TRACKING_IPC.years, (_e, ws) => store.years(workspace(ws)))
  h(TRACKING_IPC.get, (_e, ws, year) => store.get(workspace(ws), text(year)))
  h(TRACKING_IPC.running, () => store.running())
  h(TRACKING_IPC.openContracts, (_e, ws) => store.openContracts(workspace(ws)))
  h(TRACKING_IPC.start, (_e, ws, label, task, client) =>
    store.start(workspace(ws), text(label), optionalText(task), optionalText(client))
  )
  h(TRACKING_IPC.stop, () => store.stop())
  h(TRACKING_IPC.endAt, (_e, ws, year, id, time) =>
    store.endAt(workspace(ws), text(year), text(id), text(time))
  )
  h(TRACKING_IPC.setStart, (_e, ws, year, id, time) =>
    store.setStart(workspace(ws), text(year), text(id), text(time))
  )
  h(TRACKING_IPC.deleteSession, (_e, ws, year, id) =>
    store.deleteSession(workspace(ws), text(year), text(id))
  )
  h(TRACKING_IPC.setTaskMinutes, (_e, ws, year, date, label, minutes, client) =>
    store.setTaskMinutes(
      workspace(ws),
      text(year),
      text(date),
      text(label),
      whole(minutes),
      optionalText(client)
    )
  )
  h(TRACKING_IPC.renameTask, (_e, ws, year, date, from, to, client) =>
    store.renameTask(
      workspace(ws),
      text(year),
      text(date),
      text(from),
      text(to),
      optionalText(client)
    )
  )
  h(TRACKING_IPC.setClient, (_e, ws, year, date, label, from, to) =>
    store.setClient(
      workspace(ws),
      text(year),
      text(date),
      text(label),
      optionalText(from),
      text(to)
    )
  )
  h(TRACKING_IPC.addTime, (_e, ws, year, date, label, minutes, client, task) =>
    store.addTime(
      workspace(ws),
      text(year),
      text(date),
      text(label),
      whole(minutes),
      optionalText(client),
      optionalText(task)
    )
  )
  h(TRACKING_IPC.setNote, (_e, ws, year, date, note) =>
    store.setNote(workspace(ws), text(year), text(date), text(note))
  )
  h(TRACKING_IPC.setPlan, (_e, ws, year, plan) => {
    const p = (plan ?? {}) as Record<string, unknown>
    return store.setPlan(workspace(ws), text(year), {
      ...(p.hoursPerWeek !== undefined ? { hoursPerWeek: whole(p.hoursPerWeek) } : {}),
      ...(p.allowanceDays !== undefined ? { allowanceDays: whole(p.allowanceDays) } : {}),
      ...(Array.isArray(p.workDays) ? { workDays: p.workDays.map(whole) } : {}),
      ...(Array.isArray(p.clients) ? { clients: p.clients.map(text) } : {})
    })
  })
  h(TRACKING_IPC.createContract, (_e, ws, start, end, terms) => {
    const t = (terms ?? {}) as Record<string, unknown>
    return store.createContract(workspace(ws), text(start), text(end), {
      ...(t.name !== undefined ? { name: text(t.name) } : {}),
      ...(Array.isArray(t.clients) ? { clients: t.clients.map(text) } : {}),
      ...(t.weeklyMinutes !== undefined ? { weeklyMinutes: whole(t.weeklyMinutes) } : {}),
      ...(t.invoice !== undefined ? { invoice: invoice(t.invoice) } : {})
    })
  })
  h(TRACKING_IPC.setContractEnd, (_e, ws, year, end) =>
    store.setContractEnd(workspace(ws), text(year), text(end))
  )
  h(TRACKING_IPC.addTimeOff, (_e, ws, year, from, to, type) =>
    store.addTimeOff(workspace(ws), text(year), text(from), text(to), timeOffType(type))
  )
  h(TRACKING_IPC.editTimeOff, (_e, ws, year, from, to, type) =>
    store.editTimeOff(workspace(ws), text(year), text(from), text(to), timeOffType(type))
  )
  h(TRACKING_IPC.removeTimeOff, (_e, ws, year, date) =>
    store.removeTimeOff(workspace(ws), text(year), text(date))
  )
}

/** Tell every window that a year's file changed. */
export function broadcastTrackingChange(event: { workspace: Workspace; year: string }): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(TRACKING_IPC.changed, event)
  }
}
