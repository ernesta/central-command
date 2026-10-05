import { describe, expect, it } from 'vitest'
import { isUntouchedBody } from './untouched'

const TEMPLATE = '## Summary\n## Notes\n'

describe('isUntouchedBody', () => {
  it('accepts the template, with any blank lines or line breaks', () => {
    expect(isUntouchedBody(TEMPLATE, TEMPLATE)).toBe(true)
    expect(isUntouchedBody('## Summary\r\n\r\n## Notes\r\n\r\n', TEMPLATE)).toBe(true)
    expect(isUntouchedBody('', '')).toBe(true)
    expect(isUntouchedBody('  \n', '')).toBe(true)
  })

  it('rejects any text typed under or beside the headings', () => {
    expect(isUntouchedBody('## Summary\n## Notes\nhello\n', TEMPLATE)).toBe(false)
    expect(isUntouchedBody('## Summary\n## Notes\n### Topic\n', TEMPLATE)).toBe(false)
    expect(isUntouchedBody('hi', '')).toBe(false)
  })
})
