import type { Migration } from '../../../main/db/migrate'
import init from './migrations/0001_init.sql?raw'

export const readingsMigrations: Migration[] = [{ id: 'readings/0001_init', sql: init }]
