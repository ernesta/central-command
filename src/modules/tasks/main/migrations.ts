import type { Migration } from '../../../main/db/migrate'
import init from './migrations/0001_init.sql?raw'
import life from './migrations/0002_life.sql?raw'

export const tasksMigrations: Migration[] = [
  { id: 'tasks/0001_init', sql: init },
  { id: 'tasks/0002_life', sql: life }
]
