import { describe, expect, it } from 'vitest'
import {
  applyTrainingChanges,
  parseTrainingMeta,
  splitNote,
  updateTrainingHead
} from './front-matter'

const HEAD = `---
date: 2025-12-10
start: '10:00'
end: '11:30'
title: 'SEDarc: Data Management'
series: SEDarc
type: Research methods
mode: self-paced
skills: [Data management and analysis (GS), Ethical and legal issues (GS)]
leads: [Robert Darby]
institution: Royal Holloway
folder: 2025-26/SEDarc/2025 12 10 Data Management
organisation: SEDarc DTP
points: 1
---

`

describe('parseTrainingMeta', () => {
  it('reads every field', () => {
    const { meta, problems } = parseTrainingMeta(HEAD)
    expect(problems).toEqual([])
    expect(meta).toEqual({
      date: '2025-12-10',
      start: '10:00',
      end: '11:30',
      title: 'SEDarc: Data Management',
      series: 'SEDarc',
      type: 'Research methods',
      mode: 'self-paced',
      skills: ['Data management and analysis (GS)', 'Ethical and legal issues (GS)'],
      leads: ['Robert Darby'],
      institution: 'Royal Holloway',
      folder: '2025-26/SEDarc/2025 12 10 Data Management',
      organisation: 'SEDarc DTP',
      points: '1'
    })
  })

  it('flags problems instead of guessing', () => {
    const { meta, problems } = parseTrainingMeta(
      '---\ndate: 2025-02-30\nmode: hybrid\nstart: 9pm\n---\n'
    )
    expect(meta.date).toBe('')
    expect(meta.mode).toBeNull()
    expect(meta.start).toBeNull()
    expect(problems).toEqual([
      'Missing title',
      'Invalid date: 2025-02-30',
      'Unknown mode: hybrid',
      'Invalid start time: 9pm'
    ])
    expect(parseTrainingMeta('no front matter').problems).toContain('No front matter')
  })
})

describe('updateTrainingHead', () => {
  it('round-trips: writing every parsed field back changes nothing', () => {
    const { meta } = parseTrainingMeta(HEAD)
    expect(updateTrainingHead(HEAD, meta)).toBe(HEAD)
  })

  it('quotes a title with a colon and keeps points as a plain number', () => {
    const head = updateTrainingHead('', { title: 'A: b', points: '2', start: '09:00' })
    expect(head).toBe("---\nstart: '09:00'\ntitle: 'A: b'\npoints: 2\n---\n\n")
  })

  it('removes keys set to null or an empty list and leaves the rest', () => {
    const next = updateTrainingHead(HEAD, { series: null, leads: [] })
    expect(next).not.toContain('series')
    expect(next).not.toContain('leads')
    expect(next).toContain('institution: Royal Holloway')
  })

  it('applyTrainingChanges leaves the body byte-for-byte alone', () => {
    const text = HEAD + '## Summary\n\n  odd\t\n'
    const out = applyTrainingChanges(text, { meta: { series: 'DataCamp' } })
    expect(splitNote(out).body).toBe('## Summary\n\n  odd\t\n')
  })
})
