import type { Migration } from '../../../main/db/migrate'
import init from './migrations/0001_init.sql?raw'

export const tasksMigrations: Migration[] = [{ id: 'tasks/0001_init', sql: init }]
