import { describe, expect, it } from 'vitest'
import { buildIndexRow } from '../modules/meetings/main/index-row'
import { buildTrainingIndexRow } from '../modules/training/main/index-row'
import { hasSummary } from './summary'

const meeting = (body: string): { summary: string } =>
  buildIndexRow('research', 'x', `---\nseries: Other\ndate: 2026-01-02\n---\n${body}`)
const training = (body: string): { summary: string } =>
  buildTrainingIndexRow('research', 'x', `---\ndate: 2026-01-02\ntitle: T\n---\n${body}`)

describe.each([
  ['meeting', meeting],
  ['training', training]
])('hasSummary on a %s note', (_name, build) => {
  it('is false when the section is missing, empty or only blank lines', () => {
    expect(hasSummary(build('## Notes\n- a\n'))).toBe(false)
    expect(hasSummary(build('## Summary\n## Notes\n- a\n'))).toBe(false)
    expect(hasSummary(build('## Summary\n\n   \n\t\n## Notes\n'))).toBe(false)
  })

  it('is true when the section has text', () => {
    expect(hasSummary(build('## Summary\nKey topics: x.\n## Notes\n'))).toBe(true)
  })

  it('counts only the Summary section, not text under other headings', () => {
    expect(hasSummary(build('## Summary\n## Notes\nLots of text here\n'))).toBe(false)
    expect(hasSummary(build('## Notes\nText\n## Summary\n'))).toBe(false)
  })
})
