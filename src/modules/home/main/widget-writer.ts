import { join } from 'path'
import { writeFileAtomic } from '../../../main/atomic-write'
import { buildWidgetSnapshot } from '../shared/widget'
import type { HomeSummary } from '../shared/types'

export const WIDGET_FILE = 'snapshot.json'

/** Writes the widget's file when it would differ from the last one written (the time of the reading does not count). */
export class WidgetWriter {
  private last = ''

  constructor(private readonly dir: string) {}

  async write(summary: HomeSummary): Promise<boolean> {
    const snapshot = buildWidgetSnapshot(summary)
    const body = JSON.stringify({ ...snapshot, generatedAt: '' })
    if (body === this.last) return false
    await writeFileAtomic(join(this.dir, WIDGET_FILE), JSON.stringify(snapshot, null, 2) + '\n')
    this.last = body
    return true
  }
}
