import { readFileSync } from 'fs'
import { join } from 'path'
import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import { checkSource, type Fetcher } from './checker'
import { MAX_OWN_PAGE_LOOKUPS, describeFetchError } from './load-source'
import { watchMigrations } from './migrations'
import { parsePage, dropPastSections } from './parse-page'
import { parseIcs, parseJsonLd, parseTribe } from './parse-structured'
import { addSource, getSource, listItems, updateSource } from './repository'

// Fixtures are cut from the real pages (28 Oct 2026), fetched through the app's own fetcher.
const fixture = (name: string): string => readFileSync(join(__dirname, 'fixtures', name), 'utf8')

const NOW = '2026-10-28T09:00:00.000Z'
const NO_WAIT = { retryWaitMs: 0, sleep: async () => undefined }

/** A fetcher serving fixed bodies by address; anything else answers 404. Records what was asked. */
function site(pages: Record<string, string>): Fetcher & { asked: string[] } {
  const asked: string[] = []
  const f = (async (url: string) => {
    asked.push(url)
    const body = pages[url] ?? pages[url.split('?')[0]]
    return {
      status: body === undefined ? 404 : 200,
      headers: { get: () => null },
      text: async () => body ?? ''
    }
  }) as unknown as Fetcher & { asked: string[] }
  f.asked = asked
  return f
}

let db: Database.Database
beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, watchMigrations)
})

const page = (
  title: string,
  url: string,
  kind: 'conference' | 'training' = 'conference'
): ReturnType<typeof addSource> => addSource(db, { title, url, kind, method: 'page' }, NOW)

const RESEARCHED = 'https://researched.org.uk/upcoming-events'
const TRIBE =
  'https://researched.org.uk/wp-json/tribe/events/v1/events?start_date=2026-10-28&per_page=50&page=1'
const researched = (): Fetcher & { asked: string[] } =>
  site({
    [RESEARCHED]: fixture('researched-upcoming.html'),
    [TRIBE]: fixture('researched-tribe.json'),
    [TRIBE.replace('2026-10-28', '2026-10-29')]: fixture('researched-tribe.json'),
    'https://researched.org.uk/events/?ical=1': fixture('researched.ics')
  })

describe('researchED: the Events Calendar API', () => {
  it('gives the three real events, with their dates, from the calendar and not from the page’s links', async () => {
    const s = page('researchED', RESEARCHED)
    const out = await checkSource(db, s, researched(), NOW, NO_WAIT)
    expect(out).toMatchObject({ status: 'ok', added: 3 })
    expect(
      listItems(db)
        .map((i) => [i.title, i.eventDate, i.eventEnd])
        .sort()
    ).toEqual([
      ['researchED Doha', '2026-11-14', null],
      ['researchED Glasgow', '2027-03-06', null],
      ['researchED Scandinavia 2027 – Haninge', '2027-02-20', null]
    ])
    // The designer’s credit in the footer is nowhere.
    expect(listItems(db).some((i) => /Kall Kwik/.test(i.title))).toBe(false)
    expect(getSource(db, s.id)).toMatchObject({ method: 'page', lastError: null })
  })

  it('remembers the way that worked, and next time asks the calendar without opening the page', async () => {
    const s = page('researchED', RESEARCHED)
    await checkSource(db, s, researched(), NOW, NO_WAIT)
    const again = researched()
    await checkSource(db, getSource(db, s.id)!, again, '2026-10-29T09:00:00.000Z', NO_WAIT)
    expect(again.asked).toEqual([TRIBE.replace('2026-10-28', '2026-10-29')])
  })

  it('forgets a way that stopped working and finds another one (the calendar file)', async () => {
    const s = page('researchED', RESEARCHED)
    await checkSource(db, s, researched(), NOW, NO_WAIT)
    const noApi = site({
      [RESEARCHED]: fixture('researched-upcoming.html'),
      'https://researched.org.uk/events/?ical=1': fixture('researched.ics')
    })
    const out = await checkSource(
      db,
      getSource(db, s.id)!,
      noApi,
      '2026-10-29T09:00:00.000Z',
      NO_WAIT
    )
    expect(out.status).toBe('ok')
    expect(listItems(db)).toHaveLength(3)
    const via = db.prepare('SELECT found_via FROM watch_sources').get() as { found_via: string }
    expect(via.found_via).toBe('ical:https://researched.org.uk/events/?ical=1')
  })

  it('removes the unsaved items an earlier reading stored from the page, and keeps a saved one', async () => {
    const s = page('researchED', RESEARCHED)
    const insert = db.prepare(
      "INSERT INTO watch_items (source_id, item_key, title, url, state, first_seen_at) VALUES (?, ?, ?, 'u', ?, 'x')"
    )
    insert.run(s.id, 'k1', 'Website Design by Kall Kwik Romford', 'new')
    insert.run(s.id, 'k2', 'Cookie Policy page', 'seen')
    insert.run(s.id, 'k3', 'An old event I saved', 'saved')
    await checkSource(db, s, researched(), NOW, NO_WAIT)
    expect(
      listItems(db)
        .map((i) => i.title)
        .sort()
    ).toEqual([
      'An old event I saved',
      'researchED Doha',
      'researchED Glasgow',
      'researchED Scandinavia 2027 – Haninge'
    ])
  })
})

describe('SSSR: a page that is one event', () => {
  const MAIN = 'https://www.triplesr.org/sssr-thirty-fourth-annual-conference'
  const sssr = (): Fetcher & { asked: string[] } =>
    site({
      [MAIN]: fixture('sssr-conference.html'),
      'https://www.triplesr.org/registration-and-key-dates': fixture('sssr-key-dates.html'),
      'https://www.triplesr.org/submissions-and-programme': fixture('sssr-key-dates.html')
    })

  it('is one item: the conference, its days, and the first deadline from its key-dates pages', async () => {
    const s = page('SSSR', MAIN)
    const f = sssr()
    await checkSource(db, s, f, NOW, NO_WAIT)
    const items = listItems(db)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      title: 'SSSR Thirty-Fourth Annual Conference',
      url: MAIN,
      eventDate: '2027-07-14',
      eventEnd: '2027-07-17',
      deadline: '2026-11-03',
      deadlineLabel: 'Submit by'
    })
    // The key-dates pages were followed, the navigation was not made into items.
    expect(f.asked).toContain('https://www.triplesr.org/registration-and-key-dates')
    expect(f.asked.length).toBeLessThanOrEqual(3)
  })

  it('reads the same when the user says the page is one event', async () => {
    const s = addSource(db, { title: 'SSSR', url: MAIN, kind: 'conference', method: 'event' }, NOW)
    expect(s.method).toBe('event')
    await checkSource(db, s, sssr(), NOW, NO_WAIT)
    expect(listItems(db).map((i) => i.title)).toEqual(['SSSR Thirty-Fourth Annual Conference'])
    // And back to a page.
    expect(updateSource(db, s.id, { method: 'page' }).method).toBe('page')
    expect(() => updateSource(db, s.id, { method: 'feed' })).toThrow()
  })

  it('is read in full every time, never answered “not modified”: its deadlines are on other pages', async () => {
    const s = page('SSSR', MAIN)
    const withEtag =
      (f: Fetcher): Fetcher =>
      async (url, init) => {
        const r = await f(url, init)
        return { ...r, headers: { get: (n) => (n === 'etag' ? '"v1"' : null) } }
      }
    await checkSource(db, s, withEtag(sssr()), NOW, NO_WAIT)
    let sent: Record<string, string> = {}
    const second: Fetcher = async (url, init) => {
      if (url === MAIN) sent = init.headers
      return sssr()(url, init)
    }
    const out = await checkSource(
      db,
      getSource(db, s.id)!,
      second,
      '2026-10-29T09:00:00.000Z',
      NO_WAIT
    )
    expect(sent['If-None-Match']).toBeUndefined()
    expect(out.status).toBe('ok')
  })

  it('has nothing once the conference is over', async () => {
    const s = page('SSSR', MAIN)
    await checkSource(db, s, sssr(), NOW, NO_WAIT)
    expect(listItems(db)).toHaveLength(1)
    const out = await checkSource(
      db,
      getSource(db, s.id)!,
      sssr(),
      '2027-08-01T09:00:00.000Z',
      NO_WAIT
    )
    expect(out.status).toBe('ok')
    expect(listItems(db)).toEqual([])
  })
})

describe('What Works Hub: "no upcoming events"', () => {
  const URL_ = 'https://www.wwhge.org/get-involved/our-events'

  it('has no items, and is not an error', async () => {
    const s = page('What Works Hub', URL_)
    const out = await checkSource(
      db,
      s,
      site({ [URL_]: fixture('wwhge-events.html') }),
      NOW,
      NO_WAIT
    )
    expect(out).toMatchObject({ status: 'ok', added: 0 })
    expect(listItems(db)).toEqual([])
    expect(getSource(db, s.id)).toMatchObject({ lastError: null, failures: 0 })
  })

  it('clears what was stored from its past events and navigation, but never a saved item', async () => {
    const s = page('What Works Hub', URL_)
    const insert = db.prepare(
      "INSERT INTO watch_items (source_id, item_key, title, url, state, first_seen_at) VALUES (?, ?, ?, 'u', ?, 'x')"
    )
    insert.run(s.id, 'a', '2026 What Works Hub for Global Education Conference', 'new')
    insert.run(s.id, 'b', 'Cookie plugin by Example Cookies', 'seen')
    insert.run(s.id, 'c', 'Kept on purpose', 'saved')
    await checkSource(db, s, site({ [URL_]: fixture('wwhge-events.html') }), NOW, NO_WAIT)
    expect(listItems(db).map((i) => i.title)).toEqual(['Kept on purpose'])
  })
})

describe('the fallback for listing pages', () => {
  it('National Literacy Trust: each card is an item with its dated range', async () => {
    const URL_ = 'https://literacytrust.org.uk/events'
    const s = page('National Literacy Trust', URL_)
    await checkSource(db, s, site({ [URL_]: fixture('nlt-events.html') }), NOW, NO_WAIT)
    const items = listItems(db)
    expect(items.length).toBe(4)
    const brief = items.find((i) => i.title === 'Leading literacy briefing: reading')!
    // The course is under way (22 Sep to 11 Nov) and has not ended.
    expect([brief.eventDate, brief.eventEnd]).toEqual(['2026-09-22', '2026-11-11'])
    expect(items.every((i) => i.eventDate)).toBe(true)
  })

  it('reads the dates of an item stored earlier again: a day that is really a range becomes the range', async () => {
    const URL_ = 'https://literacytrust.org.uk/events'
    const s = page('National Literacy Trust', URL_)
    const key = 'https://literacytrust.org.uk/events/leading-literacy-briefing-reading/'
    db.prepare(
      "INSERT INTO watch_items (source_id, item_key, title, url, summary, event_date, state, first_seen_at) VALUES (?, ?, 'Leading literacy briefing: reading', 'u', 'old text', '2026-09-22', 'seen', 'x')"
    ).run(s.id, key)
    await checkSource(db, s, site({ [URL_]: fixture('nlt-events.html') }), NOW, NO_WAIT)
    const item = listItems(db).find((i) => i.url === 'u')!
    expect([item.state, item.eventDate, item.eventEnd, item.summary]).toEqual([
      'seen',
      '2026-09-22',
      '2026-11-11',
      'old text'
    ])
  })

  it('EPS: dated sentences, as before (a list is not mistaken for one event)', async () => {
    const URL_ = 'https://eps.ac.uk/future-meetings'
    const s = page('EPS', URL_)
    await checkSource(db, s, site({ [URL_]: fixture('eps-future-meetings.html') }), NOW, NO_WAIT)
    const titles = listItems(db).map((i) => i.title)
    expect(titles.some((t) => t.startsWith('EPS Meeting: University College London'))).toBe(true)
    expect(titles.length).toBeGreaterThanOrEqual(2)
    expect(titles).not.toContain('Future Meetings and Workshops')
  })

  it('EPS: a sentence stored earlier that the page no longer says goes, a saved one stays', async () => {
    const URL_ = 'https://eps.ac.uk/future-meetings'
    const s = page('EPS', URL_)
    const insert = db.prepare(
      "INSERT INTO watch_items (source_id, item_key, title, url, state, first_seen_at) VALUES (?, ?, ?, 'u', ?, 'x')"
    )
    insert.run(
      s.id,
      'text:old run together sentence',
      'Local Organiser: A B EPS Meeting: X. 1 Jan 2027.',
      'seen'
    )
    insert.run(s.id, 'text:saved one', 'EPS Meeting: Saved. 2 Feb 2027.', 'saved')
    insert.run(s.id, 'https://eps.ac.uk/other', 'A link item stays', 'new')
    await checkSource(db, s, site({ [URL_]: fixture('eps-future-meetings.html') }), NOW, NO_WAIT)
    const titles = listItems(db).map((i) => i.title)
    expect(titles).not.toContain('Local Organiser: A B EPS Meeting: X. 1 Jan 2027.')
    expect(titles).toContain('EPS Meeting: Saved. 2 Feb 2027.')
    expect(titles).toContain('A link item stays')
  })

  const listing = (body: string): string =>
    `<html><body><main><h1>Events</h1>${body}</main></body></html>`

  it('skips everything under a "Past events" heading, whatever else the page says', () => {
    const html = listing(
      `<h2>Upcoming events</h2><ul><li><a href="/e/new">Spring conference 12 Mar 2027</a></li></ul>
       <h2>Past events</h2><ul><li><a href="/e/old">Autumn conference 3 Sep 2025</a></li></ul>
       <h3>Even older</h3><ul><li><a href="/e/older">Legacy conference 2 Sep 2019</a></li></ul>
       <h2>Booking</h2><p><a href="/booking-terms">Booking terms for the events team</a></p>`
    )
    expect(dropPastSections(html)).not.toContain('Autumn conference')
    expect(dropPastSections(html)).not.toContain('Legacy conference')
    expect(dropPastSections(html)).toContain('Booking terms for the events team')
    expect(parsePage(html, 'https://ex.org/events').links.map((l) => l.title)).toEqual([
      'Spring conference 12 Mar 2027',
      'Booking terms for the events team'
    ])
  })

  it('drops credits, and another site’s link unless it has a coming date of its own', async () => {
    const URL_ = 'https://ex.org/events'
    const s = page('Ex', URL_)
    const html = listing(
      `<ul><li><a href="/e/a">Spring conference 12 Mar 2027</a></li>
       <li><a href="https://other.org/x">A partner’s general information page</a></li>
       <li><a href="https://other.org/y">Partner workshop on 5 Dec 2026</a></li></ul>
       <p><a href="https://agency.co.uk/">Website Design by Some Agency</a></p>
       <p><a href="/cookies-settings">Manage cookie settings</a></p>`
    )
    // Even if the partner’s page had a date, a link to another site with none beside it is not followed.
    const f = site({
      [URL_]: html,
      'https://other.org/x': '<main><p>Runs 8–10 June 2027.</p></main>'
    })
    await checkSource(db, s, f, NOW, NO_WAIT)
    expect(
      listItems(db)
        .map((i) => i.title)
        .sort()
    ).toEqual(['Partner workshop on 5 Dec 2026', 'Spring conference 12 Mar 2027'])
    expect(f.asked).not.toContain('https://other.org/x')
  })

  it('stores a link with no date only when its own page has a coming one, and asks a page a fortnight at most', async () => {
    const URL_ = 'https://ex.org/events'
    const s = page('Ex', URL_)
    const html = listing(
      `<ul><li><a href="/e/dated-inside">Methods school in Leiden</a></li>
       <li><a href="/e/no-date">General information about us</a></li></ul>`
    )
    const f = site({
      [URL_]: html,
      'https://ex.org/e/dated-inside':
        '<html><body><main><p>Runs 8–10 June 2027 in Leiden.</p></main></body></html>',
      'https://ex.org/e/no-date': '<html><body><main><p>Nothing yet.</p></main></body></html>'
    })
    await checkSource(db, s, f, NOW, NO_WAIT)
    const items = listItems(db)
    expect(items.map((i) => [i.title, i.eventDate, i.eventEnd])).toEqual([
      ['Methods school in Leiden', '2027-06-08', '2027-06-10']
    ])
    // The page with no date is left alone for the next two weeks.
    const again = site({ [URL_]: html, 'https://ex.org/e/no-date': '<main></main>' })
    await checkSource(db, getSource(db, s.id)!, again, '2026-11-02T09:00:00.000Z', NO_WAIT)
    expect(again.asked).not.toContain('https://ex.org/e/no-date')
    const later = site({ [URL_]: html, 'https://ex.org/e/no-date': '<main></main>' })
    await checkSource(db, getSource(db, s.id)!, later, '2026-11-20T09:00:00.000Z', NO_WAIT)
    expect(later.asked).toContain('https://ex.org/e/no-date')
  })

  it('looks at a few pages per check, not all of them', async () => {
    const URL_ = 'https://ex.org/events'
    const s = page('Ex', URL_)
    const links = Array.from(
      { length: 12 },
      (_, i) => `<li><a href="/e/${i}">Course number ${i}</a></li>`
    )
    const f = site({ [URL_]: listing(`<ul>${links.join('')}</ul>`) })
    await checkSource(db, s, f, NOW, NO_WAIT)
    expect(f.asked.length).toBe(1 + MAX_OWN_PAGE_LOOKUPS)
  })

  it('does not store an event that is over, even with a date beside it', async () => {
    const URL_ = 'https://ex.org/events'
    const s = page('Ex', URL_)
    await checkSource(
      db,
      s,
      site({
        [URL_]: listing('<ul><li><a href="/e/a">Autumn conference 3 Sep 2026</a></li></ul>')
      }),
      NOW,
      NO_WAIT
    )
    expect(listItems(db)).toEqual([])
  })
})

describe('failures', () => {
  it('tries a failed request once more after a short wait, before the failure count rises', async () => {
    const s = page('Ex', 'https://ex.org/events')
    let calls = 0
    const waits: number[] = []
    const flaky: Fetcher = async () => {
      calls++
      if (calls === 1) throw new Error('net::ERR_NETWORK_CHANGED')
      return {
        status: 200,
        headers: { get: () => null },
        text: async () =>
          '<main><ul><li><a href="/e/a">Spring conference 12 Mar 2027</a></li></ul></main>'
      }
    }
    const out = await checkSource(db, s, flaky, NOW, {
      retryWaitMs: 1500,
      sleep: async (ms) => void waits.push(ms)
    })
    expect(out.status).toBe('ok')
    expect(waits).toEqual([1500])
    expect(getSource(db, s.id)!.failures).toBe(0)
  })

  it('says what happened in words: blocked, slow, no network', async () => {
    const s = page('Ex', 'https://ex.org/events')
    const again = (): ReturnType<typeof getSource> => getSource(db, s.id)
    const blocked = await checkSource(db, s, site({}), NOW, NO_WAIT)
    expect(blocked.error).toBe('The site answered 404')
    const forbidden: Fetcher = async () => ({
      status: 403,
      headers: { get: () => null },
      text: async () => ''
    })
    expect((await checkSource(db, again()!, forbidden, NOW, NO_WAIT)).error).toBe(
      'The site blocks automated requests (403)'
    )
    const timeout: Fetcher = async () => {
      throw new Error('The operation was aborted due to timeout')
    }
    const out = await checkSource(db, again()!, timeout, NOW, NO_WAIT)
    expect(out.error).toBe('The site took too long to answer')
    expect(getSource(db, s.id)!.failures).toBe(3)
    expect(describeFetchError(new Error('net::ERR_NETWORK_CHANGED'))).toBe(
      'The network was not available'
    )
  })
})

describe('the parsers', () => {
  it('reads The Events Calendar’s answer, and refuses anything else', () => {
    const { events } = parseTribe(fixture('researched-tribe.json'))
    expect(events.map((e) => [e.title, e.dates?.eventStart])).toEqual([
      ['researchED Doha', '2026-11-14'],
      ['researchED Scandinavia 2027 – Haninge', '2027-02-20'],
      ['researchED Glasgow', '2027-03-06']
    ])
    expect(() => parseTribe('<html>nope</html>')).toThrow()
    expect(() => parseTribe('{"hello":1}')).toThrow()
  })

  it('reads an iCalendar file: folded lines, a whole-day event’s exclusive end, cancelled events', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Summer school on mixed ',
      ' models\\, in Potsdam',
      'DTSTART;VALUE=DATE:20270614',
      'DTEND;VALUE=DATE:20270619',
      'URL:https://ex.org/school',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'SUMMARY:Called off',
      'DTSTART:20270101T090000Z',
      'STATUS:CANCELLED',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'SUMMARY:One afternoon',
      'DTSTART;TZID=Europe/London:20270301T130000',
      'DTEND;TZID=Europe/London:20270301T170000',
      'UID:abc@ex.org',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n')
    expect(
      parseIcs(ics).map((e) => [e.title, e.key, e.dates?.eventStart, e.dates?.eventEnd])
    ).toEqual([
      [
        'Summer school on mixed models, in Potsdam',
        'https://ex.org/school',
        '2027-06-14',
        '2027-06-18'
      ],
      ['One afternoon', 'abc@ex.org', '2027-03-01', null]
    ])
    expect(() => parseIcs('<html></html>')).toThrow()
  })

  it('reads schema.org Events: one object, @graph, ItemList, a list of types; cancelled ones are left out', () => {
    const block = (o: unknown): string =>
      `<script type="application/ld+json">${JSON.stringify(o)}</script>`
    const html = [
      block({
        '@type': 'Event',
        name: 'Single',
        startDate: '2027-02-01T09:00:00+00:00',
        url: '/e/single'
      }),
      block({
        '@graph': [
          { '@type': 'WebPage', name: 'Not an event' },
          {
            '@type': ['Thing', 'EducationEvent'],
            name: 'In a graph',
            startDate: '2027-03-01',
            endDate: '2027-03-03'
          },
          {
            '@type': 'Event',
            name: 'Cancelled',
            startDate: '2027-03-01',
            eventStatus: 'https://schema.org/EventCancelled'
          }
        ]
      }),
      block({
        '@type': 'ItemList',
        itemListElement: [
          {
            '@type': 'ListItem',
            item: { '@type': 'Event', name: 'In a list', startDate: '2027-04-01' }
          }
        ]
      }),
      '<script type="application/ld+json">{ broken</script>'
    ].join('')
    expect(
      parseJsonLd(html, 'https://ex.org/events').map((e) => [
        e.title,
        e.dates?.eventStart,
        e.dates?.eventEnd
      ])
    ).toEqual([
      ['Single', '2027-02-01', null],
      ['In a graph', '2027-03-01', '2027-03-03'],
      ['In a list', '2027-04-01', null]
    ])
  })
})
