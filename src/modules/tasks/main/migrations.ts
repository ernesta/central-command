import type { Migration } from '../../../main/db/migrate'
import init from './migrations/0001_init.sql?raw'
import life from './migrations/0002_life.sql?raw'
import ownKind from './migrations/0003_own_kind.sql?raw'
import autoClosed from './migrations/0004_auto_closed.sql?raw'

export const tasksMigrations: Migration[] = [
  { id: 'tasks/0001_init', sql: init },
  { id: 'tasks/0002_life', sql: life },
  { id: 'tasks/0003_own_kind', sql: ownKind },
  { id: 'tasks/0004_auto_closed', sql: autoClosed }
]
