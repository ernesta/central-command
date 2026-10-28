import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The rules of `docs/CLICKABLES_PLAN.md` that a stylesheet can break without anyone noticing, read straight from the CSS: no
 * underline on hover, blue (`--selected-bg`) only for a selected state and never for hover, a row's pointer cursor and keyboard
 * ring written once (`Focus.module.css`). The live editor and `MeetingTask` are on the allow-list on purpose (DECISIONS,
 * "Links: a colour change on hover, never an underline").
 */
const SRC = join(__dirname, '..', '..', '..')

const cssFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'node_modules') return []
    if (statSync(path).isDirectory()) return cssFiles(path)
    return name.endsWith('.css') ? [path] : []
  })

interface Rule {
  file: string
  selector: string
  body: string
}

/** Every rule that holds declarations, at any depth (@media and @keyframes are looked through). */
const rulesOf = (file: string): Rule[] => {
  const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: Rule[] = []
  const walk = (from: number, to: number): void => {
    let i = from
    while (i < to) {
      const open = text.indexOf('{', i)
      if (open < 0 || open >= to) return
      let depth = 1
      let j = open + 1
      while (j < to && depth > 0) {
        if (text[j] === '{') depth++
        else if (text[j] === '}') depth--
        j++
      }
      const selector = text.slice(i, open).trim()
      const body = text.slice(open + 1, j - 1)
      if (body.includes('{')) walk(open + 1, j - 1)
      else rules.push({ file: relative(SRC, file), selector, body })
      i = j
    }
  }
  walk(0, text.length)
  return rules
}

const rules = cssFiles(SRC).flatMap(rulesOf)
const allowedUnderline = ['MeetingTask.module.css', 'LiveEditor.module.css']
const where = (found: Rule[]): string[] => found.map((r) => `${r.file}: ${r.selector}`)

describe('clickable things share one logic', () => {
  it('reads the stylesheets it guards', () => {
    expect(rules.length).toBeGreaterThan(1000)
    expect(rules.some((r) => r.file.endsWith('Focus.module.css'))).toBe(true)
  })

  it('never underlines on hover', () => {
    const found = rules.filter(
      (r) =>
        r.selector.includes(':hover') &&
        /text-decoration(-line)?\s*:[^;]*underline/.test(r.body) &&
        !allowedUnderline.some((f) => r.file.endsWith(f))
    )
    expect(where(found)).toEqual([])
  })

  it('never uses the selected blue for hover', () => {
    const found = rules.filter((r) => /:hover/.test(r.selector) && r.body.includes('--selected-bg'))
    expect(where(found)).toEqual([])
  })

  it('never uses the selected blue for the keyboard highlight of a list', () => {
    for (const file of ['entities/EntityPicker.module.css', 'editor/TodoMenu.module.css']) {
      const active = rules.filter((r) => r.file.endsWith(file) && r.selector === '.active')
      expect(active.length, file).toBeGreaterThan(0)
      expect(
        active.some((r) => r.body.includes('--hover-tint')),
        file
      ).toBe(true)
      expect(
        active.filter((r) => r.body.includes('--selected-bg')),
        file
      ).toEqual([])
    }
  })

  it('gives a table row its pointer cursor only through Focus.module.css', () => {
    const found = rules.filter(
      (r) =>
        /cursor\s*:\s*pointer/.test(r.body) &&
        /(^|[\s,>+~])(tr|\.row)(?![\w-])/.test(r.selector) &&
        !r.file.endsWith('Focus.module.css')
    )
    expect(where(found)).toEqual([])
  })

  it('writes a row’s keyboard ring and a card’s once', () => {
    const rowRing = rules.filter((r) => r.body.includes('inset 2px 0 0 var(--accent)'))
    expect(where(rowRing)).toEqual([
      'renderer/src/components/Focus.module.css: .rowFocus:focus-visible td:first-child'
    ])
    const cardRing = rules.filter((r) => /^\.card:has\(/.test(r.selector))
    expect(where(cardRing)).toEqual([])
  })

  it('writes the focus ring from the tokens, apart from the editor', () => {
    const found = rules.filter(
      (r) =>
        /outline\s*:\s*2px solid var\(--accent\)/.test(r.body) &&
        !r.file.endsWith('LiveEditor.module.css')
    )
    expect(where(found)).toEqual([])
  })
})
