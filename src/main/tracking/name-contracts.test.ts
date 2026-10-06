import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultPlan, emptyYear } from '@shared/tracking/types'
import { nameContracts, withName } from './name-contracts'

const text = (start: string, name?: string): string =>
  JSON.stringify(
    { ...emptyYear(start, defaultPlan('work'), 0), ...(name ? { name } : {}) },
    null,
    2
  ) + '\n'

describe('withName', () => {
  it('adds a name after start, changes nothing else, and keeps a name that exists', () => {
    const result = withName(text('2026-05-01'), 'Luminos')
    if (result.kind !== 'name') throw new Error('expected a name')
    expect(result.next).toContain('"name": "Luminos"')
    expect(Object.keys(JSON.parse(result.next)).slice(0, 3)).toEqual(['version', 'start', 'name'])
    expect(withName(text('2026-05-01', 'Other'), 'Luminos')).toEqual({
      kind: 'named',
      name: 'Other'
    })
    expect(withName('{', 'Luminos').kind).toBe('problem')
  })
})

describe('nameContracts', () => {
  let root: string
  const work = (): string => join(root, 'time', 'work')
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'cc-name-'))
    mkdirSync(work(), { recursive: true })
    writeFileSync(join(work(), '2025-10-01.json'), text('2025-10-01'))
    writeFileSync(join(work(), '2026-05-01.json'), text('2026-05-01', 'Kept'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('a dry run changes nothing; apply backs up, names the unnamed and keeps the named', () => {
    const before = readFileSync(join(work(), '2025-10-01.json'), 'utf8')
    const dry = nameContracts(root, 'Luminos', false, 't')
    expect(dry.ok && dry.changed === 0 && dry.backup === null).toBe(true)
    expect(readFileSync(join(work(), '2025-10-01.json'), 'utf8')).toBe(before)

    const done = nameContracts(root, 'Luminos', true, 't')
    expect(done.changed).toBe(1)
    expect(readFileSync(join(work(), '2025-10-01.json'), 'utf8')).toContain('"name": "Luminos"')
    expect(readFileSync(join(work(), '2026-05-01.json'), 'utf8')).toContain('"name": "Kept"')
    expect(readFileSync(join(done.backup!, 'work', '2025-10-01.json'), 'utf8')).toBe(before)
    expect(readdirSync(work()).sort()).toEqual(['2025-10-01.json', '2026-05-01.json'])

    expect(nameContracts(root, 'Luminos', true, 'u').changed).toBe(0)
  })
})
