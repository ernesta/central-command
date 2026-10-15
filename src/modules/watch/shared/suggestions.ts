import type { WatchSuggestion } from './types'

const LL = 'https://linguistlist.org/issues/rss'

/**
 * Sources worth offering to someone doing reading and language research. Offered, never added by themselves: the
 * user picks. Feeds and journals only (a web page needs the user's own address, which they know and we do not).
 */
export const SUGGESTED_SOURCES: WatchSuggestion[] = [
  {
    title: 'LINGUIST List: conferences',
    url: `${LL}/confs`,
    kind: 'conference',
    method: 'feed',
    groupLabel: 'LINGUIST List'
  },
  {
    title: 'LINGUIST List: calls for papers',
    url: `${LL}/calls`,
    kind: 'conference',
    method: 'feed',
    groupLabel: 'LINGUIST List'
  },
  {
    title: 'LINGUIST List: summer schools',
    url: `${LL}/sum`,
    kind: 'summer-school',
    method: 'feed',
    groupLabel: 'LINGUIST List'
  },
  {
    title: 'LINGUIST List: journal contents',
    url: `${LL}/toc`,
    kind: 'journal',
    method: 'feed',
    groupLabel: 'LINGUIST List'
  },
  {
    title: 'Scientific Studies of Reading',
    url: 'https://www.tandfonline.com/journals/hssr20',
    kind: 'journal',
    method: 'crossref',
    issn: '1088-8438',
    groupLabel: 'Journals'
  },
  {
    title: 'Learning and Instruction',
    url: 'https://www.sciencedirect.com/journal/learning-and-instruction',
    kind: 'journal',
    method: 'crossref',
    issn: '0959-4752',
    groupLabel: 'Journals'
  },
  {
    title: 'Journal of Research in Reading',
    url: 'https://onlinelibrary.wiley.com/journal/14679817',
    kind: 'journal',
    method: 'crossref',
    issn: '0141-0423',
    groupLabel: 'Journals'
  },
  {
    title: 'Reading and Writing',
    url: 'https://link.springer.com/journal/11145',
    kind: 'journal',
    method: 'crossref',
    issn: '0922-4777',
    groupLabel: 'Journals'
  },
  {
    title: 'Applied Psycholinguistics',
    url: 'https://www.cambridge.org/core/journals/applied-psycholinguistics',
    kind: 'journal',
    method: 'crossref',
    issn: '0142-7164',
    groupLabel: 'Journals'
  },
  {
    title: 'Bilingualism: Language and Cognition',
    url: 'https://www.cambridge.org/core/journals/bilingualism-language-and-cognition',
    kind: 'journal',
    method: 'crossref',
    issn: '1366-7289',
    groupLabel: 'Journals'
  },
  {
    title: 'International Journal of Educational Development',
    url: 'https://www.sciencedirect.com/journal/international-journal-of-educational-development',
    kind: 'journal',
    method: 'crossref',
    issn: '0738-0593',
    groupLabel: 'Journals'
  },
  {
    title: 'World Development',
    url: 'https://www.sciencedirect.com/journal/world-development/',
    kind: 'journal',
    method: 'crossref',
    issn: '0305-750X',
    groupLabel: 'Journals'
  },
  {
    title: 'Nature Human Behaviour',
    url: 'https://www.nature.com/nathumbehav/',
    kind: 'journal',
    method: 'crossref',
    issn: '2397-3374',
    groupLabel: 'Journals'
  },
  {
    title: 'Fiscal Studies',
    url: 'https://onlinelibrary.wiley.com/journal/14755890',
    kind: 'journal',
    method: 'crossref',
    issn: '1475-5890',
    groupLabel: 'Journals'
  }
]
