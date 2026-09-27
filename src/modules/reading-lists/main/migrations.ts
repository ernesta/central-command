import type { Migration } from '../../../main/db/migrate'
import readingLists from './migrations/0001_reading_lists.sql?raw'

export const readingListsMigrations: Migration[] = [
  { id: 'reading-lists/0001_reading_lists', sql: readingLists }
]
