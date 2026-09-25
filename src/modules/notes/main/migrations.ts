import type { Migration } from '../../../main/db/migrate'
import notes from './migrations/0001_notes.sql?raw'

export const notesMigrations: Migration[] = [{ id: 'notes/0001_notes', sql: notes }]
