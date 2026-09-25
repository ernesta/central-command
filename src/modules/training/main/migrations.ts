import type { Migration } from '../../../main/db/migrate'
import init from './migrations/0001_init.sql?raw'
import review from './migrations/0002_review.sql?raw'
import dropReview from './migrations/0003_drop_review.sql?raw'

export const trainingMigrations: Migration[] = [
  { id: 'training/0001_init', sql: init },
  { id: 'training/0002_review', sql: review },
  { id: 'training/0003_drop_review', sql: dropReview }
]
