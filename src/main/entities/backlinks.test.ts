import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { contextOf, findBacklinks, type BacklinkFolder } from './backlinks'

let root: string
let folders: BacklinkFolder[]

const put = (dir: string, name: string, content: string): void =>
  writeFileSync(join(root, dir, name), content)

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cc-backlinks-'))
  for (const d of ['notes', 'meetings', 'work-notes']) mkdirSync(join(root, d))
  folders = [
    { kind: 'note', workspace: 'research', dir: join(root, 'notes') },
    { kind: 'meeting', workspace: 'research', dir: join(root, 'meetings') },
    { kind: 'note', workspace: 'work', dir: join(root, 'work-notes') },
    { kind: 'plan', workspace: 'research', dir: join(root, 'no-such-folder') }
  ]
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

const TARGET = { kind: 'person', key: 'Kathy Rastle' } as const

describe('findBacklinks', () => {
  it('lists each note that mentions the entity once, with a title and the line it is on', async () => {
    put(
      'notes',
      'Plan.md',
      '---\ntitle: The plan\n---\n\nIntro\n\n- Ask [Kathy Rastle](cc://person/Kathy%20Rastle) about **methods**\n- again [K](cc://person/Kathy%20Rastle)\n'
    )
    put(
      'meetings',
      '2026-09-24 Supervision.md',
      '---\nseries: Supervision\ndate: 2026-09-24\n---\n\nTalked to [Kathy](cc://person/Kathy%20Rastle).\n'
    )
    put('work-notes', 'Other.md', 'No front matter, [Kathy](cc://person/Kathy%20Rastle)\n')
    put(
      'notes',
      'Unrelated.md',
      '[Someone](cc://person/Someone) and [Kathy Rastle](cc://reading/Kathy%20Rastle)\n'
    )
    put('notes', 'Plain.md', 'Kathy Rastle without a mention\n')
    const found = await findBacklinks(TARGET, folders)
    expect(
      found.map((b) => [b.source.kind, b.source.workspace, b.source.id, b.title, b.context])
    ).toEqual([
      ['note', 'work', 'Other', 'Other', 'No front matter, Kathy'],
      [
        'meeting',
        'research',
        '2026-09-24 Supervision',
        'Supervision · Sep 24, 2026',
        'Talked to Kathy.'
      ],
      ['note', 'research', 'Plan', 'The plan', 'Ask Kathy Rastle about methods']
    ])
  })

  it('finds nothing for an entity nobody mentions, and skips folders that do not exist', async () => {
    put('notes', 'Plan.md', 'nothing\n')
    expect(await findBacklinks(TARGET, folders)).toEqual([])
  })

  it('does not mistake one kind for another or one key for another', async () => {
    put('notes', 'A.md', '[x](cc://note/Kathy%20Rastle) [y](cc://person/Kathy%20Rastle2)\n')
    expect(await findBacklinks(TARGET, folders)).toEqual([])
  })
})

describe('contextOf', () => {
  it('shortens a long line and drops markdown marks', () => {
    const text = `# Heading with [link](cc://note/x) ${'word '.repeat(60)}`
    const out = contextOf(text, 5)
    expect(out.startsWith('Heading with link word')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(140)
    expect(out.endsWith('…')).toBe(true)
  })
})
