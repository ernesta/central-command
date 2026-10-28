import { describe, expect, it } from 'vitest'
import {
  fieldLocked,
  hiddenTaskUids,
  lockedChanges,
  sessionLock,
  sessionLockIn,
  lockOf,
  seriesUids,
  studySeriesUids,
  visibleTrash,
  visibleTasks
} from './session-lock'
import { task } from './test-utils'

const sub = task({ uid: 's', parentUid: 'p', ownKind: 'meeting', due: '2026-10-10' })
const parent = task({ uid: 'p' })
const plain = task({ uid: 'x' })

const study = task({ uid: 'st', parentUid: 'p', ownKind: 'self-study', due: '2026-10-10' })

describe('sessionLock', () => {
  it('a self-study task is a session task', () => {
    expect(sessionLock(study, [])).toBe('session')
    expect(sessionLockIn(study, [study, parent])).toBe('session')
  })
  it('a meeting’s or training’s own task has no lock of its own (it is never shown)', () => {
    for (const ownKind of ['meeting', 'training'] as const) {
      const own = task({ uid: 'o', parentUid: 'p', ownKind })
      expect(sessionLock(own, [])).toBeNull()
      expect(sessionLockIn(own, [own, parent])).toBeNull()
    }
  })
  it('a top-level task with a session subtask is a series', () => {
    expect(sessionLock(parent, [sub])).toBe('series')
    expect(sessionLockIn(parent, [sub, parent])).toBe('series')
  })
  it('any other task is free', () => {
    expect(sessionLock(plain, [])).toBeNull()
    expect(sessionLock(parent, [plain])).toBeNull()
    expect(sessionLockIn(plain, [sub, parent, plain])).toBeNull()
  })
})

describe('fieldLocked', () => {
  it('locks status and due date for a session task and a series', () => {
    for (const lock of ['session', 'series'] as const) {
      expect(fieldLocked(lock, 'status')).toBe(true)
      expect(fieldLocked(lock, 'due')).toBe(true)
    }
  })
  it('leaves priority, tags and notes free', () => {
    for (const f of ['priority', 'tags', 'description'] as const) {
      expect(fieldLocked('session', f)).toBe(false)
      expect(fieldLocked('series', f)).toBe(false)
    }
  })
})

describe('lockedChanges', () => {
  it('names the locked fields that would change', () => {
    expect(lockedChanges(sub, 'session', { title: 'New', priority: 'high' })).toEqual(['title'])
  })
  it('ignores a locked field set to its current value', () => {
    expect(lockedChanges(sub, 'session', { title: sub.title, due: sub.due })).toEqual([])
  })
  it('keeps a series’ due date and status the sweep’s', () => {
    expect(lockedChanges(parent, 'series', { due: '2026-11-01' })).toEqual(['due'])
  })
  it('allows anything on a free task', () => {
    expect(lockedChanges(plain, null, { title: 'x', due: '2026-11-01' })).toEqual([])
  })
})

describe('hiddenTaskUids', () => {
  const tasks = [
    task({ uid: 'm', ownKind: 'meeting' }),
    task({ uid: 'series' }),
    task({ uid: 't1', parentUid: 'series', ownKind: 'training' }),
    task({ uid: 't2', parentUid: 'series', ownKind: 'training' }),
    task({ uid: 'study', title: 'S self-study' }),
    task({ uid: 's1', parentUid: 'study', ownKind: 'self-study' }),
    task({ uid: 'mixed' }),
    task({ uid: 'x1', parentUid: 'mixed', ownKind: 'training' }),
    task({ uid: 'x2', parentUid: 'mixed' }),
    task({ uid: 'plain' })
  ]

  it('hides a meeting’s task, a training’s session tasks, and the series task over only those', () => {
    expect([...hiddenTaskUids(tasks)].sort()).toEqual(['m', 'series', 't1', 't2', 'x1'])
  })

  it('keeps self-study tasks and their parent, a series task with a subtask the user made, and ordinary tasks', () => {
    const shown = visibleTasks(tasks).map((t) => t.uid)
    expect(shown).toHaveLength(5)
    expect(shown).not.toContain('x1')
    for (const uid of ['study', 's1', 'mixed', 'x2', 'plain']) expect(shown).toContain(uid)
  })

  it('never hides a childless task', () => {
    expect(hiddenTaskUids([task({ uid: 'a' })]).size).toBe(0)
  })
})

describe('studySeriesUids', () => {
  it('names the series task over self-study tasks, and nothing else', () => {
    const tasks = [
      task({ uid: 'study' }),
      task({ uid: 's1', parentUid: 'study', ownKind: 'self-study' }),
      task({ uid: 'series' }),
      task({ uid: 't1', parentUid: 'series', ownKind: 'training' }),
      task({ uid: 'mixed' }),
      task({ uid: 'x', parentUid: 'mixed' }),
      task({ uid: 'plain' })
    ]
    expect([...studySeriesUids(tasks)]).toEqual(['study'])
  })
})

describe('a series task that is shown because the user made a subtask under it', () => {
  const tasks = [
    task({ uid: 'mixed' }),
    task({ uid: 'x1', parentUid: 'mixed', ownKind: 'meeting' }),
    task({ uid: 'x2', parentUid: 'mixed' }),
    task({ uid: 'plain' })
  ]
  it('is still a series, though the rows a view builds from visible tasks do not show the session subtask', () => {
    const shown = visibleTasks(tasks)
    const mixed = shown.find((t) => t.uid === 'mixed')!
    const kids = shown.filter((t) => t.parentUid === 'mixed')
    expect(sessionLock(mixed, kids)).toBeNull()
    expect([...seriesUids(tasks)]).toEqual(['mixed'])
    expect(lockOf(mixed, kids, seriesUids(tasks))).toBe('series')
    expect(
      lockOf(
        shown.find((t) => t.uid === 'plain')!,
        [],
        seriesUids(tasks)
      )
    ).toBeNull()
  })
})

describe('visibleTrash', () => {
  const row = (t: ReturnType<typeof task>): { task: ReturnType<typeof task> } => ({ task: t })
  it('never lists a deleted meeting’s or training’s own task, nor the series task over only those', () => {
    const trash = [
      row(task({ uid: 'm', parentUid: 'ser', ownKind: 'meeting' })),
      row(task({ uid: 'ser' })),
      row(task({ uid: 't', ownKind: 'training' })),
      row(task({ uid: 'study', parentUid: 'ss', ownKind: 'self-study' })),
      row(task({ uid: 'ss' })),
      row(task({ uid: 'plain' }))
    ]
    expect(visibleTrash(trash).map((r) => r.task.uid)).toEqual(['study', 'ss', 'plain'])
  })
})
