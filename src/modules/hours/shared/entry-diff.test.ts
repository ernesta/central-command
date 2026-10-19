import { describe, expect, it } from 'vitest'
import { at, nextId, ok, year } from '@shared/tracking/test-utils'
import { restoreEntries } from '@shared/tracking/totals'
import {
  renameTask,
  setStartAt,
  startSession,
  stopSession,
  runningSession
} from '@shared/tracking/timer'
import { entryDiff } from './entry-diff'

const D = '2026-09-29'

describe('entryDiff', () => {
  it('finds the trimmed neighbour and the moved start, and Undo puts both back', () => {
    let y = ok(startSession(year(), at(D, '09:00:00'), 'A', nextId()))
    y = ok(stopSession(y, at(D, '10:00:00')))
    y = ok(startSession(y, at(D, '10:30:00'), 'B', nextId()))
    const moved = ok(setStartAt(y, runningSession(y)!.id, '09:30:00', at(D, '10:45:00')))
    const diff = entryDiff(y, moved)
    expect(diff.before.sessions).toHaveLength(2)
    expect(ok(restoreEntries(moved, diff.before, diff.after))).toEqual(y)
  })

  it('finds both rows of a merging rename, so Undo splits them again', () => {
    let y = ok(startSession(year(), at(D, '09:00:00'), 'Deck', nextId()))
    y = ok(stopSession(y, at(D, '10:00:00')))
    y = ok(startSession(y, at(D, '10:00:00'), 'Slides', nextId()))
    y = ok(stopSession(y, at(D, '11:00:00')))
    const merged = ok(renameTask(y, D, 'Slides', 'Deck'))
    const diff = entryDiff(y, merged)
    // Only the renamed row changed; relabelling it back by name would have changed the other "Deck" too.
    expect(diff.before.sessions.map((s) => s.label)).toEqual(['Slides'])
    expect(ok(restoreEntries(merged, diff.before, diff.after))).toEqual(y)
  })

  it('has nothing for a change that touched no entry', () => {
    const y = ok(startSession(year(), at(D, '09:00:00'), 'A', nextId()))
    expect(entryDiff(y, y)).toEqual({
      before: { sessions: [], adjusts: [] },
      after: { sessions: [], adjusts: [] }
    })
  })
})
