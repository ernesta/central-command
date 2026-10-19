import { describe, expect, it } from 'vitest'
import { NEW_MEETING_BODY, parseMeta, splitNote } from './front-matter'
import { isUntouchedMeeting } from './untouched'

const NEW = `---\ndate: 2026-10-19\ntask: auto\n---\n${NEW_MEETING_BODY}`
const check = (text: string): boolean => {
  const { head, body } = splitNote(text)
  return isUntouchedMeeting(parseMeta(head).meta, body)
}

describe('isUntouchedMeeting', () => {
  it('is what New meeting makes, however the blank lines fall, and with any date', () => {
    expect(check(NEW)).toBe(true)
    expect(check(NEW.replace('2026-10-19', '2026-11-02'))).toBe(true)
    expect(check(NEW.replace('## Summary\n', '\n## Summary\n\n\n'))).toBe(true)
    expect(check(NEW.replace(/\n/g, '\r\n'))).toBe(true)
  })

  it.each([
    ['a series', 'series: Luminos\n'],
    ['a start time', "start: '10:00'\n"],
    ['an end time', "end: '11:00'\n"],
    ['a mode', 'mode: online\n'],
    ['an attendee', 'attendees: [Kathy Rastle]\n'],
    ['a skill', 'skills: [Statistics]\n'],
    ['a topic', 'discussed: [Ethics]\n']
  ])('is not with %s', (_what, line) => {
    expect(check(NEW.replace('date:', `${line}date:`))).toBe(false)
  })

  it.each([
    ['a line of text', `${NEW_MEETING_BODY}hello\n`],
    ['another heading', `${NEW_MEETING_BODY}## Previous TODOs\n`],
    ['a heading removed', '## Summary\n'],
    ['text under a heading', '## Summary\nWe met.\n## Notes\n']
  ])('is not with %s in the body', (_what, body) => {
    expect(check(`---\ndate: 2026-10-19\n---\n${body}`)).toBe(false)
  })
})
