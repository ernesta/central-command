/**
 * One-off repair (26 Oct 2026, `docs/DECISIONS.md`, "Training files: any folder, no Trainings folder setting"): a training
 * note's `folder:` was a path relative to the Trainings folder setting; it is now an absolute path and the setting is gone.
 *
 *   npm run repair:training-folders                # dry run: lists every link it would rewrite, writes nothing
 *   npm run repair:training-folders -- --apply     # rewrites them, then removes `trainingsFolder` from settings.json
 *
 * Only the `folder:` line of a note changes (checked: the rest of the file is identical). Each note is copied to
 * `~/CentralCommand/backups/repair-training-folders-<time>/` first, and written through the content-hash guard; a note that
 * changed since it was read is skipped, and the setting is only removed when every note was done. Links that already are
 * absolute are left alone. A link whose folder is not on disk is still rewritten (the panel says it is not there and looks
 * for it beside where it was) and listed. Close the app before applying. A second run finds nothing.
 */
import { existsSync, readdirSync, statSync } from 'fs'
import { mkdir, readFile } from 'fs/promises'
import { homedir } from 'os'
import { dirname, isAbsolute, join, relative } from 'path'
import { writeFileAtomic } from '../src/main/atomic-write'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { readNoteFile, writeNoteFileGuarded } from '../src/main/notes/guarded-file'
import {
  parseTrainingMeta,
  splitNote,
  updateTrainingHead
} from '../src/modules/training/shared/front-matter'

const apply = process.argv.includes('--apply')
const home = assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir())
const library = join(home, 'CentralCommand')
const trainingNotes = join(library, 'notes', 'training')
const settingsPath = join(library, 'settings.json')

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name.startsWith('.')) return []
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return markdownFiles(path)
    return name.endsWith('.md') ? [path] : []
  })
}

async function run(): Promise<void> {
  console.log(
    apply
      ? 'Mode : APPLY (rewriting notes, with backups)\n'
      : 'Mode : dry run (nothing will be written)\n'
  )
  const settings = JSON.parse(await readFile(settingsPath, 'utf8')) as Record<string, unknown>
  const root = typeof settings.trainingsFolder === 'string' ? settings.trainingsFolder : ''
  if (root !== '' && !isAbsolute(root)) throw new Error(`trainingsFolder is not absolute: ${root}`)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = join(library, 'backups', `repair-training-folders-${stamp}`)
  let seen = 0
  let changed = 0
  let failed = 0
  let absolute = 0
  let missing = 0
  for (const path of existsSync(trainingNotes) ? markdownFiles(trainingNotes).sort() : []) {
    const rel = relative(trainingNotes, path)
    const note = await readNoteFile(path)
    if (!note.exists) continue
    const { head, body } = splitNote(note.content)
    const folder = parseTrainingMeta(head).meta.folder
    seen++
    if (!folder) continue
    if (isAbsolute(folder)) {
      absolute++
      continue
    }
    if (root === '') {
      failed++
      console.log(
        `LEFT ALONE ${rel}: relative link "${folder}" and no Trainings folder in settings`
      )
      continue
    }
    const target = join(root, folder)
    const newHead = updateTrainingHead(head, { folder: target })
    const expected = note.content.replace(head, newHead)
    // Only the folder line may differ: put the old value back and the note must be the original.
    if (
      newHead === head ||
      parseTrainingMeta(newHead).meta.folder !== target ||
      updateTrainingHead(newHead, { folder }) + body !== note.content
    ) {
      failed++
      console.log(`LEFT ALONE ${rel}: the rewrite would change more than the folder line`)
      continue
    }
    const there = existsSync(target) && statSync(target).isDirectory()
    if (!there) missing++
    console.log(`${rel}\n  ${folder}\n  -> ${target}${there ? '' : '   (NOT ON DISK)'}`)
    if (!apply) {
      changed++
      continue
    }
    await mkdir(join(backupDir, dirname(rel)), { recursive: true })
    await writeFileAtomic(join(backupDir, rel), note.content)
    const { result, wrote } = await writeNoteFileGuarded(path, expected, note.hash)
    if (result.status === 'conflict') {
      failed++
      console.log('  SKIPPED: the file changed while this ran; nothing was written to it.')
    } else if (wrote) changed++
  }
  console.log(
    `\n${changed} of ${seen} note(s) ${apply ? 'changed' : 'would change'}; ${absolute} already absolute; ${missing} folder(s) not on disk${failed ? `; ${failed} left alone` : ''}.`
  )
  if (apply && changed > 0) console.log(`Originals are in ${backupDir}`)
  if (!apply) {
    console.log('Dry run only. Re-run with --apply to rewrite these notes.')
    return
  }
  if (failed > 0) {
    console.log('Some notes were left alone: trainingsFolder stays in settings.json.')
    return
  }
  if ('trainingsFolder' in settings) {
    delete settings.trainingsFolder
    await writeFileAtomic(settingsPath, JSON.stringify(settings, null, 2) + '\n')
    console.log('Removed trainingsFolder from settings.json.')
  }
}

void run()
