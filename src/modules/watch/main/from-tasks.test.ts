import { describe, expect, it } from 'vitest'
import { kindOfReminder, sourcesFromTasks } from './from-tasks'

const tasks = [
  {
    uid: 'u1',
    title: 'Check upcoming conferences',
    description: '- https://eps.ac.uk/future-meetings/\n- https://www.triplesr.org/'
  },
  {
    uid: 'u2',
    title: 'Check upcoming external trainings',
    description:
      '- https://wrdtp.ac.uk/training/training-and-events-calendar/\n- https://essexuniversity.app.box.com/s/abc (or consider https://open.hpi.de/learn/qc-qiskit2022 and https://open.hpi.de/learn/x).\n- https://intranet.royalholloway.ac.uk/doctoral-school/news-events/home.aspx'
  },
  {
    uid: 'u3',
    title: 'Check upcoming internal trainings',
    description: '- Researcher Development Programme\n- SEDarc (Inkpath)'
  },
  { uid: 'u4', title: 'Sign up for experiments', description: '- https://example.org/not-a-check' },
  {
    uid: 'u6',
    title: 'Check if Harm talks about attention',
    description: 'Re: supervisor meeting'
  },
  {
    uid: 'u5',
    title: 'Check upcoming summer schools',
    description: '- https://eps.ac.uk/future-meetings/'
  }
]

describe('sourcesFromTasks', () => {
  const r = sourcesFromTasks(tasks)

  it('makes a page source of each readable address, under the reminder it came from', () => {
    expect(r.sources.map((s) => [s.url, s.kind, s.groupLabel, s.taskUid])).toEqual([
      ['https://eps.ac.uk/future-meetings/', 'conference', 'Check upcoming conferences', 'u1'],
      ['https://www.triplesr.org/', 'conference', 'Check upcoming conferences', 'u1'],
      [
        'https://wrdtp.ac.uk/training/training-and-events-calendar/',
        'training',
        'Check upcoming external trainings',
        'u2'
      ],
      [
        'https://open.hpi.de/learn/qc-qiskit2022',
        'training',
        'Check upcoming external trainings',
        'u2'
      ],
      ['https://open.hpi.de/learn/x', 'training', 'Check upcoming external trainings', 'u2']
    ])
    expect(r.sources.every((s) => s.method === 'page')).toBe(true)
  })

  it('lists addresses it cannot read, and places named without an address', () => {
    expect(r.byHand.map((b) => b.line)).toEqual([
      'https://essexuniversity.app.box.com/s/abc',
      'https://intranet.royalholloway.ac.uk/doctoral-school/news-events/home.aspx'
    ])
    expect(r.noAddress.map((n) => n.line)).toEqual([
      'Researcher Development Programme',
      'SEDarc (Inkpath)'
    ])
  })

  it('reads only "Check upcoming …" reminders and lists an address once', () => {
    expect(r.sources.some((s) => s.url.includes('not-a-check'))).toBe(false)
    expect(r.sources.filter((s) => s.url === 'https://eps.ac.uk/future-meetings/')).toHaveLength(1)
  })

  it('names the kind from the title', () => {
    expect(kindOfReminder('Check upcoming summer schools')).toBe('summer-school')
    expect(kindOfReminder('Check the weather')).toBe('other')
  })
})
