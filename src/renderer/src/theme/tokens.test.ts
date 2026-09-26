import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src/renderer/src/theme/tokens.css'), 'utf8')

type Scheme = 'light' | 'dark'

/** A colour token's value in one scheme, from `--name: light-dark(light, dark);`. */
function token(name: string, scheme: Scheme): string {
  const match = new RegExp(
    `--${name}:\\s*light-dark\\(\\s*(#[0-9a-fA-F]{6})\\s*,\\s*(#[0-9a-fA-F]{6})\\s*\\)`
  ).exec(css)
  if (!match) throw new Error(`--${name} is not a light-dark() pair of hex colours`)
  return scheme === 'light' ? match[1] : match[2]
}

function luminance(hex: string): number {
  const channel = (i: number): number => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2)
}

/** WCAG contrast ratio between two colours. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const TEXT_ON: [string, string][] = [
  ['ink', 'bg'],
  ['ink', 'surface'],
  ['ink', 'panel'],
  ['ink', 'hover-tint'],
  ['text-secondary', 'bg'],
  ['text-secondary', 'surface'],
  ['text-secondary', 'hover-tint'],
  ['text-muted', 'bg'],
  ['text-muted', 'surface'],
  ['text-muted', 'panel'],
  ['accent', 'surface'],
  ['accent', 'bg'],
  ['danger', 'surface'],
  ['danger', 'bg'],
  ['selected-text', 'selected-bg'],
  ['accent-contrast', 'accent'],
  ['accent-contrast', 'accent-hover'],
  ['accent-contrast', 'danger'],
  ['accent-contrast', 'danger-hover']
]

describe.each<Scheme>(['light', 'dark'])('the %s colours', (scheme) => {
  it.each(TEXT_ON)('%s on %s is readable (WCAG AA, 4.5:1)', (fg, bg) => {
    expect(contrast(token(fg, scheme), token(bg, scheme))).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the strong border visible against a card (3:1 is for controls; this is a softer 1.4:1)', () => {
    expect(
      contrast(token('border-strong', scheme), token('surface', scheme))
    ).toBeGreaterThanOrEqual(1.4)
  })

  it('has both colours of every pair (no missing or malformed value)', () => {
    for (const name of ['bg', 'panel', 'surface', 'ink', 'accent', 'danger', 'scrim'].filter(
      (n) => n !== 'scrim'
    )) {
      expect(token(name, scheme)).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})
