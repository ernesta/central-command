import type { Migration } from '../../../main/db/migrate'
import notes from './migrations/0001_notes.sql?raw'
import dropCreated from './migrations/0002_drop_created.sql?raw'

export const notesMigrations: Migration[] = [
  { id: 'notes/0001_notes', sql: notes },
  { id: 'notes/0002_drop_created', sql: dropCreated }
]
