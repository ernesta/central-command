import { mkdtemp, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { HomeSummary } from '../shared/types'
import { WidgetWriter } from './widget-writer'

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
  hours: null,
  tasks: { overdue: [], today: [], overdueTotal: 0, todayTotal },
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
})
