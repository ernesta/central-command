/**
 * Runs `run` with dates written the way `locale` writes them (`localeDate` asks for the Mac's region, which a test cannot change:
 * Node reads it once at start). Tests use it to prove a rule does not depend on one region's date format.
 */
export function withLocale<T>(locale: string, run: () => T): T {
  const original = Date.prototype.toLocaleDateString
  Date.prototype.toLocaleDateString = function (
    this: Date,
    _locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions
  ): string {
    return original.call(this, locale, options)
  }
  try {
    return run()
  } finally {
    Date.prototype.toLocaleDateString = original
  }
}

/** The regions the date-format tests run under. */
export const TEST_LOCALES = ['en-US', 'en-GB', 'de-DE'] as const

/** More regions, for the check that no region's title is mistaken for a task the user chose. */
export const MANY_LOCALES = [
  ...TEST_LOCALES,
  'fr-FR',
  'es-ES',
  'it-IT',
  'nl-NL',
  'pt-BR',
  'sv-SE',
  'ru-RU',
  'pl-PL',
  'hu-HU',
  'ja-JP',
  'ko-KR',
  'zh-CN',
  'lt-LT'
] as const
