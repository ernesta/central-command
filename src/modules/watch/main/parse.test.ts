import { describe, expect, it } from 'vitest'
import { crossrefUrl, parseCrossref } from './parse-crossref'
import { parseFeed, plainText } from './parse-feed'
import { datedSentences, parsePage } from './parse-page'
import { findDate } from '../shared/dates'

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<!-- generated -->
<rss version="2.0"><channel><title>Feed</title><link>https://example.org</link>
<item>
  <title>Confs: Workshop &amp; Symposium on Reading (Leiden)</title>
  <link>https://example.org/issues/37/3307/</link>
  <guid idPermalink="true">https://example.org/issues/37/3307/</guid>
  <pubDate>2026-10-14T07:05:01.899036-04:00</pubDate>
  <description>Convenors:
Ada Lovelace (University of Somewhere)

Call:
Abstracts by 10 November 2026.</description>
</item>
<item>
  <title><![CDATA[Calls: "Special issue" <b>on</b> literacy]]></title>
  <link>https://example.org/issues/37/3247/</link>
  <description><![CDATA[<p>Appel &amp; call</p><p>Second paragraph</p>]]></description>
</item>
<item><title>No link here</title></item>
</channel></rss>`

const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom"><title>A</title>
<entry>
  <title>Summer school on mixed models</title>
  <link rel="self" href="https://example.org/self"/>
  <link rel="alternate" href="https://example.org/school?a=1&amp;b=2"/>
  <id>tag:example.org,2026:1</id>
  <published>2026-09-01T00:00:00Z</published>
  <summary>Five days in Potsdam.</summary>
</entry></feed>`

describe('parseFeed', () => {
  it('reads RSS items: entities, CDATA, dates, plain-text summaries', () => {
    const items = parseFeed(RSS)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      key: 'https://example.org/issues/37/3307/',
      title: 'Confs: Workshop & Symposium on Reading (Leiden)',
      url: 'https://example.org/issues/37/3307/',
      publishedAt: '2026-10-14T11:05:01.899Z'
    })
    expect(items[0].summary).toContain('Abstracts by 10 November 2026.')
    expect(items[1].title).toBe('Calls: "Special issue" on literacy')
    expect(items[1].summary).toBe('Appel & call\nSecond paragraph')
    expect(items[1].publishedAt).toBeNull()
  })

  it('reads Atom entries, taking the alternate link', () => {
    expect(parseFeed(ATOM)).toEqual([
      {
        key: 'tag:example.org,2026:1',
        title: 'Summer school on mixed models',
        url: 'https://example.org/school?a=1&b=2',
        summary: 'Five days in Potsdam.',
        publishedAt: '2026-09-01T00:00:00.000Z'
      }
    ])
  })

  describe('a title ending "(dd/mm/yy)"', () => {
    const feed = (...titles: string[]): string =>
      `<rss version="2.0"><channel>${titles
        .map((t, n) => `<item><title>${t}</title><link>https://example.org/${n}</link></item>`)
        .join('')}</channel></rss>`
    const dated = (items: ReturnType<typeof parseFeed>): (string | null)[][] =>
      items.map((i) => [i.title, i.dates?.eventStart ?? null])

    it('has its date read and cut from the title when the feed shows the order', () => {
      expect(
        dated(
          parseFeed(
            feed(
              'Documents as Data - Online (09/03/27)',
              'Radical Research Ethics - Online (20/04/27)',
              'Spring course (05/11/2026)'
            )
          )
        )
      ).toEqual([
        ['Documents as Data', '2027-03-09'],
        ['Radical Research Ethics', '2027-04-20'],
        ['Spring course', '2026-11-05']
      ])
    })

    it('loses how the course is delivered, which the title ends with', () => {
      expect(
        dated(
          parseFeed(
            feed(
              'Documents as Data - online (09/03/27)',
              'Survey Design - In Person (24/05/27)',
              'Series – A three-workshop series (online) (23/11/26)',
              'Online Surveys (20/04/27)'
            )
          )
        ).map(([title]) => title)
      ).toEqual([
        'Documents as Data',
        'Survey Design',
        'Series – A three-workshop series',
        'Online Surveys'
      ])
    })

    it('is left alone when the order is not shown, or a month would be above 12', () => {
      expect(dated(parseFeed(feed('Only course (05/11/26)')))).toEqual([
        ['Only course (05/11/26)', null]
      ])
      expect(dated(parseFeed(feed('A (20/04/27)', 'B (09/13/27)')))).toEqual([
        ['A (20/04/27)', null],
        ['B (09/13/27)', null]
      ])
    })

    it('leaves an impossible day in the title', () => {
      expect(dated(parseFeed(feed('A (20/04/27)', 'B (31/04/27)')))).toEqual([
        ['A', '2027-04-20'],
        ['B (31/04/27)', null]
      ])
    })
  })

  it('refuses a page that is not a feed, so a login page is not an empty feed', () => {
    expect(() => parseFeed('<html><body>Please log in</body></html>')).toThrow('Not a feed')
  })

  it('gives an empty list for a feed with no entries', () => {
    expect(parseFeed('<rss version="2.0"><channel></channel></rss>')).toEqual([])
  })

  it('plainText turns block tags into line breaks and decodes numeric entities', () => {
    expect(plainText('<p>A&#233;</p><p>B&#x2013;C</p>')).toBe('Aé\nB–C')
  })
})

describe('parseCrossref', () => {
  const body = JSON.stringify({
    status: 'ok',
    message: {
      items: [
        {
          DOI: '10.1080/ABC.1',
          URL: 'https://doi.org/10.1080/abc.1',
          type: 'journal-article',
          title: ['Word reading in <i>Arabic</i>'],
          author: [
            { family: 'Toste' },
            { family: 'Chandler' },
            { family: 'Hardeman' },
            { family: 'Fourth' }
          ],
          'container-title': ['Scientific Studies of Reading'],
          abstract: '<jats:p>Abstract We studied it.</jats:p>',
          created: { 'date-time': '2026-10-05T12:21:43Z' }
        },
        { DOI: '10.1080/front', type: 'journal-issue', title: ['Front matter'] },
        { DOI: '10.1080/notitle', type: 'journal-article' }
      ]
    }
  })

  it('keeps articles with a title, with authors and journal in the summary', () => {
    expect(parseCrossref(body)).toEqual([
      {
        key: '10.1080/abc.1',
        title: 'Word reading in Arabic',
        url: 'https://doi.org/10.1080/abc.1',
        summary:
          'Toste, Chandler, Hardeman et al. · Scientific Studies of Reading · We studied it.',
        publishedAt: '2026-10-05T12:21:43Z'
      }
    ])
  })

  it('throws on anything that is not a Crossref answer', () => {
    expect(() => parseCrossref('<html>')).toThrow('Not Crossref JSON')
    expect(() => parseCrossref('{"status":"failed"}')).toThrow('Unexpected Crossref answer')
  })

  it('builds the journal URL with the ISSN encoded', () => {
    expect(crossrefUrl('1088-8438', 5)).toContain(
      '/journals/1088-8438/works?sort=created&order=desc&rows=5'
    )
  })
})

describe('parsePage', () => {
  const html = `<html><head><style>a{}</style><script>var a="<a href='/x'>Not a real link here</a>"</script></head><body>
  <nav><a href="/events/">Conferences and events</a></nav>
  <main>
    <h1>Training calendar</h1>
    <a href="/course/stats-1#top">Introduction to statistics for PGRs</a>
    <a href="/course/stats-1">Duplicate of the same course</a>
    <a href="https://other.example/summer">Summer school on <b>mixed models</b></a>
    <a href="mailto:x@y.z">Email the organisers please</a>
    <a href="/more">Read more about this</a>
    <a href="/s">Short</a>
  </main>
  <footer><a href="/privacy-policy">Privacy and cookies policy</a></footer></body></html>`

  it('lists the links in the page body, resolved, without fragments, duplicates, furniture or navigation', () => {
    const { links, text } = parsePage(html, 'https://site.example/training/')
    expect(links.map((l) => [l.title, l.url])).toEqual([
      ['Introduction to statistics for PGRs', 'https://site.example/course/stats-1'],
      ['Summer school on mixed models', 'https://other.example/summer']
    ])
    expect(text).toContain('Training calendar')
    expect(text).not.toContain('Privacy and cookies')
    expect(text).not.toContain('var a')
  })
})

describe('parsePage section homes', () => {
  it("leaves out links to the site's own home pages above the page, keeps events beside it", () => {
    const html = `<main><a href="/doctoral-school/home.aspx">Doctoral School</a>
      <a href="/doctoral-school/news-events/home.aspx">News | Events</a>
      <a href="/doctoral-school/news-events/event-articles/r-course.aspx">Good Practice for R Users</a></main>`
    const page = parsePage(html, 'https://x.ac.uk/doctoral-school/news-events/events.aspx')
    expect(page.links.map((l) => l.title)).toEqual(['Good Practice for R Users'])
  })
})

describe('datedSentences', () => {
  const text =
    'Welcome to the society. EPS Meeting: University College London. 6th – 8th January 2027. This meeting will include a prize lecture. Last year we met on 3 March 2025 in Bangor, which was lovely. Abstracts are due by 1 December 2026 for the spring meeting.'
  it('keeps sentences that name a coming date, once each, and drops past ones', () => {
    const out = datedSentences(text, 'https://eps.example/meetings', '2026-10-15')
    expect(out.map((i) => i.title)).toEqual([
      'EPS Meeting: University College London. 6th – 8th January 2027.',
      'Abstracts are due by 1 December 2026 for the spring meeting.'
    ])
    expect(
      out.every((i) => i.url === 'https://eps.example/meetings' && i.key.startsWith('text:'))
    ).toBe(true)
  })
})

describe('parsePage cards', () => {
  const html = `<ul>
    <li><a href="/e/a/"><img src="x"></a><p>Event</p><a href="/e/a/" tabindex=“-1”>Poetry masterclass for KS2</a>
      <p>11 Nov 2026</p><div>Try out practical strategies.</div>
      <a href="/e/a/">View details<span class="sr-only"> about Poetry masterclass for KS2</a></li>
    <li><a href="/e/b/">Reconstructing Reading 2026</a><p>16 Nov 2026 - 26 Nov 2026</p></li>
  </ul>`
  it('gives each link the date and text of its own card', () => {
    const { links } = parsePage(html, 'https://site.example/events')
    expect(links.map((l) => [l.title, findDate(l.summary, '2026-10-26')?.date])).toEqual([
      ['Poetry masterclass for KS2', '2026-11-11'],
      ['Reconstructing Reading 2026', '2026-11-16']
    ])
    expect(links[0].summary).toBe('Event 11 Nov 2026 Try out practical strategies.')
  })
})

describe('a page with a table of numeric dates (LSE MY580)', () => {
  const table = `<main><table>
    <tr><td>26/10/2026</td><td>Design-based causal inference with Dr Zach Dickson</td><td>.</td></tr>
    <tr><td>9/11/2026</td><td>Measuring policy positions of political agents with Prof Michael Laver</td><td>.</td></tr>
  </table></main>`
  const text = (html: string): string => parsePage(html, 'https://example.org/').upcomingText

  it('reads them day-first when one date proves the order', () => {
    const items = datedSentences(text(table), 'https://example.org/', '2026-10-01')
    expect(items.map((i) => i.title)).toEqual([
      '26 October 2026 Design-based causal inference with Dr Zach Dickson.',
      '9 November 2026 Measuring policy positions of political agents with Prof Michael Laver.'
    ])
    expect(findDate(items[1].title, '2026-10-01')?.date).toBe('2026-11-09')
  })

  it('leaves them alone when nothing proves the order', () => {
    const html = table.replace('26/10/2026', '6/10/2026')
    expect(datedSentences(text(html), 'https://example.org/', '2026-10-01')).toEqual([])
  })

  it('leaves them alone when a date cannot be day-first', () => {
    const html = table.replace('9/11/2026', '11/26/2026')
    expect(datedSentences(text(html), 'https://example.org/', '2026-10-01')).toEqual([])
  })
})

describe('a timetable with two-digit years, times and wrapped cells (Royal Holloway RDP)', () => {
  const table = `<main><table><tbody>
    <tr><td><b>Date</b></td><td></td><td><b>Time</b></td><td><b>Title</b></td></tr>
    <tr><td><b>October</b></td><td></td><td></td><td></td></tr>
    <tr>
<td><p>28/10/26</p></td>
<td></td>
<td>10:00 - 11:30</td>
<td><p>Understanding AI and Ethics</p></td>
</tr>
    <tr><td>05/11/26</td><td></td><td>13:00 - 15:30</td><td>Introduction to Podcasting</td></tr>
    <tr><td>TBC</td><td></td><td>10:00 - 12:00</td><td>From Draft to Done: Effective Editing of the PhD Thesis</td></tr>
  </tbody></table></main>`
  const text = (html: string): string => parsePage(html, 'https://example.org/').upcomingText

  it('keeps a row on one line and writes its date out without the time', () => {
    const items = datedSentences(text(table), 'https://example.org/', '2026-10-01')
    expect(items.map((i) => i.title)).toEqual([
      '28 October 2026 Understanding AI and Ethics',
      '5 November 2026 Introduction to Podcasting'
    ])
    expect(findDate(items[1].title, '2026-10-01')?.date).toBe('2026-11-05')
  })

  it('reads more than the prose cap of rows from a timetable', () => {
    const rows = Array.from(
      { length: 40 },
      (_, i) =>
        `<tr><td>${String((i % 28) + 1).padStart(2, '0')}/11/26</td><td>10:00 - 11:00</td><td>Session number ${i}</td></tr>`
    ).join('')
    const html = `<main><table>${rows}</table></main>`
    expect(datedSentences(text(html), 'https://example.org/', '2026-10-01')).toHaveLength(40)
  })
})

describe('a listing of cards that are links (Royal Holloway)', () => {
  const html = `<main>
    <div class="breadcrumbs-wrapper"><div class="breadcrumb"><div>
      <a href="/doctoral-school/home.aspx">Doctoral School</a> &gt; <a href="/news-events/home.aspx">News | Events</a>
    </div></div></div>
    <a href="/events/open-day.aspx" class="cta-wrapper"><div class="cta">
      <div class="date-calendar"><span>Nov</span> <span>06</span> <span>2026</span></div>
      <p class="cta__title">Doctoral Open Day: Music, Sound and Vision</p>
      <div class="cta__p">Doctoral Open Day: Music, Sound and Vision</div>
      <p class="cta__link-text">More details</p>
    </div></a></main>`

  it('takes the title from its own element, the date as summary, and leaves the breadcrumb out', () => {
    const { links } = parsePage(html, 'https://example.org/doctoral-school/events.aspx')
    expect(links.map((l) => l.title)).toEqual(['Doctoral Open Day: Music, Sound and Vision'])
    expect(links[0].summary).toBe('Nov 06 2026')
    expect(findDate(`${links[0].title}\n${links[0].summary}`, '2026-10-01')?.date).toBe(
      '2026-11-06'
    )
  })
})

describe('a card with tag links to the site search', () => {
  const html = `<main><article class="c-card c-card--event">
    <h3><a href="/events/british-social-attitudes-defence-and-security"><span>British Social Attitudes: Defence and Security</span></a></h3>
    <time datetime="5 November 2026">5 November 2026</time>
    <a href="/search/?keywords=British Social Attitudes"><span>British Social Attitudes</span></a>
    <a href="/search/?keywords=Public spending"><span>Public spending</span></a>
  </article></main>`

  it('keeps the event and drops the tags', () => {
    const { links } = parsePage(html, 'https://natcen.ac.uk/events')
    expect(links.map((l) => l.url)).toEqual([
      'https://natcen.ac.uk/events/british-social-attitudes-defence-and-security'
    ])
    expect(links[0].summary).toContain('5 November 2026')
  })
})

describe("a link to a feed of the site's events", () => {
  const html = `<main><ul>
    <li><a href="/events/code-anxiety-club-2026-11-03/"><span>Code anxiety club</span></a><time>3 November 2026</time></li>
    <li><a href="/feed/?post_type=event">Follow our events 3 November 2026</a></li>
    <li><a href="/events/calendar.ics">Add the calendar to yours 3 November 2026</a></li>
  </ul></main>`

  it('keeps the event and drops the feed links', () => {
    const { links } = parsePage(html, 'https://ukdataservice.ac.uk/events/')
    expect(links.map((l) => l.url)).toEqual([
      'https://ukdataservice.ac.uk/events/code-anxiety-club-2026-11-03/'
    ])
  })
})
