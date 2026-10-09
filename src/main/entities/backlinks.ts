import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { findMentions, type Backlink, type BacklinkSource, type EntityRef } from '@shared/entities'
import { asText, parseHead, readValue, splitNote } from '@shared/front-matter'
import { lectureLabel } from '@modules/training/shared/lecture-entries'
import { meetingHeading } from '@shared/time'

/** A folder of notes of one kind, and how to name one of them. */
export interface BacklinkFolder {
  kind: BacklinkSource['kind']
  workspace: string
  dir: string
}

const CONTEXT_LENGTH = 140

function frontValue(head: string, key: string): string {
  const entry = parseHead(head)?.entries.find((e) => e.key === key)
  return entry ? asText(readValue(entry)).trim() : ''
}

function titleOf(kind: BacklinkSource['kind'], id: string, head: string): string {
  if (kind === 'meeting')
    return meetingHeading(frontValue(head, 'series'), frontValue(head, 'date'))
  if (kind === 'reading-notes') return `Notes on ${id}`
  if (kind === 'training') {
    return lectureLabel(frontValue(head, 'series'), frontValue(head, 'title') || id)
  }
  return frontValue(head, 'title') || id
}

/** The line a mention is on, as plain text: links show their label, emphasis and list marks are dropped. */
export function contextOf(text: string, at: number): string {
  const start = text.lastIndexOf('\n', at - 1) + 1
  const end = text.indexOf('\n', at)
  const line = text.slice(start, end === -1 ? undefined : end)
  const plain = line
    .replace(/\[((?:\\.|[^\]\\])*)\]\([^)\s]*\)/g, '$1')
    .replace(/\\([\\[\]])/g, '$1')
    .replace(/^\s*(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+\.\s+|#+\s+|>\s*)/, '')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > CONTEXT_LENGTH ? `${plain.slice(0, CONTEXT_LENGTH - 1).trimEnd()}…` : plain
}

/**
 * Every note that mentions `target`, from the given folders, by reading them (a few hundred small files: quicker than
 * keeping an index in step with them, and never out of date). A note is listed once, however often it mentions it.
 */
export async function findBacklinks(
  target: EntityRef,
  folders: readonly BacklinkFolder[]
): Promise<Backlink[]> {
  const found: Backlink[] = []
  for (const folder of folders) {
    let names: string[]
    try {
      names = (await readdir(folder.dir)).filter((f) => f.endsWith('.md') && !f.startsWith('.'))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      throw error
    }
    for (const name of names) {
      const content = await readFile(join(folder.dir, name), 'utf8')
      const mention = findMentions(content).find(
        (m) => m.ref.kind === target.kind && m.ref.key === target.key
      )
      if (!mention) continue
      const id = name.replace(/\.md$/, '')
      found.push({
        source: { kind: folder.kind, workspace: folder.workspace, id },
        title: titleOf(folder.kind, id, splitNote(content).head),
        context: contextOf(content, mention.start)
      })
    }
  }
  return found.sort((a, b) => a.title.localeCompare(b.title))
}
