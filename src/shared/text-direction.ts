/** Letters of the right-to-left scripts: Hebrew, Arabic (Urdu, Persian), Syriac, Thaana, N'Ko and the Arabic presentation forms. */
const RTL_LETTER = new RegExp('[\\u0590-\\u08FF\\uFB1D-\\uFDFF\\uFE70-\\uFEFC]')
const LTR_LETTER = /\p{L}/u

/**
 * The direction of a piece of text by its first strong letter (what `dir="auto"` does), or `null` when it has none
 * (digits, punctuation, Markdown markers, a blank line).
 */
export function textDirection(text: string): 'ltr' | 'rtl' | null {
  for (const char of text) {
    if (RTL_LETTER.test(char)) return 'rtl'
    if (LTR_LETTER.test(char)) return 'ltr'
  }
  return null
}

/** One Arabic-script letter, digit or mark (Arabic, Urdu, Persian: the blocks that hold them and the presentation forms). */
const ARABIC = '[\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF]'
/** A run of Arabic-script text: spaces and punctuation between two such characters belong to it, so "چھ ۶" is one run. */
const ARABIC_RUN = new RegExp(
  `${ARABIC}+(?:(?:[\\s\\u00A0.,:;!?()\\u060C\\u061B\\u061F\\-\\u2013\\u2014]|\\u200C|\\u200D)+${ARABIC}+)*`,
  'g'
)

export function hasArabicScript(text: string): boolean {
  return new RegExp(ARABIC).test(text)
}

/** The ranges of Arabic-script text in `text` (what `lang="ur"` is put on). */
export function arabicScriptRuns(text: string): { from: number; to: number }[] {
  return [...text.matchAll(ARABIC_RUN)].map((m) => ({ from: m.index, to: m.index + m[0].length }))
}
