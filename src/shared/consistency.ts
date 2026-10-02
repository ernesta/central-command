/**
 * Consistency rules for the library's Markdown (used by `scripts/tidy-consistency.mts`, tested without files).
 *
 * - Headings are sentence case: only the first word (and the first after a colon or dash) and proper nouns, acronyms and
 *   words with their own capitals keep a capital. "Proper noun" is learned from the library itself (a word written with a
 *   capital in the middle of a sentence somewhere) plus a short list the user can extend.
 * - Statistics: an italic letter for the symbol (`*d* = 0.44`), a space either side of `=`, `<` and `>`, a true minus
 *   sign for negatives, and always a leading zero (`0.40`, never `.40`).
 */

/** Words that stay capitalised in a heading although the library never shows them mid-sentence. */
export const EXTRA_PROPER = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
  'English',
  'Luminos',
  'Crawford',
  'Azure',
  'Liberia',
  'Ghana'
]

/** Names of things that are written as titles whatever the case rule says; kept exactly as they are. */
export const PROTECTED_PHRASES = [
  'Reading First Impact Study',
  'Head Start Impact Study',
  "Nation's Report Card",
  'Nation’s Report Card',
  'UK National Pupil Database',
  'Experimental Psychology Society',
  'Gates Foundation',
  'Data Sharing Agreement',
  'Studentship Agreement'
]

/** A word before a number or a single capital letter ("Study 1", "Category A") is a label and keeps its capital. */
const LABEL =
  /^(Study|Category|Priority|Phase|Table|Figure|Chapter|Section|Aim|Part|Stage|Wave|Model|Experiment)$/

const SKIP_ALWAYS = new Set(['I'])

/**
 * Words that are proper nouns: written with a capital in the middle of a sentence somewhere and never in lowercase
 * anywhere in the library (so "Luminos" is one, but "Data" is not, because "data" is everywhere) and is not an ordinary
 * word (`isCommonWord`, given a dictionary by the script).
 */
export function learnProperNouns(
  bodies: string[],
  isCommonWord: (lowercase: string) => boolean = () => false
): Set<string> {
  const capitalised = new Set<string>()
  const lower = new Set<string>()
  for (const text of bodies) {
    let fenced = false
    for (const line of text.split('\n')) {
      if (/^\s*(```|~~~)/.test(line)) fenced = !fenced
      if (fenced) continue
      for (const m of line.matchAll(/\b[a-z][a-z’']+\b/g)) lower.add(m[0])
      if (/^#{1,6} /.test(line)) continue
      for (const m of line.matchAll(/[a-z,;] ([A-Z][a-z]+(?:[’'][a-z]+)?)\b/g))
        capitalised.add(m[1])
    }
  }
  const found = new Set<string>(EXTRA_PROPER)
  for (const w of capitalised)
    if (!lower.has(w.toLowerCase()) && !isCommonWord(w.toLowerCase())) found.add(w)
  return found
}

const WORD = /^[A-Z][a-z]+(?:[’'-][A-Za-z]+)*$/

/** One heading's text (without the `#`s) in sentence case, or the same text when nothing should change. */
export function sentenceCaseHeading(text: string, proper: Set<string>): string {
  // Links (a journal's own name), already-bold labels and bracketed things are left as they are.
  if (/\]\(|\*\*|^#/.test(text)) return text
  const tokens = text.split(/(\s+)/)
  const protectedRanges = PROTECTED_PHRASES.flatMap((phrase) => {
    const at = text.indexOf(phrase)
    return at < 0 ? [] : [[at, at + phrase.length] as const]
  })
  let offset = 0
  let capitalNext = true
  return tokens
    .map((token, i) => {
      const start = offset
      offset += token.length
      if (/^\s*$/.test(token)) return token
      const wordStart = start + (token.length - token.replace(/^[("“'‘]+/, '').length)
      if (protectedRanges.some(([a, b]) => wordStart >= a && wordStart < b)) {
        capitalNext = false
        return token
      }
      const bare = token.replace(/^[("“'‘]+/, '')
      const lead = token.slice(0, token.length - bare.length)
      const word = bare.replace(/[:;,.)?!”"’']+$/, '')
      const tail = bare.slice(word.length)
      const numbered = /^\d+\.$/.test(bare)
      let out = bare
      const next = tokens.slice(i + 1).find((t) => !/^\s*$/.test(t))
      const isLabel = LABEL.test(word) && next !== undefined && /^(\d|[A-Z][:.]?$)/.test(next)
      if (!numbered && !isLabel && WORD.test(word) && !SKIP_ALWAYS.has(word)) {
        const parts = word.split(/(-)/)
        const lowered = parts
          .map((p, k) =>
            p === '-' || proper.has(p) || (k === 0 && capitalNext) ? p : p.toLowerCase()
          )
          .join('')
        out = lowered + tail
      }
      // the next word is a sentence start after a number prefix, a colon, a dash or a closing question
      capitalNext = numbered || /[:?!]$/.test(bare) || bare === '–' || bare === '—' || bare === '-'
      return lead + out
    })
    .join('')
}

export function sentenceCaseHeadings(text: string, proper: Set<string>): string {
  let fenced = false
  return text
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) fenced = !fenced
      if (fenced) return line
      const m = /^(#{1,6} )(.*)$/.exec(line)
      return m ? m[1] + sentenceCaseHeading(m[2], proper) : line
    })
    .join('\n')
}

function mapOutsideCode(text: string, fn: (segment: string) => string): string {
  let fenced = false
  return text
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) fenced = !fenced
      if (fenced || /^---\s*$/.test(line)) return line
      return line
        .split(/(`[^`]*`)/)
        .map((part, i) => (i % 2 === 1 ? part : fn(part)))
        .join('')
    })
    .join('\n')
}

const SYMBOL = /(^|[\s([;])(d|g|r|p|t|F|M|N|n|SD)(\s*)(=|<|>|≤|≥)(\s*)([−–-]?)(\d*\.\d+|\d+)/g

/** Italic symbols, spaced operators, true minus and a leading zero, in statistics such as `d=.44`. */
export function normaliseValues(text: string): string {
  return mapOutsideCode(text, (s) => {
    let out = s.replace(
      SYMBOL,
      (_m, pre, sym, _s1, op, _s2, sign, value) =>
        `${pre}*${sym}* ${op} ${sign ? '−' : ''}${value.startsWith('.') ? `0${value}` : value}`
    )
    // a symbol that is already italic: *d*=.44, *d* = .44
    out = out.replace(
      /\*(d|g|r|p|t|F|M|N|n|SD)\*(\s*)(=|<|>|≤|≥)(\s*)([−–-]?)(\d*\.\d+|\d+)/g,
      (_m, sym, _s1, op, _s2, sign, value) =>
        `*${sym}* ${op} ${sign ? '−' : ''}${value.startsWith('.') ? `0${value}` : value}`
    )
    // effect sizes and similar upright symbols: ES = .40
    out = out.replace(
      /\b(ES|SMD|OR)(\s*)=(\s*)([−–-]?)(\d*\.\d+|\d+)/g,
      (_m, sym, _a, _b, sign, value) =>
        `${sym} = ${sign ? '−' : ''}${value.startsWith('.') ? `0${value}` : value}`
    )
    // a bare decimal without its zero after a word: "precision .97"
    out = out.replace(/(^|[\s(])(\.\d+)(?!\d|\.\d)/g, (_m, pre, v) => `${pre}0${v}`)
    // a stray escape left by the old editor
    return out.replace(/\\~/g, '~')
  })
}
