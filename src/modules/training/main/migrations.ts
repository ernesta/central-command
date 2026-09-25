import type { Migration } from '../../../main/db/migrate'
import init from './migrations/0001_init.sql?raw'

export const trainingMigrations: Migration[] = [{ id: 'training/0001_init', sql: init }]
