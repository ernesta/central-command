import { BrowserWindow, ipcMain } from 'electron'
import { TIME_OFF_TYPES, type TimeOffType } from '@shared/tracking/types'
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

/** Thin handlers: check the arguments' types and hand over to the store, which holds every rule. */
export function registerTrackingIpc(store: TrackingStore): void {
  const h = ipcMain.handle.bind(ipcMain)
  h(TRACKING_IPC.years, (_e, ws) => store.years(workspace(ws)))
  h(TRACKING_IPC.get, (_e, ws, year) => store.get(workspace(ws), text(year)))
  h(TRACKING_IPC.running, () => store.running())
  h(TRACKING_IPC.start, (_e, ws, label, task) =>
    store.start(workspace(ws), text(label), task === undefined ? undefined : text(task))
  )
  h(TRACKING_IPC.stop, () => store.stop())
  h(TRACKING_IPC.endAt, (_e, ws, year, id, time) =>
    store.endAt(workspace(ws), text(year), text(id), text(time))
  )
  h(TRACKING_IPC.deleteSession, (_e, ws, year, id) =>
    store.deleteSession(workspace(ws), text(year), text(id))
  )
  h(TRACKING_IPC.setTaskMinutes, (_e, ws, year, date, label, minutes) =>
    store.setTaskMinutes(workspace(ws), text(year), text(date), text(label), whole(minutes))
  )
  h(TRACKING_IPC.addTime, (_e, ws, year, date, label, minutes) =>
    store.addTime(workspace(ws), text(year), text(date), text(label), whole(minutes))
  )
  h(TRACKING_IPC.setNote, (_e, ws, year, date, note) =>
    store.setNote(workspace(ws), text(year), text(date), text(note))
  )
  h(TRACKING_IPC.setPlan, (_e, ws, year, plan) => {
    const p = (plan ?? {}) as Record<string, unknown>
    return store.setPlan(workspace(ws), text(year), {
      ...(p.hoursPerWeek !== undefined ? { hoursPerWeek: whole(p.hoursPerWeek) } : {}),
      ...(p.allowanceDays !== undefined ? { allowanceDays: whole(p.allowanceDays) } : {}),
      ...(Array.isArray(p.workDays) ? { workDays: p.workDays.map(whole) } : {})
    })
  })
  h(TRACKING_IPC.addTimeOff, (_e, ws, year, from, to, type) =>
    store.addTimeOff(workspace(ws), text(year), text(from), text(to), timeOffType(type))
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
