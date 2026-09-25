import { join } from 'path'
import type { NoteContent, NoteWriteResult } from '@shared/notes'
import { readNoteFile, writeNoteFileGuarded } from '../../../main/notes/guarded-file'
import { planFileName } from '../shared/plan'

/**
 * Reads and writes the training plan of each academic year: one Markdown file per year in `dir`,
 * kept apart from the entry files so it is never mistaken for a training entry. Like every note it
 * is written only if the file still holds what the editor last saw, and is never deleted.
 */
export class PlanStore {
  constructor(private readonly dir: string) {}

  private path(year: number): string {
    return join(this.dir, planFileName(year))
  }

  read(year: number): Promise<NoteContent> {
    return readNoteFile(this.path(year))
  }

  async write(year: number, content: string, baseHash: string): Promise<NoteWriteResult> {
    return (await writeNoteFileGuarded(this.path(year), content, baseHash)).result
  }
}
