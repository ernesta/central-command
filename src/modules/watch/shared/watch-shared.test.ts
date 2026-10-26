import { describe, expect, it } from 'vitest'
import { findDate } from './dates'
import { scoreText } from './relevance'
import { guessMethod, kindsOf, shownKind } from './types'

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

describe('kinds and methods the page uses', () => {
  it('shows two kinds: a summer school is a training, a journal is in neither', () => {
    expect(shownKind('summer-school')).toBe('training')
    expect(shownKind('training')).toBe('training')
    expect(shownKind('conference')).toBe('conference')
    expect(shownKind('journal')).toBeNull()
    expect(kindsOf('training')).toEqual(['training', 'summer-school'])
  })

  it('reads a feed-looking address as a feed and anything else as a page', () => {
    expect(guessMethod('https://linguistlist.org/issues/rss/confs')).toBe('feed')
    expect(guessMethod('https://ex.org/events.xml')).toBe('feed')
    expect(guessMethod('https://ex.org/feed/')).toBe('feed')
    expect(guessMethod('https://ex.org/events')).toBe('page')
  })
})
