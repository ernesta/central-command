import { describe, expect, it } from 'vitest'
import { DEFAULT_HOME_SETTINGS } from '@shared/home-settings'
import type { PlannedNotification } from '../shared/notifications'
import type { HomeSummary } from '../shared/types'
import { Notifier, type SentStore } from './notifier'
import { tasksIn } from '../shared/summary.testing'

const summary: HomeSummary = {
  today: '2026-10-15',
  generatedAt: '',
  timer: null,
  hours: { research: null, work: null, life: null },
  tasks: tasksIn({ research: { todayTotal: 2 } }),
  meetings: { next: null, openTodos: 0 },
  upcoming: [],
  watch: null,
  weather: null
}

function setup(enabled = true): {
  n: Notifier
  shown: PlannedNotification[]
  file: { value: { sent: Record<string, string>; since: string | null } }
  clock: { time: string }
  saves: () => number
} {
  const shown: PlannedNotification[] = []
  const file = { value: { sent: {} as Record<string, string>, since: null as string | null } }
  let saves = 0
  const store: SentStore = {
    load: () => file.value,
    save: (v) => {
      saves++
      file.value = v
    }
  }
  const clock = { time: '08:00' }
  const n = new Notifier({
    summary: () => summary,
    settings: () => ({ ...DEFAULT_HOME_SETTINGS.notifications, enabled }),
    store,
    show: (x) => shown.push(x),
    now: () => ({ date: '2026-10-15', time: clock.time }),
    nowIso: () => '2026-10-15T08:00:00.000Z'
  })
  return { n, shown, file, clock, saves: () => saves }
}

describe('Notifier', () => {
  it('does nothing and writes nothing while off', () => {
    const { n, shown, saves } = setup(false)
    expect(n.tick()).toEqual([])
    expect(shown).toEqual([])
    expect(saves()).toBe(0)
  })

  it('shows the digest once, remembers it across a restart, and starts the clock on the first pass', () => {
    const { n, shown, file, clock } = setup()
    expect(n.tick()).toEqual([]) // 08:00, before the digest time
    expect(file.value.since).toBe('2026-10-15T08:00:00.000Z')
    clock.time = '08:31'
    expect(n.tick()).toHaveLength(1)
    expect(n.tick()).toEqual([])
    expect(shown).toHaveLength(1)
    expect(file.value.sent).toEqual({ 'digest:research:2026-10-15': '2026-10-15' })
    // A new Notifier over the same file (the app restarted) does not repeat it.
    const again = new Notifier({
      summary: () => summary,
      settings: () => ({ ...DEFAULT_HOME_SETTINGS.notifications, enabled: true }),
      store: { load: () => file.value, save: (v) => (file.value = v) },
      show: (x) => shown.push(x),
      now: () => ({ date: '2026-10-15', time: '09:00' }),
      nowIso: () => 'x'
    })
    expect(again.tick()).toEqual([])
    expect(shown).toHaveLength(1)
  })
})
