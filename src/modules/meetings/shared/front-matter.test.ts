import { describe, expect, it } from 'vitest'
import { joinNote, normaliseTime, parseMeta, splitNote, updateHead } from './front-matter'

const HEAD = `---
series: Supervision # Supervision | Rastle Lab | Luminos | Other
date: 2026-09-24
start: '14:00' # optional; 24h local time
end: '15:00'
mode: in-person
attendees: [Kathy Rastle, Arnaud Chevalier, Ernesta Orlovaitė]
discussed: [Study 1 model results]
---

`
const BODY =
  '## Summary\n\nOne or two sentences.\n\n## Notes\n\n### Study 1\n\n- **TODO(EO)**: Re-run\n'

describe('splitNote / joinNote', () => {
  it('splits the front matter from the body and rejoins to the same text', () => {
    const { head, body } = splitNote(HEAD + BODY)
    expect(head).toBe(HEAD)
    expect(body).toBe(BODY)
    expect(joinNote({ head, body })).toBe(HEAD + BODY)
  })

  it('treats a file without front matter as all body', () => {
    expect(splitNote(BODY)).toEqual({ head: '', body: BODY })
    expect(splitNote('')).toEqual({ head: '', body: '' })
  })

  it('needs the opening fence on the very first line', () => {
    const text = '\n---\nseries: X\n---\nbody'
    expect(splitNote(text)).toEqual({ head: '', body: text })
  })

  it('treats an unclosed fence as body, not front matter', () => {
    const text = '---\nseries: Supervision\n\n## Summary\n'
    expect(splitNote(text)).toEqual({ head: '', body: text })
  })

  it('puts the blank lines after the fence in the head, not the body', () => {
    expect(splitNote('---\na: 1\n---\n\n\n## Summary')).toEqual({
      head: '---\na: 1\n---\n\n\n',
      body: '## Summary'
    })
  })

  it('keeps a body that starts with a horizontal rule intact', () => {
    const { head, body } = splitNote('---\na: 1\n---\n---\n\nText')
    expect(head).toBe('---\na: 1\n---\n')
    expect(body).toBe('---\n\nText')
  })

  it('handles an empty body and a missing final newline', () => {
    expect(splitNote('---\na: 1\n---')).toEqual({ head: '---\na: 1\n---', body: '' })
    expect(splitNote('---\na: 1\n---\nx')).toEqual({ head: '---\na: 1\n---\n', body: 'x' })
  })

  it('handles CRLF files', () => {
    const text = '---\r\na: 1\r\n---\r\n\r\nLine one\r\nLine two\r\n'
    const { head, body } = splitNote(text)
    expect(head).toBe('---\r\na: 1\r\n---\r\n\r\n')
    expect(body).toBe('Line one\r\nLine two\r\n')
  })

  it('accepts `...` as the closing fence and a byte order mark', () => {
    const text = '﻿---\na: 1\n...\nbody'
    expect(splitNote(text)).toEqual({ head: '﻿---\na: 1\n...\n', body: 'body' })
  })

  it('leaves the body byte-for-byte alone whatever it holds', () => {
    const bodies = [
      '',
      '\t tabbed  \n',
      'trailing spaces   \n\n\n',
      '## Heading\r\n\r\ntext',
      '```\n---\ncode\n---\n```\n',
      '- [ ] **TODO(EO)**: x\n- [x] done\n',
      'Ünïcödé ☃ 🙂\n',
      '   leading spaces\n',
      '---\n---\n'
    ]
    for (const b of bodies) {
      const text = HEAD + b
      const { head, body } = splitNote(text)
      expect(body).toBe(b.replace(/^(?:[ \t]*\r?\n)+/, ''))
      expect(joinNote({ head, body })).toBe(text)
    }
  })

  it('round-trips arbitrary text exactly (fuzz)', () => {
    const alphabet = ['-', '-', '-', '\n', '\n', '\r\n', ' ', 'a', ':', '.', '#']
    let seed = 12345
    const rnd = (): number => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
    for (let i = 0; i < 3000; i++) {
      let text = rnd() < 0.7 ? '---\n' : ''
      const n = Math.floor(rnd() * 40)
      for (let j = 0; j < n; j++) text += alphabet[Math.floor(rnd() * alphabet.length)]
      const { head, body } = splitNote(text)
      expect(head + body).toBe(text)
      // Editing the body and joining never disturbs the head.
      expect(joinNote({ head, body: body + 'X' })).toBe(text + 'X')
      // Whatever is recognised as front matter is exactly the leading part of the text.
      expect(text.startsWith(head)).toBe(true)
    }
  })
})

describe('parseMeta', () => {
  it('reads the documented example', () => {
    const { meta, problems } = parseMeta(HEAD)
    expect(problems).toEqual([])
    expect(meta).toEqual({
      series: 'Supervision',
      date: '2026-09-24',
      start: '14:00',
      end: '15:00',
      mode: 'in-person',
      attendees: ['Kathy Rastle', 'Arnaud Chevalier', 'Ernesta Orlovaitė'],
      discussed: ['Study 1 model results'],
      skills: []
    })
  })

  it('reads block lists, unquoted times and double quotes', () => {
    const { meta } = parseMeta(
      '---\nseries: "Rastle Lab"\ndate: 2026-01-02\nstart: 9:00\nend: 10:30\nattendees:\n  - Kathy Rastle\n  - "Ernesta Orlovaitė"\ndiscussed:\n- A topic\n---\n'
    )
    expect(meta.series).toBe('Rastle Lab')
    expect(meta.start).toBe('09:00')
    expect(meta.end).toBe('10:30')
    expect(meta.attendees).toEqual(['Kathy Rastle', 'Ernesta Orlovaitė'])
    expect(meta.discussed).toEqual(['A topic'])
  })

  it('handles quoted items containing commas and apostrophes', () => {
    const { meta } = parseMeta(
      "---\nseries: Other\ndate: 2026-01-02\ndiscussed: ['Weights, twice', 'Kathy''s point']\n---\n"
    )
    expect(meta.discussed).toEqual(['Weights, twice', "Kathy's point"])
  })

  it('flags problems instead of guessing', () => {
    expect(parseMeta('').problems).toContain('No front matter')
    const bad = parseMeta(
      '---\nseries: Supervision\ndate: 2026-02-30\nstart: 25:00\nmode: hybrid\n---\n'
    )
    expect(bad.meta.date).toBe('')
    expect(bad.meta.start).toBeNull()
    expect(bad.meta.mode).toBeNull()
    expect(bad.problems).toEqual([
      'Invalid date: 2026-02-30',
      'Invalid start time: 25:00',
      'Unknown mode: hybrid'
    ])
    expect(parseMeta('---\nx: 1\n---\n').problems).toEqual(['Missing series', 'Missing date'])
  })

  it('keeps an unknown series as written', () => {
    expect(parseMeta('---\nseries: Book Club\ndate: 2026-01-02\n---\n').meta.series).toBe(
      'Book Club'
    )
  })

  it('treats a lone value where a list is expected as a one-item list', () => {
    expect(
      parseMeta('---\nseries: Other\ndate: 2026-01-02\nattendees: Kathy Rastle\n---\n').meta
        .attendees
    ).toEqual(['Kathy Rastle'])
  })
})

describe('updateHead', () => {
  it('changes nothing when the patch is empty', () => {
    expect(updateHead(HEAD, {})).toBe(HEAD)
  })

  it('replaces only the patched keys and keeps comments and other lines', () => {
    const out = updateHead(HEAD, { end: '15:30', discussed: ['Study 1 model results', 'Ethics'] })
    expect(out).toBe(
      HEAD.replace("end: '15:00'", "end: '15:30'").replace(
        'discussed: [Study 1 model results]',
        'discussed: [Study 1 model results, Ethics]'
      )
    )
    // The comment on the untouched start line survived.
    expect(out).toContain("start: '14:00' # optional; 24h local time")
  })

  it('preserves unknown keys, their order and block values', () => {
    const head =
      '---\nseries: Other\ncolour: blue\ndate: 2026-01-02\nlinks:\n  - a\n  - b\nnotes-by: me\n---\n\n'
    const out = updateHead(head, { date: '2026-01-09', attendees: ['A B'] })
    expect(out).toBe(
      '---\nseries: Other\ncolour: blue\ndate: 2026-01-09\nattendees: [A B]\nlinks:\n  - a\n  - b\nnotes-by: me\n---\n\n'
    )
  })

  it('keeps a comment line that sits under a replaced key', () => {
    const head =
      '---\nseries: Other\ndate: 2026-01-02\n# who came\nattendees: [A]\n# end of people\nmode: online\n---\n'
    expect(updateHead(head, { attendees: ['B'] })).toBe(
      '---\nseries: Other\ndate: 2026-01-02\n# who came\nattendees: [B]\n# end of people\nmode: online\n---\n'
    )
  })

  it('removes keys set to null or, for discussed, emptied', () => {
    const out = updateHead(HEAD, { start: null, end: null, mode: null, discussed: [] })
    expect(out).not.toMatch(/^(start|end|mode|discussed):/m)
    expect(parseMeta(out).meta).toMatchObject({ start: null, end: null, mode: null, discussed: [] })
  })

  it('replaces a block list with an inline list', () => {
    const head = '---\nseries: Other\ndate: 2026-01-02\nattendees:\n  - A\n  - B\n---\n'
    expect(updateHead(head, { attendees: ['A', 'C'] })).toBe(
      '---\nseries: Other\ndate: 2026-01-02\nattendees: [A, C]\n---\n'
    )
  })

  it('creates a front matter block when there is none', () => {
    const out = updateHead('', {
      series: 'Supervision',
      date: '2026-09-24',
      start: '09:00',
      attendees: []
    })
    expect(out).toBe(
      "---\nseries: Supervision\ndate: 2026-09-24\nstart: '09:00'\nattendees: []\n---\n\n"
    )
    expect(splitNote(out + 'body')).toEqual({ head: out, body: 'body' })
  })

  it('writes new keys in the canonical position', () => {
    const head = '---\nseries: Other\ndate: 2026-01-02\nattendees: [A]\n---\n'
    expect(updateHead(head, { start: '10:00', mode: 'online' })).toBe(
      "---\nseries: Other\ndate: 2026-01-02\nstart: '10:00'\nmode: online\nattendees: [A]\n---\n"
    )
  })

  it('quotes values that would otherwise be misread, and reads them back', () => {
    const topics = [
      'Weights: applied twice',
      'Yes',
      '# not a comment',
      "Kathy's, point",
      'plain words',
      '2026'
    ]
    const out = updateHead('', { series: 'Other', date: '2026-01-02', discussed: topics })
    expect(parseMeta(out).meta.discussed).toEqual(topics)
  })

  it('keeps CRLF line endings', () => {
    const head = '---\r\nseries: Other\r\ndate: 2026-01-02\r\n---\r\n\r\n'
    const out = updateHead(head, { mode: 'online' })
    expect(out).toBe('---\r\nseries: Other\r\ndate: 2026-01-02\r\nmode: online\r\n---\r\n\r\n')
  })

  it('round-trips through parseMeta', () => {
    const meta = parseMeta(HEAD).meta
    const rebuilt = updateHead('', meta)
    expect(parseMeta(rebuilt).meta).toEqual(meta)
  })
})

describe('normaliseTime', () => {
  it('pads single-digit hours and rejects nonsense', () => {
    expect(normaliseTime('9:05')).toBe('09:05')
    expect(normaliseTime('23:59')).toBe('23:59')
    expect(normaliseTime('24:00')).toBeNull()
    expect(normaliseTime('10:5')).toBeNull()
    expect(normaliseTime('')).toBeNull()
  })
})

describe('skills in the front matter', () => {
  it('reads skills, and treats a missing key as none', () => {
    const withSkills = updateHead(HEAD, { skills: ['Networking (RP)', 'Leadership (RP)'] })
    expect(parseMeta(withSkills).meta.skills).toEqual(['Networking (RP)', 'Leadership (RP)'])
    expect(parseMeta(HEAD).meta.skills).toEqual([])
  })

  it('writes skills after the attendees, keeps other keys and removes the key when emptied', () => {
    const added = updateHead(HEAD, { skills: ['Networking (RP)'] })
    const keys = added.split('\n').map((l) => l.split(':')[0])
    expect(keys.indexOf('skills')).toBe(keys.indexOf('attendees') + 1)
    expect(added).toContain('discussed: [Study 1 model results]')
    expect(updateHead(added, { skills: [] })).toBe(HEAD)
  })
})
