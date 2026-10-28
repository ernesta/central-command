import type { Migration } from '../../../main/db/migrate'
import init from './migrations/0001_init.sql?raw'
import twoKinds from './migrations/0002_two_kinds.sql?raw'
import itemKind from './migrations/0003_item_kind.sql?raw'
import workspace from './migrations/0004_workspace.sql?raw'
import dismissedToRead from './migrations/0005_dismissed_to_read.sql?raw'
import itemDates from './migrations/0006_item_dates.sql?raw'

export const watchMigrations: Migration[] = [
  { id: 'watch/0001_init', sql: init },
  { id: 'watch/0002_two_kinds', sql: twoKinds },
  { id: 'watch/0003_item_kind', sql: itemKind },
  { id: 'watch/0004_workspace', sql: workspace },
  { id: 'watch/0005_dismissed_to_read', sql: dismissedToRead },
  { id: 'watch/0006_item_dates', sql: itemDates }
]
