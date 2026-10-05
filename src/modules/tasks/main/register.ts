import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import type { MainContext, MainModule } from '../../main-registry'
import { tasksMigrations } from './migrations'
import { countAllTasks } from './repository'
import { writeTasksSnapshot } from './snapshot'

/** One readable copy of the tasks per day, taken when the app starts (nothing is written while there are no tasks). */
function snapshotOncePerDay({ db, paths }: MainContext): void {
  if (countAllTasks(db) === 0) return
  const dir = join(paths.root, 'backups', 'tasks')
  const day = new Date().toISOString().slice(0, 10)
  if (existsSync(dir) && readdirSync(dir).some((f) => f.startsWith(`tasks-${day}`))) return
  writeTasksSnapshot(db, dir)
}

function register(context: MainContext): void {
  try {
    snapshotOncePerDay(context)
  } catch (error) {
    console.error('Could not take the daily tasks snapshot:', error)
  }
}

export const tasksMainModule: MainModule = {
  id: 'tasks',
  migrations: tasksMigrations,
  register
}
