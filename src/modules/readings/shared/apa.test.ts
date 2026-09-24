import { describe, expect, it } from 'vitest'
import { formatApa, initials, type ApaInput } from './apa'
import type { Author, ReferenceDetails } from './types'

const person = (family: string, given?: string): Author => (given ? { family, given } : { family })

function apa(
  overrides: Partial<ApaInput> & { reference?: Partial<ReferenceDetails> | null }
): ReturnType<typeof formatApa> {
  const { reference, ...rest } = overrides
  return formatApa({
    authors: [],
    year: 2020,
    fullTitle: 'A Title',
    entryType: 'misc',
    reference: reference === null ? null : { titleSentence: 'A title', ...reference },
    ...rest
  })
}

describe('initials', () => {
  it.each([
    ['Guido W', 'G. W.'],
    ['David M.', 'D. M.'],
    ['Jean-Paul', 'J.-P.'],
    ['Min-jun', 'M.-J.'],
    ['J.K.', 'J. K.'],
    ['ashish', 'A.'],
    ['Alison Jane', 'A. J.'],
    ['Éva', 'É.']
  ])('%s -> %s', (given, expected) => expect(initials(given)).toBe(expected))
})

describe('journal articles', () => {
  const article = {
    entryType: 'article',
    authors: [
      person('Abadie', 'Alberto'),
      person('Athey', 'Susan'),
      person('Imbens', 'Guido W'),
      person('Wooldridge', 'Jeffrey M')
    ],
    year: 2023,
    reference: {
      titleSentence: 'When should you adjust standard errors for clustering?',
      container: 'The Quarterly Journal of Economics',
      volume: '138',
      issue: '1',
      pages: '1–35',
      doi: '10.1093/qje/qjac038'
    }
  }

  it('formats a full article reference', () => {
    expect(apa(article).text).toBe(
      'Abadie, A., Athey, S., Imbens, G. W., & Wooldridge, J. M. (2023). When should you adjust standard errors for clustering? The Quarterly Journal of Economics, 138(1), 1–35. https://doi.org/10.1093/qje/qjac038'
    )
  })

  it('italicises the journal and volume, but not the issue', () => {
    expect(apa(article).html).toBe(
      'Abadie, A., Athey, S., Imbens, G. W., &amp; Wooldridge, J. M. (2023). When should you adjust standard errors for clustering? <i>The Quarterly Journal of Economics, 138</i>(1), 1–35. https://doi.org/10.1093/qje/qjac038'
    )
  })

  it('handles one author, and two authors with a comma before the ampersand', () => {
    expect(apa({ ...article, authors: [person('Abadie', 'Alberto')] }).text).toMatch(
      /^Abadie, A\. \(2023\)\. /
    )
    expect(
      apa({ ...article, authors: [person('Smith', 'Jane'), person('Lee', 'Min-jun')] }).text
    ).toMatch(/^Smith, J., & Lee, M\.-J\. \(2023\)\. /)
  })

  it('normalises DOIs given as URLs or with a prefix', () => {
    expect(
      apa({ ...article, reference: { ...article.reference, doi: 'https://doi.org/10.1/x' } }).text
    ).toMatch(/ https:\/\/doi\.org\/10\.1\/x$/)
    expect(
      apa({ ...article, reference: { ...article.reference, doi: 'doi: 10.1/x' } }).text
    ).toMatch(/ https:\/\/doi\.org\/10\.1\/x$/)
  })

  it('falls back to the URL when there is no DOI', () => {
    expect(
      apa({
        ...article,
        reference: { ...article.reference, doi: undefined, url: 'https://example.org/a' }
      }).text
    ).toMatch(/ https:\/\/example\.org\/a$/)
  })

  it('uses an en dash for page ranges however they were typed', () => {
    for (const pages of ['1-35', '1--35', '1 - 35', '1–35']) {
      expect(apa({ ...article, reference: { ...article.reference, pages } }).text).toContain(
        ', 1–35. '
      )
    }
  })

  it('handles a missing volume, issue, pages and DOI gracefully', () => {
    expect(apa({ ...article, reference: { titleSentence: 'T', container: 'Journal' } }).text).toBe(
      'Abadie, A., Athey, S., Imbens, G. W., & Wooldridge, J. M. (2023). T. Journal.'
    )
    expect(
      apa({ ...article, reference: { titleSentence: 'T', container: 'Journal', volume: '5' } }).text
    ).toContain(' Journal, 5.')
  })

  it('uses an article number when there are no pages', () => {
    expect(
      apa({
        ...article,
        reference: {
          titleSentence: 'T',
          container: 'PLOS ONE',
          volume: '9',
          issue: '2',
          articleNumber: 'e123'
        }
      }).text
    ).toBe(
      'Abadie, A., Athey, S., Imbens, G. W., & Wooldridge, J. M. (2023). T. PLOS ONE, 9(2), Article e123.'
    )
  })

  it('does not add a full stop after a title that ends with a question mark or exclamation', () => {
    expect(
      apa({ ...article, reference: { ...article.reference, titleSentence: 'Really!' } }).text
    ).toContain('(2023). Really! The ')
  })

  it('writes (n.d.) when there is no year', () => {
    expect(apa({ ...article, year: null }).text).toContain('(n.d.).')
  })

  it('abridges 21 or more authors: first 19, an ellipsis, then the last', () => {
    const many = Array.from({ length: 22 }, (_, n) => person(`Author${n + 1}`, 'X'))
    const text = apa({ ...article, authors: many }).text
    expect(text.startsWith('Author1, X., Author2, X.')).toBe(true)
    expect(text).toContain('Author19, X., . . . Author22, X. (2023).')
    expect(text).not.toContain('Author20')
  })

  it('lists exactly 20 authors in full', () => {
    const twenty = Array.from({ length: 20 }, (_, n) => person(`A${n + 1}`, 'X'))
    expect(apa({ ...article, authors: twenty }).text).toContain('A19, X., & A20, X. (2023).')
  })

  it('leads with the title when there is no author or editor', () => {
    expect(apa({ ...article, authors: [] }).text).toBe(
      'When should you adjust standard errors for clustering? (2023). The Quarterly Journal of Economics, 138(1), 1–35. https://doi.org/10.1093/qje/qjac038'
    )
  })

  it('treats an article with no journal as a general work', () => {
    expect(apa({ ...article, reference: { titleSentence: 'Loose', doi: '10.1/y' } }).text).toBe(
      'Abadie, A., Athey, S., Imbens, G. W., & Wooldridge, J. M. (2023). Loose. https://doi.org/10.1/y'
    )
  })
})

describe('books and chapters', () => {
  it('formats a book: italic title, publisher, no location', () => {
    const r = apa({
      entryType: 'book',
      authors: [person('Albaugh', 'Ericka A.')],
      year: 2014,
      reference: {
        titleSentence: 'State-building and multilingual education in Africa',
        publisher: 'Cambridge University Press',
        place: 'Cambridge, England'
      }
    })
    expect(r.text).toBe(
      'Albaugh, E. A. (2014). State-building and multilingual education in Africa. Cambridge University Press.'
    )
    expect(r.html).toBe(
      'Albaugh, E. A. (2014). <i>State-building and multilingual education in Africa</i>. Cambridge University Press.'
    )
  })

  it.each([
    ['2', ' (2nd ed.)'],
    ['3', ' (3rd ed.)'],
    ['11', ' (11th ed.)'],
    ['22', ' (22nd ed.)'],
    ['1', ''],
    ['Revised', ' (Revised ed.)']
  ])('marks edition %s', (edition, label) => {
    expect(
      apa({
        entryType: 'book',
        authors: [person('A', 'B')],
        reference: { titleSentence: 'T', edition, publisher: 'P' }
      }).text
    ).toBe(`A, B. (2020). T${label}. P.`)
  })

  it('formats a chapter with editors, container title, pages and publisher', () => {
    const r = apa({
      entryType: 'incollection',
      authors: [
        person('Buckingham', 'Jennifer'),
        person('Wheldall', 'Robyn'),
        person('Wheldall', 'Kevin')
      ],
      year: 2019,
      reference: {
        titleSentence:
          'Systematic and explicit phonics instruction: A scientific, evidence-based approach',
        containerSentence: 'The alphabetic principle and beyond: Surveying the landscape',
        editors: [person('Cox', 'Robyn'), person('Feez', 'Susan'), person('Beveridge', 'Lorraine')],
        pages: '49–67',
        publisher: 'Primary English Teaching Association Australia'
      }
    })
    expect(r.text).toBe(
      'Buckingham, J., Wheldall, R., & Wheldall, K. (2019). Systematic and explicit phonics instruction: A scientific, evidence-based approach. In R. Cox, S. Feez, & L. Beveridge (Eds.), The alphabetic principle and beyond: Surveying the landscape (pp. 49–67). Primary English Teaching Association Australia.'
    )
    expect(r.html).toContain(
      '(Eds.), <i>The alphabetic principle and beyond: Surveying the landscape</i> (pp. 49–67).'
    )
  })

  it('formats one and two editors', () => {
    const chapter = (editors: Author[]): string =>
      apa({
        entryType: 'incollection',
        authors: [person('A', 'B')],
        reference: { titleSentence: 'T', containerSentence: 'Book', editors }
      }).text
    expect(chapter([person('Cox', 'Robyn')])).toContain('In R. Cox (Ed.), Book.')
    expect(chapter([person('Cox', 'Robyn'), person('Feez', 'Susan')])).toContain(
      'In R. Cox & S. Feez (Eds.), Book.'
    )
  })

  it('formats a chapter without editors', () => {
    expect(
      apa({
        entryType: 'incollection',
        authors: [person('A', 'B')],
        reference: { titleSentence: 'T', containerSentence: 'Book', pages: '1–9' }
      }).text
    ).toBe('A, B. (2020). T. In Book (pp. 1–9).')
  })

  it('credits editors as authors when a book has none', () => {
    const r = apa({
      entryType: 'book',
      year: 2026,
      reference: {
        titleSentence: 'Ethnologue: Languages of the world',
        editors: [
          person('Eberhard', 'David M.'),
          person('Simons', 'Gary F.'),
          person('Robinson', 'Alison J.')
        ],
        publisher: 'SIL International'
      }
    })
    expect(r.text).toBe(
      'Eberhard, D. M., Simons, G. F., & Robinson, A. J. (Eds.). (2026). Ethnologue: Languages of the world. SIL International.'
    )
    expect(
      apa({
        entryType: 'book',
        reference: { titleSentence: 'T', editors: [person('Baron', 'Caitlin')] }
      }).text
    ).toBe('Baron, C. (Ed.). (2020). T.')
  })

  it('leads with the italic title when a book has no credited person', () => {
    const r = apa({
      entryType: 'book',
      year: 2019,
      reference: { titleSentence: 'An anonymous handbook', publisher: 'P' }
    })
    expect(r.text).toBe('An anonymous handbook. (2019). P.')
    expect(r.html).toBe('<i>An anonymous handbook</i>. (2019). P.')
  })
})

describe('reports, theses, datasets, software, web and proceedings', () => {
  it('formats a report by a group author, dropping the publisher when it is the author', () => {
    const r = apa({
      entryType: 'report',
      authors: [{ literal: 'World Bank' }],
      year: 2021,
      reference: {
        titleSentence: 'The state of global learning poverty',
        publisher: 'World Bank',
        institution: 'World Bank',
        url: 'https://example.org/r'
      }
    })
    expect(r.text).toBe(
      'World Bank. (2021). The state of global learning poverty. https://example.org/r'
    )
    expect(r.html).toBe(
      'World Bank. (2021). <i>The state of global learning poverty</i>. https://example.org/r'
    )
  })

  it('keeps the publisher of a report when it differs from the author', () => {
    expect(
      apa({
        entryType: 'report',
        authors: [person('Smith', 'Jane')],
        reference: { titleSentence: 'T', publisher: 'World Bank', url: 'https://x.org' }
      }).text
    ).toBe('Smith, J. (2020). T. World Bank. https://x.org')
  })

  it('numbers a report and uses its type', () => {
    expect(
      apa({
        entryType: 'report',
        authors: [person('A', 'B')],
        reference: { titleSentence: 'T', reportNumber: '123', publisher: 'P' }
      }).text
    ).toBe('A, B. (2020). T (Report No. 123). P.')
    expect(
      apa({
        entryType: 'report',
        authors: [person('A', 'B')],
        reference: {
          titleSentence: 'T',
          reportNumber: 'WPS 9',
          genre: 'Working Paper',
          publisher: 'P'
        }
      }).text
    ).toBe('A, B. (2020). T (Working Paper No. WPS 9). P.')
  })

  it('formats a thesis with its type and university', () => {
    const r = apa({
      entryType: 'thesis',
      authors: [person('Land', 'Sandra Jane')],
      year: 2015,
      reference: {
        titleSentence: 'Reading isiZulu',
        genre: 'PhD thesis',
        institution: 'University of KwaZulu-Natal',
        url: 'http://hdl.handle.net/10413/14117'
      }
    })
    expect(r.text).toBe(
      'Land, S. J. (2015). Reading isiZulu [Doctoral dissertation, University of KwaZulu-Natal]. http://hdl.handle.net/10413/14117'
    )
    expect(
      apa({
        entryType: 'thesis',
        authors: [person('A', 'B')],
        reference: { titleSentence: 'T', genre: "Master's thesis", institution: 'U' }
      }).text
    ).toBe('A, B. (2020). T [Master’s thesis, U].')
  })

  it('formats a dataset and software with versions and descriptors', () => {
    expect(
      apa({
        entryType: 'dataset',
        authors: [{ literal: 'UNICEF' }, { literal: 'Ghana Statistical Service' }],
        year: 2018,
        reference: {
          titleSentence: 'Ghana multiple indicator cluster survey 2017-2018',
          publisher: 'UNICEF MICS',
          url: 'https://mics.unicef.org/surveys'
        }
      }).text
    ).toBe(
      'UNICEF, & Ghana Statistical Service. (2018). Ghana multiple indicator cluster survey 2017-2018 [Data set]. UNICEF MICS. https://mics.unicef.org/surveys'
    )
    expect(
      apa({
        entryType: 'software',
        authors: [person('Lenth', 'Russell V.')],
        year: 2026,
        reference: { titleSentence: 'Emmeans', version: 'v2.0.1', url: 'https://r.org' }
      }).text
    ).toBe('Lenth, R. V. (2026). Emmeans (Version 2.0.1) [Computer software]. https://r.org')
  })

  it('formats a preprint or web page: italic title and a link', () => {
    const r = apa({
      entryType: 'online',
      authors: [person('Cayado', 'Dave Kenneth Tayao'), person('Rastle', 'Kathleen')],
      year: 2025,
      reference: {
        titleSentence: 'The cost of a narrow lens',
        doi: '10.31234/osf.io/edgwy_v1',
        preprint: true
      }
    })
    expect(r.text).toBe(
      'Cayado, D. K. T., & Rastle, K. (2025). The cost of a narrow lens. https://doi.org/10.31234/osf.io/edgwy_v1'
    )
  })

  it('gives web pages a full date when the export has one', () => {
    expect(
      apa({
        entryType: 'online',
        authors: [person('Doe', 'Jane')],
        year: 2025,
        reference: { titleSentence: 'Post', date: '2025-06-12', url: 'https://x.org' }
      }).text
    ).toBe('Doe, J. (2025, June 12). Post. https://x.org')
    expect(
      apa({
        entryType: 'online',
        authors: [person('Doe', 'Jane')],
        year: 2025,
        reference: { titleSentence: 'Post', date: '2025-06', url: 'https://x.org' }
      }).text
    ).toBe('Doe, J. (2025, June). Post. https://x.org')
  })

  it('formats a conference paper', () => {
    expect(
      apa({
        entryType: 'inproceedings',
        authors: [person('Awopetu', 'Anna V.')],
        year: 2016,
        reference: {
          titleSentence: 'Impact of mother tongue on learning',
          container: 'Procedia Social and Behavioral Sciences',
          volume: '233',
          pages: '58–63',
          doi: '10.1016/j.sbspro.2016.10.131'
        }
      }).html
    ).toBe(
      'Awopetu, A. V. (2016). Impact of mother tongue on learning. In <i>Procedia Social and Behavioral Sciences</i> (Vol. 233, pp. 58–63). https://doi.org/10.1016/j.sbspro.2016.10.131'
    )
  })

  it('handles an unrecognised entry type with the general pattern', () => {
    expect(
      apa({
        entryType: 'misc',
        authors: [person('A', 'B')],
        reference: { titleSentence: 'Thing', publisher: 'P', url: 'https://u.org' }
      }).text
    ).toBe('A, B. (2020). Thing. P. https://u.org')
  })
})

describe('robustness', () => {
  it('works for a reading that has no reference details yet (before the first sync after upgrade)', () => {
    const r = apa({
      entryType: 'article',
      authors: [person('A', 'B')],
      fullTitle: 'Plain Title',
      reference: null
    })
    expect(r.text).toBe('A, B. (2020). Plain Title.')
  })

  it('escapes HTML in the html form only', () => {
    const r = apa({
      entryType: 'book',
      authors: [person('A', 'B')],
      reference: { titleSentence: 'Cats <&> dogs', publisher: 'R&D Press' }
    })
    expect(r.html).toBe('A, B. (2020). <i>Cats &lt;&amp;&gt; dogs</i>. R&amp;D Press.')
    expect(r.text).toBe('A, B. (2020). Cats <&> dogs. R&D Press.')
  })

  it('has no doubled spaces or stray punctuation in any of the outputs', () => {
    const outputs = [
      apa({
        entryType: 'article',
        authors: [person('A', 'B')],
        reference: { titleSentence: 'T', container: 'J' }
      }),
      apa({ entryType: 'book', reference: { titleSentence: 'T' } }),
      apa({ entryType: 'report', authors: [person('A', 'B')], reference: { titleSentence: 'T' } }),
      apa({ entryType: 'online', reference: { titleSentence: 'T' }, year: null })
    ]
    for (const { text } of outputs) {
      expect(text).not.toMatch(/ {2}| \.|\.\.|,\./)
      expect(text).toBe(text.trim())
    }
  })
})
