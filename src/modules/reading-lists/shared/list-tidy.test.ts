import { describe, expect, it } from 'vitest'
import type { CitableReading } from '@shared/citations'
import { tidyListBody } from './list-tidy'

const readings: CitableReading[] = [
  { citekey: 'kim2020', authors: ['Kim', 'Lee', 'Zuilkowski'], year: 2020 },
  { citekey: 'taylor2016', authors: ['Taylor', 'von Fintel'], year: 2016 }
]
const ctx = {
  readings,
  labelFor: (k: string) => (k === 'taylor2016' ? 'Taylor & von Fintel (2016)' : '')
}

describe('tidyListBody', () => {
  it('shortens a linked entry to its link and keeps the annotation', () => {
    const body =
      '## S\n\n- **[Kim, Lee & Zuilkowski (2020)](cc://reading/kim2020). A title. Child Dev, 91(2).** Meta-analysis.\n'
    const r = tidyListBody(body, ctx)
    expect(r.body).toBe(
      '## S\n\n- **[Kim, Lee & Zuilkowski (2020)](cc://reading/kim2020)** Meta-analysis.\n'
    )
    expect(r.changes).toHaveLength(1)
  })

  it('turns @citekey into an entity', () => {
    const r = tidyListBody('## S\n\n- **@taylor2016** Pupils did worse.\n', ctx)
    expect(r.body).toBe(
      '## S\n\n- **[Taylor & von Fintel (2016)](cc://reading/taylor2016)** Pupils did worse.\n'
    )
  })

  it('links a typed citation only when exactly one reading fits, dropping the reference text', () => {
    const body =
      '## S\n\n- **Kim, Lee & Zuilkowski (2020). Title. Journal.** Note.\n- **Igarashi, Maulana & Suryadarma (2024). Title. Journal.** Other.\n'
    const r = tidyListBody(body, ctx)
    expect(r.body).toBe(
      '## S\n\n- **[Kim, Lee & Zuilkowski (2020)](cc://reading/kim2020)** Note.\n- **Igarashi, Maulana & Suryadarma (2024). Title. Journal.** Other.\n'
    )
    expect(r.waiting).toEqual(['Igarashi, Maulana & Suryadarma (2024). Title. Journal.'])
  })

  it('is idempotent, and leaves other lines, headings and code alone', () => {
    const body =
      '## S\n\n- **[Kim](cc://reading/kim2020)** x\n- prose with no citation\n\n```\n- **@taylor2016** in code\n```\n'
    const r = tidyListBody(body, ctx)
    expect(r.body).toBe(body)
    expect(r.changes).toEqual([])
  })

  it('preserves CRLF line endings and every other line byte for byte', () => {
    const body = '## S\r\n\r\n- **@taylor2016** x\r\n- tail\r\n'
    expect(tidyListBody(body, ctx).body).toBe(
      '## S\r\n\r\n- **[Taylor & von Fintel (2016)](cc://reading/taylor2016)** x\r\n- tail\r\n'
    )
  })
})
