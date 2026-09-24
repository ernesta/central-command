import type { Migration } from '../../../main/db/migrate'
import init from './migrations/0001_init.sql?raw'

export const meetingsMigrations: Migration[] = [{ id: 'meetings/0001_init', sql: init }]
