import type { Migration } from '../../../main/db/migrate'
import init from './migrations/0001_init.sql?raw'
import review from './migrations/0002_review.sql?raw'

export const trainingMigrations: Migration[] = [
  { id: 'training/0001_init', sql: init },
  { id: 'training/0002_review', sql: review }
]
