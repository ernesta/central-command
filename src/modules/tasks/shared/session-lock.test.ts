import { describe, expect, it } from 'vitest'
import { fieldLocked, lockedChanges, sessionLock, sessionLockIn } from './session-lock'
import { task } from './test-utils'

const sub = task({ uid: 's', parentUid: 'p', ownKind: 'meeting', due: '2026-10-10' })
const parent = task({ uid: 'p' })
const plain = task({ uid: 'x' })

describe('sessionLock', () => {
  it('a task with an own kind is a session task', () => {
    expect(sessionLock(sub, [])).toBe('session')
    expect(sessionLockIn(sub, [sub, parent])).toBe('session')
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
  it('locks status for a session task only', () => {
    expect(fieldLocked('session', 'status')).toBe(true)
    expect(fieldLocked('series', 'status')).toBe(false)
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
  it('lets a series lose its due date but never gain one', () => {
    expect(lockedChanges(parent, 'series', { due: null })).toEqual([])
    expect(lockedChanges(parent, 'series', { due: '2026-11-01' })).toEqual(['due'])
  })
  it('allows anything on a free task', () => {
    expect(lockedChanges(plain, null, { title: 'x', due: '2026-11-01' })).toEqual([])
  })
})
