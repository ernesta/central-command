import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import { checkSource, type Fetcher } from './checker'
import { readEntryLink } from './entry-link'
import { watchMigrations } from './migrations'
import { applyReparse, planReparse } from './reparse'
import {
  addSource,
  createManualItem,
  deleteManualItem,
  getCounts,
  listItems,
  listSources,
  reclassifyItems,
  restoreManualItem,
  setItemState,
  updateManualItem,
  upcoming
} from './repository'

let db: Database.Database
beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, watchMigrations)
})

const NOW = '2026-10-29T09:00:00.000Z'
const JACOBS = {
  title: 'BOLD Science Communication Fellowship',
  section: 'opportunity' as const,
  url: 'https://jacobsfoundation.org/bold/',
  summary: 'Six-month fellowship.',
  eventDate: '2026-09-01',
  eventEnd: '2026-10-31',
  deadline: '2026-10-31',
  deadlineLabel: 'Apply by'
}

describe('migration 0008', () => {
  it('keeps every item and state, sets every source kind to the placeholder, and sorts items by their words', () => {
    const old = new Database(':memory:')
    old.pragma('foreign_keys = ON')
    runMigrations(old, watchMigrations.slice(0, 7))
    const kinds = ['conference', 'training', 'summer-school', 'journal', 'listing', 'other']
    kinds.forEach((kind, n) => {
      old
        .prepare(
          "INSERT INTO watch_sources (title, url, kind, method, created_at) VALUES (?, ?, ?, 'page', 'x')"
        )
        .run(`S${n}`, `https://ex.org/${n}`, kind)
    })
    const put = (
      source: number,
      key: string,
      title: string,
      state: string,
      itemKind: string | null
    ): void => {
      old
        .prepare(
          `INSERT INTO watch_items (source_id, item_key, title, url, state, first_seen_at, item_kind)
           VALUES (?, ?, ?, 'https://ex.org/i', ?, '2026-10-01T00:00:00.000Z', ?)`
        )
        .run(source, key, title, state, itemKind)
    }
    put(1, 'a', 'Annual Conference', 'saved', null)
    put(2, 'b', 'Summer school in R', 'seen', null)
    put(3, 'c', 'Special issue on reading (Jrnl)', 'new', 'conference')
    put(4, 'd', 'Masterclass', 'new', 'training')
    runMigrations(old, watchMigrations)
    reclassifyItems(old)
    const items = old
      .prepare('SELECT title, state, section, manual FROM watch_items ORDER BY id')
      .all()
    expect(items).toEqual([
      { title: 'Annual Conference', state: 'saved', section: 'conference', manual: 0 },
      { title: 'Summer school in R', state: 'seen', section: 'training', manual: 0 },
      { title: 'Special issue on reading (Jrnl)', state: 'new', section: 'opportunity', manual: 0 },
      { title: 'Masterclass', state: 'new', section: 'training', manual: 0 }
    ])
    expect(old.prepare('SELECT DISTINCT kind FROM watch_sources').all()).toEqual([
      { kind: 'conference' }
    ])
    expect(listSources(old)).toHaveLength(6)
  })
})

describe('reclassifyItems', () => {
  it("lets a training source's name decide what its words leave open", () => {
    const wrdtp = addSource(
      db,
      { title: 'WRDTP: Training and events calendar', url: 'https://w.ac.uk/', method: 'page' },
      NOW
    )
    const nlt = addSource(
      db,
      { title: 'National Literacy Trust', url: 'https://n.org/', method: 'page' },
      NOW
    )
    const put = (source: number, key: string, title: string): void => {
      db.prepare(
        `INSERT INTO watch_items (source_id, item_key, title, url, first_seen_at)
         VALUES (?, ?, ?, 'https://ex.org/i', ?)`
      ).run(source, key, title, NOW)
    }
    put(wrdtp.id, 'a', 'Sharing Sensitive and Qualitative Data Openly')
    put(nlt.id, 'b', 'Reconstructing Reading 2026')
    reclassifyItems(db)
    expect(db.prepare('SELECT title, section FROM watch_items ORDER BY id').all()).toEqual([
      { title: 'Sharing Sensitive and Qualitative Data Openly', section: 'training' },
      { title: 'Reconstructing Reading 2026', section: 'conference' }
    ])
  })
})

describe('entries by hand', () => {
  it('are created Saved in their section, with the hidden source made on first use', () => {
    const item = createManualItem(db, JACOBS, NOW)
    expect(item).toMatchObject({
      state: 'saved',
      manual: true,
      section: 'opportunity',
      sourceTitle: 'Added by hand',
      deadline: '2026-10-31',
      deadlineLabel: 'Apply by'
    })
    expect(listItems(db, { section: 'opportunity' }).map((i) => i.id)).toEqual([item.id])
    expect(listItems(db, { section: 'conference' })).toEqual([])
    createManualItem(db, { ...JACOBS, title: 'Another' }, NOW)
    expect(db.prepare('SELECT COUNT(*) AS n FROM watch_sources').get()).toEqual({ n: 1 })
  })

  it('keep the section the user chose and default the deadline label', () => {
    const item = createManualItem(
      db,
      { title: 'Fellowship meeting', section: 'training', deadline: '2026-11-05' },
      NOW
    )
    reclassifyItems(db)
    expect(listItems(db)[0]).toMatchObject({
      id: item.id,
      section: 'training',
      deadlineLabel: 'Apply by'
    })
  })

  it('reach Coming up through the saved-only rule', () => {
    createManualItem(db, JACOBS, NOW)
    expect(upcoming(db, '2026-10-29', 14).map((i) => i.title)).toEqual([JACOBS.title])
  })

  it('can be edited and deleted, and a delete can be undone as it was', () => {
    const made = createManualItem(db, JACOBS, NOW)
    const edited = updateManualItem(db, made.id, {
      ...JACOBS,
      title: 'BOLD fellowship',
      section: 'training'
    })
    expect(edited).toMatchObject({ title: 'BOLD fellowship', section: 'training', manual: true })
    const gone = deleteManualItem(db, made.id)
    expect(listItems(db)).toEqual([])
    const back = restoreManualItem(db, gone, '2026-10-30T09:00:00.000Z')
    expect(back).toMatchObject({
      title: 'BOLD fellowship',
      section: 'training',
      state: 'saved',
      manual: true,
      firstSeenAt: made.firstSeenAt
    })
  })

  it('are the only items that can be edited or deleted', () => {
    const source = addSource(db, { title: 'S', url: 'https://ex.org/f', method: 'feed' }, NOW)
    db.prepare(
      `INSERT INTO watch_items (source_id, item_key, title, url, state, first_seen_at)
       VALUES (?, 'k', 'Auto', 'https://ex.org/i', 'new', ?)`
    ).run(source.id, NOW)
    const id = listItems(db)[0].id
    expect(() => deleteManualItem(db, id)).toThrow(/added by hand/)
    expect(() => updateManualItem(db, id, JACOBS)).toThrow(/added by hand/)
  })

  it('refuse a missing title, a bad date and an address that is not public', () => {
    expect(() => createManualItem(db, { ...JACOBS, title: ' ' }, NOW)).toThrow(/title/)
    expect(() => createManualItem(db, { ...JACOBS, deadline: '31/10/2026' }, NOW)).toThrow(/date/)
    expect(() => createManualItem(db, { ...JACOBS, url: 'file:///etc/passwd' }, NOW)).toThrow()
    expect(() => createManualItem(db, { ...JACOBS, eventEnd: '2026-08-01' }, NOW)).toThrow(/end/)
  })

  it('are not a source: not listed, not in the counts, never due', () => {
    createManualItem(db, JACOBS, NOW)
    createManualItem(db, JACOBS, NOW)
    expect(listSources(db)).toEqual([])
    expect(listSources(db, 'research')).toEqual([])
    expect(getCounts(db)).toMatchObject({ sources: 0, failing: 0, changed: 0 })
    expect(getCounts(db, 'research')).toMatchObject({ sources: 0, failing: 0 })
    expect(db.prepare('SELECT active FROM watch_sources').get()).toEqual({ active: 0 })
  })

  it('belong to the workspace they were made in', () => {
    createManualItem(db, { ...JACOBS, workspace: 'life' }, NOW)
    expect(listItems(db, { workspace: 'life' })).toHaveLength(1)
    expect(listItems(db, { workspace: 'research' })).toHaveLength(0)
  })
})

describe('entries by hand survive the checker', () => {
  const emptyFeed: Fetcher = async () => ({
    status: 200,
    headers: { get: () => null },
    text: async () => '<rss version="2.0"><channel></channel></rss>'
  })

  it('a source check, even one that is the whole truth about its source, never reaches them', async () => {
    const made = createManualItem(db, JACOBS, NOW)
    setItemState(db, made.id, 'seen')
    const manualSource = (
      db.prepare('SELECT id FROM watch_sources WHERE manual = 1').get() as { id: number }
    ).id
    // The hidden source itself checked as a page that says "no upcoming events": its items are not unsaved-and-automatic.
    const page: Fetcher = async () => ({
      status: 200,
      headers: { get: () => null },
      text: async () => '<html><body><main><p>No upcoming events.</p></main></body></html>'
    })
    const real = addSource(db, { title: 'S', url: 'https://ex.org/p', method: 'page' }, NOW)
    await checkSource(db, real, page, NOW)
    const hidden = db.prepare('SELECT * FROM watch_sources WHERE id = ?').get(manualSource) as never
    await checkSource(
      db,
      {
        ...(hidden as object),
        id: manualSource,
        lastOkAt: null,
        failures: 0,
        changedAt: null,
        method: 'page'
      } as never,
      page,
      NOW
    )
    await checkSource(db, real, emptyFeed, NOW)
    expect(listItems(db).map((i) => i.id)).toEqual([made.id])
  })

  it('a reparse removes nothing that was added by hand, even an unsaved one that is over', () => {
    const made = createManualItem(
      db,
      { ...JACOBS, deadline: '2026-01-01', eventDate: null, eventEnd: null },
      NOW
    )
    setItemState(db, made.id, 'seen')
    const plan = [
      {
        sourceId: 1,
        title: 'x',
        url: 'x',
        method: 'page',
        saved: 0,
        items: [{ item: listItems(db)[0], remove: 'already over' as const }]
      }
    ]
    expect(applyReparse(db, plan)).toBe(0)
    expect(listItems(db)).toHaveLength(1)
    expect(planReparse(db, '2026-10-29')).toEqual([])
  })
})

describe('reading a pasted link', () => {
  const page =
    (html: string, status = 200): Fetcher =>
    async () => ({ status, headers: { get: () => null }, text: async () => html })

  it('fills the title, description, dates and section from the page, with one request', async () => {
    let calls = 0
    const fetcher: Fetcher = async (...args) => {
      calls++
      return page(
        `<html><head><meta property="og:title" content="BOLD Science Communication Fellowship"><meta name="description" content="Six-month fellowship with a CHF 5,000 stipend."></head><body><main><p>Apply by 31 October 2026.</p></main></body></html>`
      )(...args)
    }
    const read = await readEntryLink('https://jacobsfoundation.org/bold/', fetcher, '2026-10-29')
    expect(calls).toBe(1)
    expect(read).toMatchObject({
      title: 'BOLD Science Communication Fellowship',
      summary: 'Six-month fellowship with a CHF 5,000 stipend.',
      section: 'opportunity',
      deadline: '2026-10-31',
      notice: null
    })
  })

  it('reads the one date of an opportunity as its deadline, not as an event', async () => {
    const read = await readEntryLink(
      'https://ex.org/f',
      page(
        '<html><head><meta property="og:title" content="Early Career Fellowship"></head><body><main><p>Applications: 31 October 2026.</p></main></body></html>'
      ),
      '2026-10-29'
    )
    expect(read).toMatchObject({
      section: 'opportunity',
      eventDate: null,
      deadline: '2026-10-31',
      deadlineLabel: 'Apply by'
    })
  })

  it('keeps the link and says so in one line when the page cannot be read', async () => {
    const read = await readEntryLink('https://ex.org/x', page('', 404), '2026-10-29')
    expect(read).toMatchObject({ url: 'https://ex.org/x', title: '' })
    expect(read.notice).toMatch(/Couldn’t read/)
    const none = await readEntryLink(
      'https://ex.org/y',
      page('<html><body></body></html>'),
      '2026-10-29'
    )
    expect(none.notice).toMatch(/title/)
  })

  it('refuses an address that is not public', async () => {
    await expect(readEntryLink('http://localhost/x', page(''), '2026-10-29')).rejects.toThrow()
  })
})
