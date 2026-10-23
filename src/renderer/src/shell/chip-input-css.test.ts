import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The search window clips (rounded corners, overflow: hidden), so the field's focus ring must sit inside
// it, not on the field's own edge (polish round, item 8). A real ring check needs the driven app.
const css = readFileSync(join(__dirname, 'ChipInput.module.css'), 'utf8')

describe('ChipInput focus ring', () => {
  it('is drawn inside the field, not as an outline on its edge', () => {
    expect(css).toMatch(/\.field:has\(\.input:focus-visible\)::after\s*{[^}]*inset:\s*3px/)
    expect(css).not.toMatch(/\.field:has\(\.input:focus-visible\)\s*{[^}]*outline/)
  })
})
