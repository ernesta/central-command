import { describe, expect, it } from 'vitest'
import { sectionOf, type WatchSection } from './types'

const JACOBS_SUMMARY =
  'Six-month fellowship for early-career researchers in child learning and development; CHF 5,000 stipend.'

const table: [string, string, WatchSection][] = [
  // Opportunities
  ['BOLD Science Communication Fellowship', JACOBS_SUMMARY, 'opportunity'],
  ['Calls: Special Issue on L2 Reading (Jrnl)', '', 'opportunity'],
  ['Calls: Thematic dossier on multilingual literacy', '', 'opportunity'],
  ['Calls: Reading and writing in two languages (Jrnl)', '', 'opportunity'],
  [
    'Calls: Journal of Experimental Pragmatics',
    'Now live. We invite you to submit.',
    'opportunity'
  ],
  ['PhD funding at the University of Essex', '', 'opportunity'],
  ['Doctoral Scholarship in Reading', '', 'opportunity'],
  ['Travel bursary for early-career researchers', '', 'opportunity'],
  ['Research Grants 2027', '', 'opportunity'],
  ['Early Career Award', '', 'opportunity'],
  ['Call for applications: Visiting Researcher', '', 'opportunity'],
  ['Postdoctoral programme', 'Open to all. Apply by 5 November 2026.', 'opportunity'],
  ['A programme', 'A six-month stipend is paid.', 'opportunity'],
  // Trainings
  ['Confs: Summer School in Corpus Linguistics 2027', '', 'training'],
  ['Summer schools', '', 'training'],
  ['Webinar: Open science for reading research', '', 'training'],
  ['Secondary CPD: Developing literacy', '', 'training'],
  ['Masterclass with a guest speaker', '', 'training'],
  ['Introduction to R: a two-day course', '', 'training'],
  ['Training in multilevel models', '', 'training'],
  // Conferences
  ['Confs: Munich Inner Speech Workshop', '', 'conference'],
  ['Confs: Workshop at SLE 2027 – Non-Finite Verb Forms', '', 'conference'],
  ['Confs: Summer School in Corpus Linguistics 2027 and workshop', '', 'training'],
  ['Reconstructing Reading 2026', '', 'conference'],
  ['Confs: Symposium on Bilingualism, Lancaster', '', 'conference'],
  ['SSSR Thirty-Fourth Annual Conference', '', 'conference'],
  // A summer school that asks for applications is still an event, not an opportunity
  ['Summer school in statistics. Apply by 1 March 2027', '', 'training'],
  // A conference that mentions travel grants in passing stays a conference
  ['LREC 2027', 'Travel grants and awards are available for students.', 'conference'],
  ['Annual conference on reading', 'Scholarships will be announced.', 'conference'],
  // The one conflict: a workshop that is a call for papers is a conference
  ['Workshop at SLE 2027: call for papers', '', 'conference'],
  ['Workshop on reading', 'Call for papers: abstracts due 1 March 2027.', 'conference'],
  ['Workshop on reading', 'Hands-on session for students.', 'training']
]

describe('sectionOf with a training source', () => {
  it.each([
    [
      'Preparing a Conference Submission in Management',
      'WRDTP: Training and events calendar',
      'training'
    ],
    ['Race and Diversity in Digital Media', 'WRDTP: Training and events calendar', 'training'],
    ['Computing on the National Research Platform', 'UCLA IDRE: Calendar', 'training'],
    [
      'Doctoral Open Day: Music, Sound and Vision',
      'Royal Holloway Doctoral School: PGR events',
      'training'
    ],
    [
      'ADR Funded Training: Good Practice for R Users',
      'Royal Holloway Doctoral School: PGR events',
      'training'
    ],
    ['Research Grants 2027', 'WRDTP: Training and events calendar', 'opportunity'],
    ['Reconstructing Reading 2026', 'National Literacy Trust', 'conference'],
    ['Confs: Munich Inner Speech Workshop', 'LINGUIST List: Summer schools', 'conference']
  ])('%s from %s → %s', (title, source, expected) => {
    expect(sectionOf(title, '', source)).toBe(expected)
  })
})

describe('sectionOf', () => {
  it.each(table)('%s → %s', (title, summary, expected) => {
    expect(sectionOf(title, summary)).toBe(expected)
  })

  it.each([
    ['ADR Funded Training: Good Practice for R Users', 'training'],
    ['Introduction to Survival Analysis in R', 'training'],
    ['Getting Started with the British Library for Postgraduate Researchers', 'training'],
    ['Survey data drop-in', 'training'],
    ['Learn prompt engineering using LLMs', 'training'],
    ['Funded PhD studentship in linguistics', 'opportunity']
  ] as const)('%s → %s', (title, expected) => {
    expect(sectionOf(title)).toBe(expected)
  })

  it('sorts a title with no summary', () => {
    expect(sectionOf('Fellowship')).toBe('opportunity')
  })
})
