import { describe, expect, it } from 'vitest'
import { SKILLS, findSkill, formatHours, minutesPerSkill, skillMatches, sortSkills } from './skills'

describe('skills', () => {
  it('has the 19 skills of the Inkpath log, each with a distinct name and Inkpath spelling', () => {
    expect(SKILLS).toHaveLength(19)
    expect(new Set(SKILLS.map((s) => s.name)).size).toBe(19)
    expect(new Set(SKILLS.map((s) => s.inkpath)).size).toBe(19)
  })

  it('uses sentence case but keeps the tag upper case', () => {
    expect(findSkill('Data Management and analysis (GS)')?.name).toBe(
      'Data management and analysis (GS)'
    )
    expect(findSkill('Impact of Research (GS)')?.inkpath).toBe('Impact of Research (GS)')
  })

  it('tells the same name with different tags apart', () => {
    expect(findSkill('quantitative skills (ss)')?.tag).toBe('SS')
    expect(findSkill('Quantitative Skills (GS)')?.tag).toBe('GS')
  })

  it('does not invent a skill', () => {
    expect(findSkill('Basket weaving (GS)')).toBeNull()
  })

  it('formats hours', () => {
    expect(formatHours(90)).toBe('1:30')
    expect(formatHours(120)).toBe('2:00')
    expect(formatHours(0)).toBe('0:00')
  })

  it('counts an entry fully towards each skill, largest first, ignoring entries without minutes', () => {
    const totals = minutesPerSkill([
      { skills: ['A', 'B'], minutes: 60 },
      { skills: ['B'], minutes: 30 },
      { skills: ['A', 'A'], minutes: 15 },
      { skills: ['C'], minutes: null }
    ])
    expect(totals).toEqual([
      { skill: 'B', minutes: 90 },
      { skill: 'A', minutes: 75 }
    ])
  })

  it('sorts skills by group (General, Specialist, Research in Practice), each alphabetical, unknown last', () => {
    expect(
      sortSkills([
        'Networking (RP)',
        'Quantitative skills (SS)',
        'Zebra (Live)',
        'Quantitative skills (GS)',
        'Data management and analysis (GS)',
        'Career development (RP)'
      ])
    ).toEqual([
      'Data management and analysis (GS)',
      'Quantitative skills (GS)',
      'Quantitative skills (SS)',
      'Career development (RP)',
      'Networking (RP)',
      'Zebra (Live)'
    ])
  })

  it('matches typed text anywhere in a name, ignoring case', () => {
    const names = (q: string): string[] =>
      SKILLS.filter((s) => skillMatches(s, q)).map((s) => s.name)
    expect(names('')).toHaveLength(SKILLS.length)
    expect(names('PROP')).toEqual(['Intellectual property rights (GS)'])
    expect(names('  qua ').length).toBeGreaterThan(1)
    expect(names('zzz')).toEqual([])
  })
})
