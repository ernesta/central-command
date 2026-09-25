/**
 * One-off: find the people named in your meeting attendees and training leads who are not in your people list.
 *
 *   npm run people:from-notes                 # dry run: lists them with proposed initials, writes nothing
 *   npm run people:from-notes -- --apply      # adds them to the people list (after copying it to a backup)
 *
 * Initials are worked out from the name and made unique (KR, KR2, ...); review them on the People page afterwards.
 * Notes are only read, never changed. Applying writes `data/people.json` only, so close the app first (it keeps the
 * list in memory and would overwrite the new entries with its own copy).
 *
 * Options: --home <dir> (default: the home folder, or CENTRAL_COMMAND_HOME).
 */
import { existsSync, readFileSync, readdirSync } from 'fs'
import { copyFile } from 'fs/promises'
import { homedir } from 'os'
import { join, resolve } from 'path'
import { writeFileAtomic } from '../src/main/atomic-write'
import { DATA_DIR_NAME } from '../src/shared/app-info'
import { normalisePeople } from '../src/shared/people'
import { parseMeta, splitNote } from '../src/modules/meetings/shared/front-matter'
import { addNamedPeople, namedInNotes } from '../src/modules/meetings/shared/people-from-notes'
import { parseTrainingMeta } from '../src/modules/training/shared/front-matter'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const apply = process.argv.includes('--apply')
const home = arg('home')
  ? resolve(arg('home') as string)
  : process.env.CENTRAL_COMMAND_HOME || homedir()
const root = join(home, DATA_DIR_NAME)
const peopleFile = join(root, 'data', 'people.json')

const readFolder = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
        .map((f) => readFileSync(join(dir, f), 'utf8'))
    : []

async function run(): Promise<void> {
  const people = existsSync(peopleFile)
    ? normalisePeople(JSON.parse(readFileSync(peopleFile, 'utf8')))
    : []
  const attendees = readFolder(join(root, 'notes', 'meetings', 'research')).map(
    (text) => parseMeta(splitNote(text).head).meta.attendees
  )
  const leads = readFolder(join(root, 'notes', 'training', 'research')).map(
    (text) => parseTrainingMeta(splitNote(text).head).meta.leads
  )
  const named = namedInNotes(people, attendees, leads)
  const next = addNamedPeople(people, named)

  console.log(`People file : ${peopleFile} (${people.length} people)`)
  console.log(apply ? 'Mode        : APPLY\n' : 'Mode        : dry run (nothing will be written)\n')
  named.forEach((n, i) => {
    const initials = next[people.length + i].initials
    console.log(
      `  ${initials.padEnd(5)} ${n.name}  (${n.meetings} meeting(s), ${n.trainings} training(s))`
    )
  })
  console.log(`\n${named.length} ${apply ? 'added' : 'would be added'}.`)
  if (!apply) {
    if (named.length)
      console.log('Dry run only. Close the app, then re-run with --apply to add them.')
    return
  }
  if (named.length === 0) return
  if (existsSync(peopleFile)) await copyFile(peopleFile, `${peopleFile}.backup-${Date.now()}`)
  await writeFileAtomic(peopleFile, JSON.stringify({ people: next }, null, 2) + '\n')
  console.log('The previous list is copied next to people.json as people.json.backup-<time>.')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
