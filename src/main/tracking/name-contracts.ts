import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { isDeepStrictEqual } from 'util'
import { parseYear } from '@shared/tracking/parse'
import { writeFileAtomicSync } from '../atomic-write'

export type Naming =
  | { kind: 'name'; next: string }
  | { kind: 'named'; name: string }
  | { kind: 'problem'; problem: string }

/** A contract file's text with `name` added after `start`; a name already there is never changed. */
export function withName(text: string, name: string): Naming {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { kind: 'problem', problem: 'not JSON' }
  }
  const year = parseYear(raw)
  if (!year) return { kind: 'problem', problem: 'not a readable contract file' }
  if (year.name !== undefined) return { kind: 'named', name: year.name }
  const { version, start, ...rest } = raw as Record<string, unknown>
  const next = JSON.stringify({ version, start, name, ...rest }, null, 2) + '\n'
  // Only the new line may differ.
  const back = JSON.parse(next) as Record<string, unknown>
  delete back.name
  if (!isDeepStrictEqual(back, raw))
    return {
      kind: 'problem',
      problem: 'the result would differ from the file in more than the name'
    }
  return { kind: 'name', next }
}

export interface NameReport {
  lines: string[]
  changed: number
  backup: string | null
  ok: boolean
}

/** Names every unnamed Work contract file `name`. Dry run unless `apply`; backs the folder up first. */
export function nameContracts(
  root: string,
  name: string,
  apply: boolean,
  stamp: string
): NameReport {
  const dir = join(root, 'time', 'work')
  const report: NameReport = { lines: [], changed: 0, backup: null, ok: true }
  if (!existsSync(dir)) {
    report.lines.push(`No Work contracts under ${dir}`)
    report.ok = false
    return report
  }
  const todo: { file: string; next: string }[] = []
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const result = withName(readFileSync(join(dir, file), 'utf8'), name)
    if (result.kind === 'name') {
      todo.push({ file, next: result.next })
      report.lines.push(`${file}: would be named "${name}"`)
    } else if (result.kind === 'named') report.lines.push(`${file}: already named "${result.name}"`)
    else {
      report.lines.push(`${file}: ${result.problem}`)
      report.ok = false
    }
  }
  if (!report.ok || !apply || todo.length === 0) return report
  report.backup = join(root, 'backups', `name-contracts-${stamp}`)
  mkdirSync(report.backup, { recursive: true })
  cpSync(dir, join(report.backup, 'work'), { recursive: true })
  for (const { file, next } of todo) writeFileAtomicSync(join(dir, file), next)
  for (const { file } of todo) {
    const back = parseYear(JSON.parse(readFileSync(join(dir, file), 'utf8')))
    if (back?.name !== name) {
      report.lines.push(`${file}: read back wrong; restore from ${report.backup}`)
      report.ok = false
    }
  }
  report.changed = todo.length
  return report
}
