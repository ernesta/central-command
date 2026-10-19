import { describe, expect, it } from 'vitest'
import { NEW_TRAINING_BODY, parseTrainingMeta, splitNote } from './front-matter'
import { isUntouchedTraining } from './untouched'

const check = (text: string): boolean => {
  const { head, body } = splitNote(text)
  return isUntouchedTraining(parseTrainingMeta(head).meta, body)
}
const NEW = `---\ndate: 2026-10-19\ntitle: Untitled\ntask: auto\n---\n${NEW_TRAINING_BODY}`

describe('isUntouchedTraining', () => {
  it('is what New training entry makes, whatever the date', () => {
    expect(check(NEW)).toBe(true)
    expect(check(NEW.replace('2026-10-19', '2027-01-01'))).toBe(true)
    expect(check(NEW.replace('title: Untitled\n', ''))).toBe(true)
  })
  it.each([
    ['a title', 'title: Untitled', 'title: Plotly'],
    ['a series', 'title: Untitled', 'title: Untitled\nseries: PS5210'],
    ['a type', 'title: Untitled', 'title: Untitled\ntype: Language'],
    ['skills', 'title: Untitled', 'title: Untitled\nskills: [R]'],
    ['a task made', 'task: auto', 'task: abc12345'],
    ['a self-study task', 'task: auto', 'task: auto\nselfstudy: abc12345']
  ])('is not with %s', (_what, from, to) => {
    expect(check(NEW.replace(from, to))).toBe(false)
  })
  it('is not with text in the body', () => {
    expect(check(`${NEW}hello\n`)).toBe(false)
  })
})
