import type { Migration } from '../../../main/db/migrate'
import init from './migrations/0001_init.sql?raw'
import reference from './migrations/0002_reference.sql?raw'

export const readingsMigrations: Migration[] = [
  { id: 'readings/0001_init', sql: init },
  { id: 'readings/0002_reference', sql: reference }
]
