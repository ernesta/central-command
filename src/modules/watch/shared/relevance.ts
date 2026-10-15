/** What the user reads about, used until they set their own. Short phrases; matching ignores case and needs whole words. */
export const DEFAULT_KEYWORDS = [
  'reading acquisition',
  'literacy',
  'language of instruction',
  'multilingual',
  'diglossia',
  'early grade reading',
  'sub-saharan africa',
  'orthography',
  'bilingual education',
  'reading development'
] as const

export interface Relevance {
  score: number
  matched: string[]
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A keyword matches as a whole word or phrase, and a trailing "s" does not matter ("readings", "multilinguals"). */
function matcher(term: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escape(term.trim())}s?(?![\\p{L}\\p{N}])`, 'iu')
}

/** A title match counts 3, a match in the summary 1; each keyword counts once per place. */
export function scoreText(title: string, summary: string, keywords: readonly string[]): Relevance {
  let score = 0
  const matched: string[] = []
  for (const term of keywords) {
    if (!term.trim()) continue
    const re = matcher(term)
    const inTitle = re.test(title)
    const inSummary = re.test(summary)
    if (!inTitle && !inSummary) continue
    score += (inTitle ? 3 : 0) + (inSummary ? 1 : 0)
    matched.push(term.trim().toLowerCase())
  }
  return { score, matched }
}
