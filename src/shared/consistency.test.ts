import { describe, expect, it } from 'vitest'
import {
  learnProperNouns,
  normaliseValues,
  sentenceCaseHeading,
  sentenceCaseHeadings
} from './consistency'

const proper = learnProperNouns(['We met the Gates team and Sarah, Kathy Rastle said so.'])
const h = (t: string): string => sentenceCaseHeading(t, proper)

describe('sentenceCaseHeading', () => {
  it('lowercases ordinary words and keeps the first', () => {
    expect(h('Next Steps')).toBe('Next steps')
    expect(h('Linear Regression vs. Linear Mixed Effects Model')).toBe(
      'Linear regression vs. linear mixed effects model'
    )
  })
  it('keeps proper nouns, acronyms and words followed by a number', () => {
    expect(h('Luminos Data Analysis')).toBe('Luminos data analysis')
    expect(h('The Gates Foundation')).toBe('The Gates Foundation')
    expect(h('EGRA Data Sources Overview')).toBe('EGRA data sources overview')
    expect(h('Secondary Data Analysis – Study 1')).toBe('Secondary data analysis – Study 1')
    expect(h('PhD Year 2 Training Priorities (2026–27)')).toBe(
      'PhD year 2 training priorities (2026–27)'
    )
  })
  it('capitalises after a number prefix and a colon', () => {
    expect(h('1. Literature and the Research Landscape')).toBe(
      '1. Literature and the research landscape'
    )
    expect(h('Data: Luminos Liberia EGRA Data')).toBe('Data: Luminos Liberia EGRA data')
  })
  it('leaves link headings alone', () => {
    const t = '[World Development](https://x.org)'
    expect(h(t)).toBe(t)
  })
})

describe('sentenceCaseHeadings', () => {
  it('removes a doubled marker and all-bold headings', () => {
    expect(sentenceCaseHeadings('## ## ECLS-K:2011 Kindergarten — Fifth Grade', proper)).toBe(
      '## ECLS-K:2011 kindergarten — fifth grade'
    )
    expect(sentenceCaseHeadings('### **1. The Consensus: The "Ideal" Model**', proper)).toBe(
      '### 1. The consensus: The "ideal" model'
    )
  })
  it('keeps protected titles', () => {
    expect(sentenceCaseHeadings('### Loud and Clear', proper)).toBe('### Loud and Clear')
    expect(sentenceCaseHeadings('### Bilingual Boost', proper)).toBe('### Bilingual Boost')
  })
})

describe('normaliseValues', () => {
  it('formats statistics', () => {
    expect(normaliseValues('(d=.44)')).toBe('(*d* = 0.44)')
    expect(normaliseValues('d = -1.12')).toBe('*d* = −1.12')
    expect(normaliseValues('*d*=.3')).toBe('*d* = 0.3')
    expect(normaliseValues('ES = .40')).toBe('ES = 0.40')
    expect(normaliseValues('precision .97, recall .98')).toBe('precision 0.97, recall 0.98')
    expect(normaliseValues('about \\~40%')).toBe('about ~40%')
  })
  it('leaves code, front matter rules and other text alone', () => {
    expect(normaliseValues('`d=.44`')).toBe('`d=.44`')
    expect(normaliseValues('the end. Read d. x.5ms')).toBe('the end. Read d. x.5ms')
    expect(normaliseValues('a file.csv and 3.5')).toBe('a file.csv and 3.5')
  })
})
