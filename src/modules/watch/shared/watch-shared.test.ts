import { describe, expect, it } from 'vitest'
import { findDate, findDates, isOver, structuredOver, whenLabel } from './dates'
import { scoreText } from './relevance'
import { guessMethod } from './types'

const today = '2026-10-15'

describe('findDate', () => {
  it('prefers the earliest deadline, labelled as such', () => {
    expect(
      findDate('Conference 12-14 July 2027. Abstracts should be sent by 10 November 2026.', today)
    ).toEqual({ date: '2026-11-10', kind: 'deadline' })
  })

  it('falls back to the earliest date of any kind', () => {
    expect(findDate('Summer school: 3rd Jun. 2027 to 9 June 2027', today)).toEqual({
      date: '2027-06-03',
      kind: 'date'
    })
  })

  it('reads month-first dates and ranges', () => {
    expect(findDate('Held July 12-14, 2027 in Leiden', today)).toEqual({
      date: '2027-07-12',
      kind: 'date'
    })
  })

  it('ignores past dates, impossible dates and numeric dates', () => {
    expect(findDate('Last held 3 May 2026; 31 February 2027; 10/11/2026', today)).toBeNull()
  })

  it('counts today', () => {
    expect(findDate('Closes on 15 October 2026', today)?.date).toBe('2026-10-15')
  })
})

describe('scoreText', () => {
  const keywords = ['reading acquisition', 'literacy', 'C++']

  it('counts a title match 3 and a summary match 1, once per keyword', () => {
    expect(scoreText('Literacy in Ghana', 'about literacy and literacy', keywords)).toEqual({
      score: 4,
      matched: ['literacy']
    })
  })

  it('matches whole words, with a plural s, ignoring case', () => {
    expect(scoreText('Reading Acquisitions', '', keywords).score).toBe(3)
    expect(scoreText('Illiteracy', 'preliteracy', keywords).score).toBe(0)
  })

  it('escapes keywords that hold regular-expression characters', () => {
    expect(scoreText('Learning C++ today', '', keywords).matched).toEqual(['c++'])
  })

  it('gives nothing for no keywords or an empty one', () => {
    expect(scoreText('Literacy', 'literacy', [])).toEqual({ score: 0, matched: [] })
    expect(scoreText('Literacy', '', [' '])).toEqual({ score: 0, matched: [] })
  })
})

describe('methods the page uses', () => {
  it('reads a feed-looking address as a feed and anything else as a page', () => {
    expect(guessMethod('https://linguistlist.org/issues/rss/confs')).toBe('feed')
    expect(guessMethod('https://ex.org/events.xml')).toBe('feed')
    expect(guessMethod('https://ex.org/feed/')).toBe('feed')
    expect(guessMethod('https://ex.org/events')).toBe('page')
  })
})

describe('findDates', () => {
  it('takes the end of an application window as the deadline, not its opening', () => {
    expect(
      findDates(
        'Dates: 23-27 August 2027. Application period: 1 Oct, 2026 to 1 April, 2027.',
        today
      )
    ).toMatchObject({
      eventStart: '2027-08-23',
      deadline: '2027-04-01',
      deadlineLabel: 'Apply by'
    })
  })

  it('gives the event range and the deadline apart, with the deadline’s words', () => {
    expect(
      findDates(
        'The 34th conference is 14-17 July 2027 in Santiago. Abstract submission closes 12 November 2026.',
        today
      )
    ).toEqual({
      eventStart: '2027-07-14',
      eventEnd: '2027-07-17',
      deadline: '2026-11-12',
      deadlineLabel: 'Submit by'
    })
    expect(
      findDates('Register by 5 Nov 2026 for the day on 20 February 2027', today)
    ).toMatchObject({
      eventStart: '2027-02-20',
      deadline: '2026-11-05',
      deadlineLabel: 'Register by'
    })
  })
  it('reads a range across two months, and has an end only for a range', () => {
    expect(findDates('Summer school 30 June – 2 July 2027', today)).toMatchObject({
      eventStart: '2027-06-30',
      eventEnd: '2027-07-02'
    })
    expect(findDates('14 November 2026', today)).toMatchObject({
      eventStart: '2026-11-14',
      eventEnd: null,
      deadline: null
    })
  })
  it('leaves out what is over, keeps a range under way, and finds nothing in a text with no date', () => {
    expect(findDates('Held 3 May 2026', today)).toEqual({
      eventStart: null,
      eventEnd: null,
      deadline: null,
      deadlineLabel: null
    })
    expect(findDates('Conference 14-17 October 2026', today).eventStart).toBe('2026-10-14')
    expect(isOver('Conference 12-14 October 2026', today)).toBe(true)
    expect(isOver('Conference 12-17 October 2026', today)).toBe(false)
    expect(findDates('see you soon', today).eventStart).toBeNull()
  })
})

describe('whenLabel', () => {
  it('writes a day, a range in a month, across months and across years', () => {
    expect(whenLabel('2026-11-14', null)).toBe('14 Nov 2026')
    expect(whenLabel('2027-07-14', '2027-07-17')).toBe('14–17 Jul 2027')
    expect(whenLabel('2027-06-30', '2027-07-02')).toBe('30 Jun – 2 Jul 2027')
    expect(whenLabel('2026-12-30', '2027-01-02')).toBe('30 Dec 2026 – 2 Jan 2027')
  })
  it('structured dates that ended are over', () => {
    expect(structuredOver({ eventStart: '2026-09-15', eventEnd: null }, today)).toBe(true)
    expect(structuredOver({ eventStart: '2026-09-15', eventEnd: '2026-10-16' }, today)).toBe(false)
    expect(structuredOver({ eventStart: null, eventEnd: null }, today)).toBe(false)
  })
})

describe('ranges with both ends written out', () => {
  it('reads "22 Sep 2026 - 11 Nov 2026" as one range, not two dates', () => {
    expect(
      findDates('Leading literacy briefing 22 Sep 2026 - 11 Nov 2026 Expert guidance', today)
    ).toMatchObject({
      eventStart: '2026-09-22',
      eventEnd: '2026-11-11'
    })
    expect(findDates('Held 30 Dec 2026 to 2 Jan 2027', today)).toMatchObject({
      eventStart: '2026-12-30',
      eventEnd: '2027-01-02'
    })
    // A course whose range ended is over; one under way is not.
    expect(isOver('Course 1 Sep 2026 - 5 Oct 2026', today)).toBe(true)
    expect(isOver('Course 1 Sep 2026 - 25 Nov 2026', today)).toBe(false)
  })
})
