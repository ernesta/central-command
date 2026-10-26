import type { Migration } from '../../../main/db/migrate'
import init from './migrations/0001_init.sql?raw'
import twoKinds from './migrations/0002_two_kinds.sql?raw'

export const watchMigrations: Migration[] = [
  { id: 'watch/0001_init', sql: init },
  { id: 'watch/0002_two_kinds', sql: twoKinds }
]
