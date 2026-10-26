import { describe, expect, it } from 'vitest'
import { crossrefUrl, parseCrossref } from './parse-crossref'
import { parseFeed, plainText } from './parse-feed'
import { datedSentences, parsePage } from './parse-page'
import { itemKind } from '../shared/types'
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

describe('itemKind', () => {
  it('makes a course on a conference listing a training, and nothing else', () => {
    expect(itemKind('Secondary CPD: Developing literacy', 'conference')).toBe('training')
    expect(itemKind('Reconstructing Reading 2026', 'conference')).toBeNull()
    expect(itemKind('Summer course', 'training')).toBeNull()
  })
})
