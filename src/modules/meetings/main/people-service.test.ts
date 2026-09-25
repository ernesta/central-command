import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PeopleService } from './people-service'
import { PeopleStore } from './people-store'

const MEETING = `---
series: Supervision
attendees: [Kathy Rastle, Ernesta Orlovaitė]
---

## Previous TODOs

- [ ] **TODO(KR & EO)**: Shared

## Notes

Kathy Rastle asked KR to check TODO(KRX): no.
`
const OTHER_MEETING = `---
series: Supervision
attendees: [Ernesta Orlovaitė]
---

## Notes

TODO(EO): mine
`
const TRAINING = `---
title: Stats
leads: [Kathy Rastle]
---

## Notes

Kathy Rastle and KR.
`

let root: string
let meetingsDir: string
let trainingDir: string
let backupsDir: string
let store: PeopleStore
let service: PeopleService
let reindexed: string[]

const read = (dir: string, name: string): string => readFileSync(join(dir, name), 'utf8')

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'cc-people-service-'))
  meetingsDir = join(root, 'meetings')
  trainingDir = join(root, 'training')
  backupsDir = join(root, 'backups')
  mkdirSync(meetingsDir)
  mkdirSync(trainingDir)
  writeFileSync(join(meetingsDir, '2026-01-01 Supervision.md'), MEETING)
  writeFileSync(join(meetingsDir, '2026-01-02 Supervision.md'), OTHER_MEETING)
  writeFileSync(join(trainingDir, '2026-01-03 Stats.md'), TRAINING)
  reindexed = []
  store = new PeopleStore(join(root, 'people.json'))
  await store.add({ name: 'Ernesta Orlovaitė', me: true })
  await store.add({ name: 'Kathy Rastle' })
  await store.add({ name: 'Kathryn Rastle', initials: 'KRA' })
  await store.add({ name: 'Joanna Young' })
  service = new PeopleService({
    store,
    meetingsDir,
    trainingDir,
    backupsDir,
    indexed: () => ({
      meetings: [
        { attendees: ['Kathy Rastle', 'Ernesta Orlovaitė'], todos: [{ owners: ['KR', 'EO'] }] },
        { attendees: ['Ernesta Orlovaitė'], todos: [{ owners: ['EO'] }] }
      ],
      trainings: [{ leads: ['Kathy Rastle'] }]
    }),
    reindex: async (kind, fileName) => {
      reindexed.push(`${kind}:${fileName}`)
    },
    now: () => new Date('2026-09-25T10:00:00Z')
  })
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('PeopleService.update', () => {
  it('writes a new name and new initials into the notes, with a backup of each note first', async () => {
    const { people, report } = await service.update('Kathy Rastle', {
      name: 'Katherine Rastle',
      initials: 'KAT'
    })
    expect(people[1]).toMatchObject({ name: 'Katherine Rastle', initials: 'KAT' })
    expect(report).toEqual({ changed: 2, skipped: [] })
    expect(read(meetingsDir, '2026-01-01 Supervision.md')).toBe(
      MEETING.replace('[Kathy Rastle,', '[Katherine Rastle,').replace(
        'TODO(KR & EO)',
        'TODO(KAT & EO)'
      )
    )
    expect(read(trainingDir, '2026-01-03 Stats.md')).toBe(
      TRAINING.replace('leads: [Kathy Rastle]', 'leads: [Katherine Rastle]')
    )
    expect(reindexed).toEqual([
      'meetings:2026-01-01 Supervision.md',
      'training:2026-01-03 Stats.md'
    ])
    const [backup] = readdirSync(backupsDir)
    expect(backup).toBe('people-2026-09-25T10-00-00-000Z')
    expect(read(join(backupsDir, backup, 'meetings'), '2026-01-01 Supervision.md')).toBe(MEETING)
    expect(read(join(backupsDir, backup, 'training'), '2026-01-03 Stats.md')).toBe(TRAINING)
  })

  it('leaves notes that do not mention the person exactly as they were', async () => {
    await service.update('Kathy Rastle', { name: 'Katherine Rastle', initials: 'KAT' })
    expect(read(meetingsDir, '2026-01-02 Supervision.md')).toBe(OTHER_MEETING)
    expect(readdirSync(join(backupsDir, readdirSync(backupsDir)[0], 'meetings'))).toEqual([
      '2026-01-01 Supervision.md'
    ])
  })

  it('changes only what changed: a new name alone leaves TODO owners, initials alone leaves attendees', async () => {
    await service.update('Kathy Rastle', { initials: 'KAT' })
    const meeting = read(meetingsDir, '2026-01-01 Supervision.md')
    expect(meeting).toBe(MEETING.replace('TODO(KR & EO)', 'TODO(KAT & EO)'))
    expect(read(trainingDir, '2026-01-03 Stats.md')).toBe(TRAINING)
  })

  it('edits no note for "me", and none when the change is refused', async () => {
    const before = readFileSync(join(root, 'people.json'), 'utf8')
    const { report } = await service.update('Ernesta Orlovaitė', { me: true })
    expect(report).toEqual({ changed: 0, skipped: [] })
    await expect(service.update('Kathy Rastle', { initials: 'EO' })).rejects.toThrow('already used')
    expect(readFileSync(join(root, 'people.json'), 'utf8')).toBe(before)
    expect(read(meetingsDir, '2026-01-01 Supervision.md')).toBe(MEETING)
    expect(existsSync(backupsDir)).toBe(false)
  })
})

describe('PeopleService.remove', () => {
  it('deletes someone no note mentions, and refuses everyone else', async () => {
    const { people } = await service.remove('Joanna Young', { how: 'delete' })
    expect(people.map((p) => p.name)).not.toContain('Joanna Young')
    await expect(service.remove('Kathy Rastle', { how: 'delete' })).rejects.toThrow(
      'archive or merge'
    )
    expect(store.list().map((p) => p.name)).toContain('Kathy Rastle')
  })

  it('archives without editing any note, and restores', async () => {
    const { people, report } = await service.remove('Kathy Rastle', { how: 'archive' })
    expect(people[1].archived).toBe(true)
    expect(report).toEqual({ changed: 0, skipped: [] })
    expect(read(meetingsDir, '2026-01-01 Supervision.md')).toBe(MEETING)
    expect(existsSync(backupsDir)).toBe(false)
    expect((await service.restore('Kathy Rastle'))[1].archived).toBeUndefined()
  })

  it('merges: notes change to the other person and the merged one is removed', async () => {
    const { people, report } = await service.remove('Kathy Rastle', {
      how: 'merge',
      into: 'Kathryn Rastle'
    })
    expect(people.map((p) => p.name)).toEqual([
      'Ernesta Orlovaitė',
      'Kathryn Rastle',
      'Joanna Young'
    ])
    expect(report.changed).toBe(2)
    expect(read(meetingsDir, '2026-01-01 Supervision.md')).toBe(
      MEETING.replace('[Kathy Rastle,', '[Kathryn Rastle,').replace(
        'TODO(KR & EO)',
        'TODO(KRA & EO)'
      )
    )
    expect(read(trainingDir, '2026-01-03 Stats.md')).toBe(
      TRAINING.replace('leads: [Kathy Rastle]', 'leads: [Kathryn Rastle]')
    )
  })

  it('refuses to merge into an unknown or archived person before touching anything', async () => {
    await expect(service.remove('Kathy Rastle', { how: 'merge', into: 'Nobody' })).rejects.toThrow(
      'not in the list'
    )
    await service.remove('Kathryn Rastle', { how: 'archive' })
    await expect(
      service.remove('Kathy Rastle', { how: 'merge', into: 'Kathryn Rastle' })
    ).rejects.toThrow('archived')
    expect(read(meetingsDir, '2026-01-01 Supervision.md')).toBe(MEETING)
    expect(store.list().map((p) => p.name)).toContain('Kathy Rastle')
  })
})

describe('PeopleService.usage', () => {
  it('counts meetings (attendee or TODO owner) and trainings (lead) per person', () => {
    expect(service.usage()).toEqual([
      { name: 'Ernesta Orlovaitė', meetings: 2, trainings: 0 },
      { name: 'Kathy Rastle', meetings: 1, trainings: 1 },
      { name: 'Kathryn Rastle', meetings: 0, trainings: 0 },
      { name: 'Joanna Young', meetings: 0, trainings: 0 }
    ])
  })
})
