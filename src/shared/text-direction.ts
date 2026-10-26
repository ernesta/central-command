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
