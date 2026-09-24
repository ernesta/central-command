import { mkdirSync } from 'fs'
import { dirname } from 'path'
import Database from 'better-sqlite3'

export function openDatabase(file: string): Database.Database {
  mkdirSync(dirname(file), { recursive: true })
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return db
}
