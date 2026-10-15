import { ipcMain, shell } from 'electron'
import type { Database } from 'better-sqlite3'
import { join } from 'path'
import { ENTITY_KINDS, type EntityRef } from '@shared/entities'
import { IPC } from '@shared/api'
import { findBacklinks, type BacklinkFolder } from '../entities/backlinks'
import { findTaskBacklinks } from '../entities/task-backlinks'
import { FileMemory, resolveEntityFile } from '../entities/file-memory'
import { moveFileMentions } from '../entities/file-links'
import { listEntityFiles } from '../entities/files'
import type { AppPaths } from '../paths'

/** Every folder of notes a mention can be written in. */
export function backlinkFolders(paths: AppPaths): BacklinkFolder[] {
  return [
    { kind: 'note', workspace: 'life', dir: join(paths.noteFiles, 'life') },
    ...(['research', 'work'] as const).flatMap((workspace): BacklinkFolder[] => [
      { kind: 'note', workspace, dir: join(paths.noteFiles, workspace) },
      { kind: 'meeting', workspace, dir: join(paths.meetingsNotes, workspace) }
    ]),
    { kind: 'training', workspace: 'life', dir: join(paths.trainingNotes, 'life') },
    { kind: 'training', workspace: 'research', dir: join(paths.trainingNotes, 'research') },
    { kind: 'reading-list', workspace: 'research', dir: join(paths.readingListFiles, 'research') },
    { kind: 'reading-notes', workspace: 'research', dir: paths.readingsNotes },
    { kind: 'plan', workspace: 'research', dir: paths.trainingPlans }
  ]
}

function asRef(value: unknown): EntityRef {
  const o = value as { kind?: unknown; key?: unknown } | null
  if (
    !o ||
    typeof o.kind !== 'string' ||
    !(ENTITY_KINDS as readonly string[]).includes(o.kind) ||
    typeof o.key !== 'string' ||
    o.key === ''
  ) {
    throw new Error('Invalid entity')
  }
  return { kind: o.kind as EntityRef['kind'], key: o.key }
}

function asKey(value: unknown): string {
  if (typeof value !== 'string' || value === '') throw new Error('Invalid file')
  return value
}

/** Where an entity is mentioned: read from the note files on demand, and from the descriptions of tasks. */
export function registerEntitiesIpc(paths: AppPaths, db: Database): void {
  ipcMain.handle(IPC.entitiesFiles, () => listEntityFiles(paths.noteFiles))
  // A file that was renamed or moved is found again, and the notes that mention it follow it. One move is
  // handled once, however many chips ask at the same time.
  const memory = new FileMemory(db)
  const resolving = new Map<string, ReturnType<typeof resolveEntityFile>>()
  const resolveFile = (key: string): ReturnType<typeof resolveEntityFile> => {
    const running = resolving.get(key)
    if (running) return running
    const run = (async () => {
      const resolved = await resolveEntityFile(paths.noteFiles, key, memory)
      if (resolved.file && resolved.movedFrom) {
        await moveFileMentions({
          folders: backlinkFolders(paths),
          db,
          backupDir: join(
            paths.root,
            'backups',
            `file-moved-${new Date().toISOString().replace(/[:.]/g, '-')}`
          ),
          from: resolved.movedFrom,
          to: resolved.file.key
        })
      }
      return resolved
    })().finally(() => resolving.delete(key))
    resolving.set(key, run)
    return run
  }
  ipcMain.handle(
    IPC.entitiesFileInfo,
    async (_event, key: unknown) => (await resolveFile(asKey(key))).file
  )
  ipcMain.handle(IPC.entitiesFileOpen, async (_event, key: unknown) => {
    const { file } = await resolveFile(asKey(key))
    if (!file) throw new Error('That file is gone')
    const problem = await shell.openPath(join(paths.noteFiles, file.key))
    if (problem) throw new Error(problem)
  })
  ipcMain.handle(IPC.entitiesBacklinks, async (_event, ref: unknown) => {
    const target = asRef(ref)
    const [files, tasks] = [
      await findBacklinks(target, backlinkFolders(paths)),
      findTaskBacklinks(db, target)
    ]
    return [...files, ...tasks].sort((a, b) => a.title.localeCompare(b.title))
  })
}
