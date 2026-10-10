import type { Migration } from '../../../main/db/migrate'
import init from './migrations/0001_init.sql?raw'
import reference from './migrations/0002_reference.sql?raw'
import deletedCount from './migrations/0003_deleted_count.sql?raw'
import renameSuggestions from './migrations/0004_rename_suggestions.sql?raw'

export const readingsMigrations: Migration[] = [
  { id: 'readings/0001_init', sql: init },
  { id: 'readings/0002_reference', sql: reference },
  { id: 'readings/0003_deleted_count', sql: deletedCount },
  { id: 'readings/0004_rename_suggestions', sql: renameSuggestions }
]
