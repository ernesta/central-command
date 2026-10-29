import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import { watchMigrations } from './migrations'
import { applyReparse, planReparse } from './reparse'
import { addSource, listItems, listSources } from './repository'

const TODAY = '2026-10-28'
let db: Database.Database
beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, watchMigrations)
})

const source = (url: string, method: 'page' | 'feed' = 'page'): number =>
  addSource(db, { title: url, url, method }, '2026-10-01T00:00:00.000Z').id

function item(
  sourceId: number,
  key: string,
  title: string,
  state: string,
  dates: { event?: string; end?: string; deadline?: string } = {},
  summary = ''
): void {
  db.prepare(
    `INSERT INTO watch_items (source_id, item_key, title, url, summary, event_date, event_end, deadline, state, first_seen_at)
     VALUES (?, ?, ?, 'u', ?, ?, ?, ?, ?, 'x')`
  ).run(
    sourceId,
    key,
    title,
    summary,
    dates.event ?? null,
    dates.end ?? null,
    dates.deadline ?? null,
    state
  )
}

describe('watch:reparse', () => {
  it("removes an unsaved link to the site's own home page, and an event beside the listing stays", () => {
    const s = source('https://ex.ac.uk/school/news/events.aspx')
    const put = (key: string, url: string, title: string): void => {
      db.prepare(
        `INSERT INTO watch_items (source_id, item_key, title, url, event_date, state, first_seen_at)
         VALUES (?, ?, ?, ?, '2026-10-29', 'new', 'x')`
      ).run(s, key, title, url)
    }
    put('a', 'https://ex.ac.uk/school/news/home.aspx', 'News | Events')
    put('b', 'https://ex.ac.uk/school/home.aspx', 'Doctoral School')
    put('c', 'https://ex.ac.uk/school/news/articles/r-course.aspx', 'Good Practice for R Users')
    const plan = planReparse(db, TODAY)
    expect(plan[0].items.map((p) => [p.item.title, p.remove])).toEqual(
      expect.arrayContaining([
        ['News | Events', "the site's menu"],
        ['Doctoral School', "the site's menu"],
        ['Good Practice for R Users', null]
      ])
    )
  })

  it("removes an unsaved link to the site's search (a card's tag), and the event itself stays", () => {
    const s = source('https://ex.ac.uk/events')
    const put = (key: string, url: string, title: string): void => {
      db.prepare(
        `INSERT INTO watch_items (source_id, item_key, title, url, event_date, state, first_seen_at)
         VALUES (?, ?, ?, ?, '2026-11-05', 'new', 'x')`
      ).run(s, key, title, url)
    }
    put('a', 'https://ex.ac.uk/search/?keywords=Public%20spending', 'Public spending')
    put('b', 'https://ex.ac.uk/events/bsa-defence-and-security', 'BSA: Defence and Security')
    const plan = planReparse(db, TODAY)
    expect(plan[0].items.map((p) => [p.item.title, p.remove])).toEqual(
      expect.arrayContaining([
        ['Public spending', 'a search link'],
        ['BSA: Defence and Security', null]
      ])
    )
  })

  it('removes an unsaved link to a feed of the site\'s events ("Follow our events")', () => {
    const s = source('https://ex.ac.uk/events')
    item(s, 'a', 'Follow our events', 'new', { event: '2026-11-05' })
    db.prepare('UPDATE watch_items SET url = ? WHERE item_key = ?').run(
      'https://ex.ac.uk/feed/?post_type=event',
      'a'
    )
    const plan = planReparse(db, TODAY)
    expect(plan[0].items.map((p) => [p.item.title, p.remove])).toEqual(
      expect.arrayContaining([['Follow our events', 'a feed link']])
    )
  })

  it('removes unsaved items a page source would not store now, and keeps the ones it would', () => {
    const s = source('https://ex.org/events')
    item(s, 'a', 'FAQs', 'new')
    item(s, 'b', 'Website Design by Kall Kwik Romford', 'new', { event: '2027-01-01' })
    item(s, 'c', 'researchED Doha', 'new', { event: '2026-11-14' })
    item(s, 'd', 'An old conference', 'seen', { event: '2026-09-15' })
    item(s, 'e', 'Spring school', 'seen', {}, 'Held 8-10 June 2027 in Leiden')
    const plan = planReparse(db, TODAY)
    expect(plan).toHaveLength(1)
    expect(plan[0].items.map((p) => [p.item.title, p.remove])).toEqual(
      expect.arrayContaining([
        ['FAQs', 'no coming date'],
        ['Website Design by Kall Kwik Romford', 'a credit or a cookie notice'],
        ['researchED Doha', null],
        ['An old conference', 'already over'],
        ['Spring school', null]
      ])
    )
  })

  it('never removes a saved item, whatever the rules say, and leaves feeds alone', () => {
    const s = source('https://ex.org/events')
    const f = source('https://ex.org/feed', 'feed')
    item(s, 'a', 'FAQs', 'saved')
    item(f, 'b', 'A feed item with no date', 'new')
    const plan = planReparse(db, TODAY)
    expect(plan.map((p) => p.sourceId)).toEqual([s])
    expect(plan[0]).toMatchObject({ saved: 1, items: [] })
    expect(applyReparse(db, plan)).toBe(0)
    expect(
      listItems(db)
        .map((i) => i.title)
        .sort()
    ).toEqual(['A feed item with no date', 'FAQs'])
  })

  it('forgets the page’s validators and the way that worked, and changes nothing about the source itself', () => {
    const s = source('https://ex.org/events')
    db.prepare(
      "UPDATE watch_sources SET etag = 'e', last_modified = 'm', page_hash = 'h', found_via = 'tribe:x', changed_at = 'c' WHERE id = ?"
    ).run(s)
    item(s, 'a', 'FAQs', 'new')
    const before = listSources(db)[0]
    expect(applyReparse(db, planReparse(db, TODAY))).toBe(1)
    const row = db
      .prepare('SELECT etag, last_modified, page_hash, found_via, changed_at FROM watch_sources')
      .get()
    expect(row).toEqual({
      etag: null,
      last_modified: null,
      page_hash: null,
      found_via: null,
      changed_at: null
    })
    const after = listSources(db)[0]
    expect([after.title, after.url, after.method, after.workspace, after.active]).toEqual([
      before.title,
      before.url,
      before.method,
      before.workspace,
      before.active
    ])
  })

  it('a dry run (the plan) changes nothing', () => {
    const s = source('https://ex.org/events')
    item(s, 'a', 'FAQs', 'new')
    planReparse(db, TODAY)
    expect(listItems(db)).toHaveLength(1)
  })
})
