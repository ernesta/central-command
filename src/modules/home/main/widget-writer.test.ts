import { mkdtemp, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { HomeSummary } from '../shared/types'
import { WidgetWriter } from './widget-writer'
import { tasksIn } from '../shared/summary.testing'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cc-widget-'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

const summary = (generatedAt: string, todayTotal = 1): HomeSummary => ({
  today: '2026-10-15',
  generatedAt,
  timer: null,
  hours: { research: null, work: null, life: null },
  tasks: tasksIn({ research: { todayTotal } }),
  meetings: { next: null, openTodos: 0 },
  upcoming: [],
  watch: null,
  weather: null
})

describe('WidgetWriter', () => {
  it('writes the snapshot, and rewrites only when something a widget shows changed', async () => {
    const w = new WidgetWriter(join(dir, 'widget'))
    expect(await w.write(summary('a'))).toBe(true)
    expect(JSON.parse(await readFile(join(dir, 'widget', 'snapshot.json'), 'utf8'))).toMatchObject({
      version: 1,
      generatedAt: 'a',
      taskCounts: { today: 1 }
    })
    expect(await w.write(summary('b'))).toBe(false)
    expect(await w.write(summary('c', 3))).toBe(true)
    expect(
      JSON.parse(await readFile(join(dir, 'widget', 'snapshot.json'), 'utf8')).taskCounts.today
    ).toBe(3)
  })

  it('writes the hours of both workspaces as the summary has them (derived hours included)', async () => {
    const w = new WidgetWriter(join(dir, 'widget'))
    const hours = {
      research: {
        label: 'This week' as const,
        minutes: 180,
        aimMinutes: 2250,
        todayMinutes: 30,
        clients: []
      },
      work: {
        label: 'This month' as const,
        minutes: 105,
        aimMinutes: 4800,
        todayMinutes: 0,
        clients: [{ client: 'Impact', minutes: 105 }]
      },
      life: null
    }
    await w.write({ ...summary('a'), hours })
    const written = JSON.parse(await readFile(join(dir, 'widget', 'snapshot.json'), 'utf8'))
    expect(written.version).toBe(1)
    expect(written.week).toEqual(hours.research)
    expect(written.work).toEqual(hours.work)
    // a change in the hours is a change a widget shows
    expect(await w.write({ ...summary('b'), hours: { ...hours, work: null } })).toBe(true)
  })
})
