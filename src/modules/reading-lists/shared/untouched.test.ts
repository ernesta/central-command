import { expect, it } from 'vitest'
import { isUntouchedList } from './untouched'

it('a list is untouched with no title and nothing in it', () => {
  expect(isUntouchedList({ title: '' }, '')).toBe(true)
  expect(isUntouchedList({ title: '' }, '\n\n')).toBe(true)
  expect(isUntouchedList({ title: 'Methods' }, '')).toBe(false)
  expect(isUntouchedList({ title: '' }, '## Week 1\n')).toBe(false)
})
