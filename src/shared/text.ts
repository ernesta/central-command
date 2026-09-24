/** Letters NFD does not decompose into base + accent. */
const EXTRA_FOLDS: Record<string, string> = { ł: 'l', ø: 'o', đ: 'd', ß: 'ss', æ: 'ae', œ: 'oe' }

/** Lowercase, strip accents: "Müller" and "muller" compare equal. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[łøđßæœ]/g, (c) => EXTRA_FOLDS[c])
}
