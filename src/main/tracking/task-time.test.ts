import { mkdtempSync, readdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { yearMinutes } from '@shared/tracking/totals'
import { TrackingStore } from './store'

const A = 'cc://task/aaa'
const B = 'cc://task/bbb'
let dir: string
let store: TrackingStore
let clock = { date: '2026-09-29', time: '10:00:00' }

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cc-task-time-'))
  clock = { date: '2026-09-29', time: '10:00:00' }
  store = new TrackingStore(dir, { starts: () => ['2026-09-21'], now: () => clock })
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

function track(label: string, task: string, minutes: number): void {
  store.start('research', label, task)
  const hour = Number(clock.time.slice(0, 2)) + minutes / 60
  clock = { date: '2026-09-29', time: `${String(hour).padStart(2, '0')}:00:00` }
  store.stop()
}

describe('time that goes with a deleted task', () => {
  it('takes only that task’s saved time out of Hours', () => {
    track('Write', A, 60)
    track('Read', B, 60)
    store.addTime('research', '2026-09-21', '2026-09-29', 'Write', 30, undefined, A)
    expect(store.removeTaskTime([A])).toBe(90)
    const year = store.get('research', '2026-09-21')
    expect(yearMinutes(year)).toBe(60)
    expect(year.sessions.every((s) => s.task === B)).toBe(true)
    expect(year.adjusts).toHaveLength(0)
  })

  it('puts all of it back on restore, and keeps no copy', () => {
    track('Write', A, 60)
    store.addTime('research', '2026-09-21', '2026-09-29', 'Write', 30, undefined, A)
    const before = yearMinutes(store.get('research', '2026-09-21'))
    store.removeTaskTime([A])
    store.restoreTaskTime([A])
    expect(yearMinutes(store.get('research', '2026-09-21'))).toBe(before)
    expect(readdirSync(join(dir, 'removed-with-task'))).toEqual([])
  })

  it('leaves a running session alone', () => {
    store.start('research', 'Write', A)
    expect(store.removeTaskTime([A])).toBe(0)
    expect(store.running()).not.toBeNull()
  })

  it('does nothing for a task with no time', () => {
    expect(store.removeTaskTime([A])).toBe(0)
    store.restoreTaskTime([A])
  })
})
