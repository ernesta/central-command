import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import { checkSource, dueSources, rescoreItems, type Fetcher } from './checker'
import { watchMigrations } from './migrations'
import {
  addSource,
  getCounts,
  getKeywords,
  getSource,
  listItems,
  listSources,
  markAllSeen,
  openItem,
  removeSource,
  setItemState,
  setKeywords,
  updateSource,
  upcoming
} from './repository'

let db: Database.Database
beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, watchMigrations)
})

const NOW = '2026-10-15T09:00:00.000Z'

const feed = (items: { id: string; title: string; date?: string; body?: string }[]): string =>
  `<rss version="2.0"><channel>${items
    .map(
      (i) =>
        `<item><title>${i.title}</title><link>https://ex.org/${i.id}</link>${
          i.date ? `<pubDate>${i.date}</pubDate>` : ''
        }<description>${i.body ?? ''}</description></item>`
    )
    .join('')}</channel></rss>`

function respond(
  body: string,
  extra: { status?: number; headers?: Record<string, string> } = {}
): Fetcher {
  return async () => ({
    status: extra.status ?? 200,
    headers: { get: (n) => extra.headers?.[n.toLowerCase()] ?? null },
    text: async () => body
  })
}

const add = (over = {}): ReturnType<typeof addSource> =>
  addSource(
    db,
    { title: 'Confs', url: 'https://ex.org/feed', kind: 'conference', method: 'feed', ...over },
    NOW
  )

describe('sources', () => {
  it('stores a source and refuses a second one for the same address', () => {
    const s = add()
    expect(s).toMatchObject({
      title: 'Confs',
      intervalHours: 24,
      active: true,
      lastOkAt: null,
      newCount: 0
    })
    expect(() => add({ title: 'Again' })).toThrow('Already watching')
  })

  it('refuses addresses that are not public web pages', () => {
    for (const url of [
      'file:///etc/passwd',
      'ftp://ex.org/x',
      'http://localhost:3000/',
      'http://192.168.1.1/',
      'nonsense',
      'https://intranet/x'
    ])
      expect(() => add({ url })).toThrow()
  })

  it('needs an ISSN for a journal', () => {
    expect(() => add({ method: 'crossref', url: 'https://ex.org/j' })).toThrow('ISSN')
    expect(add({ method: 'crossref', url: 'https://ex.org/j', issn: '1088-8438' }).issn).toBe(
      '1088-8438'
    )
  })

  it('updates, lists and removes with its items', async () => {
    const s = add()
    await checkSource(
      db,
      s,
      respond(feed([{ id: 'a', title: 'A', date: 'Wed, 14 Oct 2026 10:00:00 GMT' }])),
      NOW
    )
    expect(updateSource(db, s.id, { title: 'Renamed', active: false })).toMatchObject({
      title: 'Renamed',
      active: false
    })
    expect(listSources(db)).toHaveLength(1)
    removeSource(db, s.id)
    expect(listSources(db)).toEqual([])
    expect(listItems(db)).toEqual([])
  })
})

describe('checkSource on a feed', () => {
  it('makes every item new on the first check, old and undated ones too', async () => {
    const s = add()
    const body = feed([
      { id: 'recent', title: 'Recent call', date: 'Wed, 14 Oct 2026 10:00:00 GMT' },
      { id: 'old', title: 'Old call', date: 'Mon, 01 Jun 2026 10:00:00 GMT' },
      { id: 'undated', title: 'Undated call' }
    ])
    const out = await checkSource(db, s, respond(body), NOW)
    expect(out).toMatchObject({ status: 'ok', added: 3, baseline: true })
    const byTitle = Object.fromEntries(listItems(db).map((i) => [i.title, i.state]))
    expect(byTitle).toEqual({ 'Recent call': 'new', 'Old call': 'new', 'Undated call': 'new' })
    expect(getSource(db, s.id)).toMatchObject({ lastOkAt: NOW, lastError: null, failures: 0 })
  })

  it('after the baseline, only what it has not held before is new, and nothing twice', async () => {
    const s = add()
    await checkSource(db, s, respond(feed([{ id: 'a', title: 'A' }])), NOW)
    const again = getSource(db, s.id)!
    const out = await checkSource(
      db,
      again,
      respond(
        feed([
          { id: 'a', title: 'A' },
          { id: 'b', title: 'B' }
        ])
      ),
      '2026-10-16T09:00:00.000Z'
    )
    expect(out).toMatchObject({ added: 1, baseline: false })
    expect(listItems(db).map((i) => i.title)).toHaveLength(2)
    expect(listItems(db, { state: 'new' }).map((i) => i.title)).toContain('B')
  })

  it('adds nothing whose every date has passed, on the first check or later', async () => {
    const s = add()
    const body = feed([
      { id: 'over', title: 'Workshop on 3 March 2026' },
      { id: 'late', title: 'Call, apply by 1 October 2026' },
      { id: 'open', title: 'Call, apply by 20 December 2026' },
      { id: 'plain', title: 'Call with no date' }
    ])
    const out = await checkSource(db, s, respond(body), NOW)
    expect(out.added).toBe(2)
    expect(
      listItems(db)
        .map((i) => i.title)
        .sort()
    ).toEqual(['Call with no date', 'Call, apply by 20 December 2026'])
  })

  it('finds the deadline in the text and scores keywords', async () => {
    const s = add()
    const body = feed([
      {
        id: 'x',
        title: 'Workshop on Multilingual literacy',
        date: 'Wed, 14 Oct 2026 10:00:00 GMT',
        body: 'Abstracts by 10 November 2026. Event on 12-14 July 2027.'
      }
    ])
    await checkSource(db, s, respond(body), NOW)
    expect(listItems(db)[0]).toMatchObject({
      date: '2026-11-10',
      dateKind: 'deadline',
      score: 6,
      matched: ['literacy', 'multilingual']
    })
  })

  it('reports an error without throwing and slows the source down', async () => {
    const s = add()
    const out = await checkSource(db, s, respond('<html>Please log in</html>'), NOW)
    expect(out).toMatchObject({ status: 'error', error: 'Not a feed' })
    expect(getSource(db, s.id)).toMatchObject({
      lastError: 'Not a feed',
      failures: 1,
      lastOkAt: null
    })
    const failing = getSource(db, s.id)!
    const out2 = await checkSource(db, failing, respond('', { status: 503 }), NOW)
    expect(out2.error).toBe('The site answered 503')
    expect(getSource(db, s.id)!.failures).toBe(2)
    expect(getCounts(db).failing).toBe(1)
  })

  it('treats a network failure as an error too', async () => {
    const s = add()
    const out = await checkSource(db, s, async () => Promise.reject(new Error('offline')), NOW)
    expect(out).toMatchObject({ status: 'error', error: 'offline' })
  })

  it('sends the validators it was given and keeps the unchanged answer quiet', async () => {
    const s = add()
    await checkSource(
      db,
      s,
      respond(feed([{ id: 'a', title: 'A' }]), { headers: { etag: '"v1"' } }),
      NOW
    )
    let seen: Record<string, string> = {}
    const second: Fetcher = async (_url, init) => {
      seen = init.headers
      return { status: 304, headers: { get: () => null }, text: async () => '' }
    }
    const out = await checkSource(db, getSource(db, s.id)!, second, '2026-10-16T09:00:00.000Z')
    expect(seen['If-None-Match']).toBe('"v1"')
    expect(out).toMatchObject({ status: 'unchanged', added: 0 })
    expect(getSource(db, s.id)!.lastOkAt).toBe('2026-10-16T09:00:00.000Z')
  })

  it('stores at most 60 new items from one check', async () => {
    const s = add()
    const many = feed(Array.from({ length: 90 }, (_, i) => ({ id: `i${i}`, title: `Item ${i}` })))
    const out = await checkSource(db, s, respond(many), NOW)
    expect(out.added).toBe(60)
  })
})

describe('checkSource on a page', () => {
  const page = (links: string[], extra = ''): string =>
    `<html><body><main>${links.map((l, i) => `<a href="/c/${i}">${l}</a>`).join('')}${extra}</main></body></html>`

  it('makes the first look new, then reports a new link and a changed text', async () => {
    const s = add({ method: 'page', url: 'https://ex.org/calendar' })
    const first = await checkSource(db, s, respond(page(['Course on regression models'])), NOW)
    expect(first).toMatchObject({ added: 1, baseline: true })
    expect(getCounts(db).new).toBe(1)

    const t2 = '2026-10-16T09:00:00.000Z'
    await checkSource(
      db,
      getSource(db, s.id)!,
      respond(page(['Course on regression models', 'Summer school in Essex'])),
      t2
    )
    expect(listItems(db, { state: 'new' })).toHaveLength(2)
    expect(getSource(db, s.id)!.changedAt).toBeNull()

    // Same links, different text: no item, but the page is flagged.
    const t3 = '2026-10-17T09:00:00.000Z'
    await checkSource(
      db,
      getSource(db, s.id)!,
      respond(
        page(['Course on regression models', 'Summer school in Essex'], '<p>Now fully booked</p>')
      ),
      t3
    )
    expect(getSource(db, s.id)!.changedAt).toBe(t3)
    expect(getCounts(db).changed).toBe(1)
    markAllSeen(db, s.id)
    expect(getSource(db, s.id)!.changedAt).toBeNull()
  })
})

describe('checkSource on Crossref', () => {
  it('reads articles and uses the ISSN in the request', async () => {
    const s = add({ method: 'crossref', url: 'https://ex.org/journal', issn: '1088-8438' })
    let asked = ''
    const f: Fetcher = async (url) => {
      asked = url
      return {
        status: 200,
        headers: { get: () => null },
        text: async () =>
          JSON.stringify({
            status: 'ok',
            message: {
              items: [
                {
                  DOI: '10.1/x',
                  type: 'journal-article',
                  title: ['Reading acquisition in Ghana'],
                  created: { 'date-time': '2026-10-10T00:00:00Z' }
                }
              ]
            }
          })
      }
    }
    const out = await checkSource(db, s, f, NOW)
    expect(asked).toContain('api.crossref.org/journals/1088-8438/works')
    expect(out.added).toBe(1)
    expect(listItems(db)[0]).toMatchObject({
      state: 'new',
      score: 3,
      url: 'https://doi.org/10.1/x'
    })
  })
})

describe('items, keywords, upcoming and counts', () => {
  async function seed(): Promise<void> {
    const s = add()
    await checkSource(
      db,
      s,
      respond(
        feed([
          {
            id: '1',
            title: 'Plain event',
            date: 'Wed, 14 Oct 2026 10:00:00 GMT',
            body: 'Held 20 November 2026'
          },
          {
            id: '2',
            title: 'Literacy summit',
            date: 'Tue, 13 Oct 2026 10:00:00 GMT',
            body: 'Abstracts due by 1 December 2026'
          },
          {
            id: '3',
            title: 'Far away',
            date: 'Mon, 12 Oct 2026 10:00:00 GMT',
            body: 'In March 2028, 3 March 2028'
          }
        ])
      ),
      NOW
    )
  }

  it('orders new items by the day found, then the day published (keywords do not order them)', async () => {
    await seed()
    expect(listItems(db).map((i) => i.title)).toEqual([
      'Plain event',
      'Literacy summit',
      'Far away'
    ])
    expect(listItems(db, { relevantOnly: true }).map((i) => i.title)).toEqual(['Literacy summit'])
    expect(getCounts(db)).toMatchObject({ new: 3, newRelevant: 1, sources: 1 })
  })

  it('lists only SAVED items that are dated within a window, soonest first', async () => {
    await seed()
    // Nothing is saved, so nothing reaches Home's "Coming up" or a notification, however near its date.
    expect(upcoming(db, '2026-10-15', 800)).toEqual([])
    const byTitle = (t: string): number => listItems(db).find((i) => i.title === t)!.id
    for (const t of ['Plain event', 'Literacy summit', 'Far away'])
      setItemState(db, byTitle(t), 'saved')
    expect(upcoming(db, '2026-10-15', 60).map((i) => [i.title, i.date])).toEqual([
      ['Plain event', '2026-11-20'],
      ['Literacy summit', '2026-12-01']
    ])
    expect(upcoming(db, '2026-10-15', 800).map((i) => i.title)).toEqual([
      'Plain event',
      'Literacy summit',
      'Far away'
    ])
    // Reading a saved item's neighbours changes nothing; un-saving takes it off.
    setItemState(db, byTitle('Plain event'), 'seen')
    setItemState(db, byTitle('Far away'), 'seen')
    expect(upcoming(db, '2026-10-15', 800).map((i) => i.title)).toEqual(['Literacy summit'])
  })

  it('opening an item makes a new one read and leaves saved and read ones alone', async () => {
    await seed()
    const [a, b, c] = listItems(db)
    setItemState(db, b.id, 'saved')
    setItemState(db, c.id, 'seen')
    openItem(db, a.id)
    openItem(db, b.id)
    openItem(db, c.id)
    expect(
      listItems(db)
        .map((i) => i.state)
        .sort()
    ).toEqual(['saved', 'seen', 'seen'])
    expect(listItems(db, { state: 'new' })).toEqual([])
  })

  it('lists by kind: a summer school is a training, a journal is in neither section', async () => {
    const training = add({ url: 'https://ex.org/t', kind: 'training' })
    const school = add({ url: 'https://ex.org/s', kind: 'summer-school' })
    const conf = add({ url: 'https://ex.org/c', kind: 'conference' })
    for (const [s, id] of [
      [training, 't'],
      [school, 's'],
      [conf, 'c']
    ] as const)
      await checkSource(
        db,
        s,
        respond(feed([{ id, title: `Item ${id}`, date: 'Wed, 14 Oct 2026 10:00:00 GMT' }])),
        NOW
      )
    expect(
      listItems(db, { kind: 'training' })
        .map((i) => i.title)
        .sort()
    ).toEqual(['Item s', 'Item t'])
    expect(listItems(db, { kind: 'conference' }).map((i) => i.title)).toEqual(['Item c'])
  })

  it('"open" is new plus saved; mark-all-seen leaves saved alone', async () => {
    await seed()
    const [a, b] = listItems(db)
    setItemState(db, a.id, 'saved')
    expect(listItems(db, { state: 'open' })).toHaveLength(3)
    expect(markAllSeen(db)).toBe(2)
    expect(listItems(db, { state: 'saved' })).toHaveLength(1)
    expect(listItems(db, { state: 'seen' })).toHaveLength(2)
    expect(() => setItemState(db, b.id, 'dismissed' as never)).toThrow('Invalid state')
    expect(() => setItemState(db, a.id, 'bogus' as never)).toThrow('Invalid state')
  })

  it('keeps keywords lower-case and unique, falls back to the defaults, and re-scores', async () => {
    await seed()
    expect(getKeywords(db)).toContain('literacy')
    expect(setKeywords(db, ['Summit', 'summit', ' '])).toEqual(['summit'])
    rescoreItems(db)
    expect(listItems(db).map((i) => [i.title, i.score])).toEqual([
      ['Plain event', 0],
      ['Literacy summit', 3],
      ['Far away', 0]
    ])
    expect(getKeywords(db)).toEqual(['summit'])
    expect(setKeywords(db, [])).toContain('literacy')
  })
})

describe('dueSources', () => {
  const src = (over: object): never =>
    ({ active: true, intervalHours: 24, failures: 0, lastCheckedAt: null, ...over }) as never

  it('lists never-checked and overdue sources, oldest check first, skipping inactive ones', () => {
    const list = [
      src({ id: 1, lastCheckedAt: '2026-10-14T08:00:00.000Z' }),
      src({ id: 2, lastCheckedAt: null }),
      src({ id: 3, lastCheckedAt: '2026-10-15T08:00:00.000Z' }),
      src({ id: 4, active: false })
    ]
    expect(dueSources(list, NOW).map((s) => s.id)).toEqual([2, 1])
  })

  it('waits longer after failures, up to a week', () => {
    const checked = '2026-10-14T09:00:00.000Z'
    expect(dueSources([src({ id: 1, failures: 2, lastCheckedAt: checked })], NOW)).toEqual([])
    expect(
      dueSources([src({ id: 1, failures: 2, lastCheckedAt: '2026-10-11T08:00:00.000Z' })], NOW)
    ).toHaveLength(1)
    expect(
      dueSources([src({ id: 1, failures: 30, lastCheckedAt: '2026-10-08T08:00:00.000Z' })], NOW)
    ).toHaveLength(1)
  })
})

describe('changing a source', () => {
  it('moves it to a new address with a fresh baseline, and refuses an address already watched', async () => {
    const a = add()
    const b = add({ url: 'https://ex.org/other' })
    await checkSource(db, a, respond(feed([{ id: '1', title: 'One' }])), NOW)
    expect(getSource(db, a.id)?.lastOkAt).not.toBeNull()
    expect(() => updateSource(db, a.id, { url: b.url })).toThrow('Already watching')
    expect(() => updateSource(db, a.id, { url: 'file:///x' })).toThrow()
    const moved = updateSource(db, a.id, { url: 'https://ex.org/new#frag', title: 'Moved' })
    expect(moved).toMatchObject({ url: 'https://ex.org/new', title: 'Moved', lastOkAt: null })
    expect(updateSource(db, a.id, { title: 'Same address' }).url).toBe('https://ex.org/new')
  })
})

describe('the two kinds migration', () => {
  it('turns stored summer schools into trainings', () => {
    const old = new Database(':memory:')
    runMigrations(old, watchMigrations.slice(0, 1))
    old
      .prepare(
        "INSERT INTO watch_sources (title, url, kind, method, created_at) VALUES ('S', 'https://ex.org/s', 'summer-school', 'page', 'x')"
      )
      .run()
    runMigrations(old, watchMigrations)
    expect(listSources(old).map((s) => s.kind)).toEqual(['training'])
  })
})

describe('migration 0005', () => {
  it('turns what was dismissed into read and leaves the other states alone', () => {
    const old = new Database(':memory:')
    old.pragma('foreign_keys = ON')
    runMigrations(old, watchMigrations.slice(0, 4))
    old
      .prepare(
        "INSERT INTO watch_sources (title, url, kind, method, created_at) VALUES ('S', 'https://ex.org/f', 'conference', 'feed', 'x')"
      )
      .run()
    for (const [k, state] of [
      ['a', 'dismissed'],
      ['b', 'new'],
      ['c', 'saved'],
      ['d', 'seen']
    ])
      old
        .prepare(
          "INSERT INTO watch_items (source_id, item_key, title, url, state, first_seen_at) VALUES (1, ?, ?, 'u', ?, 'x')"
        )
        .run(k, k, state)
    runMigrations(old, watchMigrations)
    expect(
      (
        old.prepare('SELECT item_key AS k, state FROM watch_items ORDER BY k').all() as {
          k: string
          state: string
        }[]
      ).map((r) => r.state)
    ).toEqual(['seen', 'new', 'saved', 'seen'])
  })
})

describe('an item’s dates', () => {
  it('stores the event range and the deadline apart, and drops what is over', async () => {
    const s = add()
    await checkSource(
      db,
      s,
      respond(
        feed([
          {
            id: 'a',
            title: 'Annual conference',
            body: 'Held 14-17 July 2027 in Santiago. Abstract submission closes 12 November 2026.'
          },
          { id: 'b', title: 'Past meeting', body: 'Held 3 May 2026.' },
          { id: 'c', title: 'No dates here', body: 'Come along.' }
        ])
      ),
      NOW
    )
    const items = listItems(db)
    expect(items.map((i) => i.title).sort()).toEqual(['Annual conference', 'No dates here'])
    const a = items.find((i) => i.title === 'Annual conference')!
    expect([a.eventDate, a.eventEnd, a.deadline, a.deadlineLabel]).toEqual([
      '2027-07-14',
      '2027-07-17',
      '2026-11-12',
      'Submit by'
    ])
    // Home's one date is the deadline while it is ahead.
    expect([a.date, a.dateKind]).toEqual(['2026-11-12', 'deadline'])
  })

  it('a saved item’s coming-up date is its deadline while that is ahead, then its event day', async () => {
    const s = add()
    await checkSource(
      db,
      s,
      respond(
        feed([
          {
            id: 'a',
            title: 'Annual conference',
            body: 'Held 14-17 July 2027. Registration closes 12 November 2026.'
          }
        ])
      ),
      NOW
    )
    setItemState(db, listItems(db)[0].id, 'saved')
    expect(upcoming(db, '2026-10-15', 60).map((i) => [i.date, i.dateKind])).toEqual([
      ['2026-11-12', 'deadline']
    ])
    // After the deadline the event itself is what is coming.
    expect(upcoming(db, '2026-11-20', 400).map((i) => [i.date, i.dateKind])).toEqual([
      ['2027-07-14', 'date']
    ])
    expect(upcoming(db, '2026-11-20', 60)).toEqual([])
  })
})

describe('migration 0006', () => {
  it('copies the single date to a deadline or an event day by its kind', () => {
    const old = new Database(':memory:')
    old.pragma('foreign_keys = ON')
    runMigrations(old, watchMigrations.slice(0, 5))
    old
      .prepare(
        "INSERT INTO watch_sources (title, url, kind, method, created_at) VALUES ('S', 'https://ex.org/f', 'conference', 'feed', 'x')"
      )
      .run()
    for (const [k, date, kind] of [
      ['a', '2026-11-05', 'deadline'],
      ['b', '2027-02-20', 'date'],
      ['c', null, null]
    ])
      old
        .prepare(
          "INSERT INTO watch_items (source_id, item_key, title, url, date, date_kind, first_seen_at) VALUES (1, ?, ?, 'u', ?, ?, 'x')"
        )
        .run(k, k, date, kind)
    runMigrations(old, watchMigrations)
    expect(
      listItems(old)
        .map((i) => [i.title, i.eventDate, i.deadline])
        .sort()
    ).toEqual([
      ['a', null, '2026-11-05'],
      ['b', '2027-02-20', null],
      ['c', null, null]
    ])
  })
})
