import type { Migration } from '../../../main/db/migrate'
import init from './migrations/0001_init.sql?raw'
import topicCount from './migrations/0002_topic_count.sql?raw'
import skills from './migrations/0003_skills.sql?raw'

export const meetingsMigrations: Migration[] = [
  { id: 'meetings/0001_init', sql: init },
  { id: 'meetings/0002_topic_count', sql: topicCount },
  { id: 'meetings/0003_skills', sql: skills }
]
