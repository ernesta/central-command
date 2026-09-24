import { parse } from '@retorquere/bibtex-parser'
import { describe, expect, it } from 'vitest'
import type { ReferenceDetails } from '../shared/types'
import { buildReferenceDetails } from './reference-details'

/** Parse one BibLaTeX entry both ways, as parseBib does, and build its details. */
function details(entry: string): ReferenceDetails {
  const asStored = parse(entry, { sentenceCase: false }).entries[0]
  const sentence = parse(entry).entries[0]
  return buildReferenceDetails(asStored.type, asStored.fields, sentence.fields)
}

describe('buildReferenceDetails', () => {
  it('reads a journal article', () => {
    expect(
      details(`@article{k,
        title = {When Should You Adjust Standard Errors for Clustering?},
        author = {Abadie, Alberto}, date = {2023}, journaltitle = {The Quarterly Journal of Economics},
        volume = {138}, number = {1}, pages = {1--35}, doi = {10.1093/qje/qjac038},
        url = {https://doi.org/10.1093/qje/qjac038}, issn = {0033-5533}}`)
    ).toEqual({
      titleSentence: 'When should you adjust standard errors for clustering?',
      container: 'The Quarterly Journal of Economics',
      volume: '138',
      issue: '1',
      pages: '1–35',
      doi: '10.1093/qje/qjac038',
      url: 'https://doi.org/10.1093/qje/qjac038',
      date: '2023'
    })
  })

  it('uses Better BibTeX case protection to keep proper nouns in the sentence-case title', () => {
    const d = details(`@book{k, title = {State-Building and Multilingual Education in {{Africa}}},
      author = {Albaugh, E}, date = {2014}, publisher = {Cambridge University Press}, location = {Cambridge, England}}`)
    expect(d.titleSentence).toBe('State-building and multilingual education in Africa')
    expect(d.publisher).toBe('Cambridge University Press')
    expect(d.place).toBe('Cambridge, England')
  })

  it('keeps a subtitle capital after a colon', () => {
    expect(
      details(
        `@article{k, title = {Reading Instruction: {{What}} the Evidence Shows}, date = {2020}}`
      ).titleSentence
    ).toBe('Reading instruction: What the evidence shows')
  })

  it('reads a chapter: container in both cases, editors and pages', () => {
    const d =
      details(`@incollection{k, title = {Systematic Phonics}, booktitle = {The Alphabetic Principle and beyond: {{Surveying}} the Landscape},
      author = {Buckingham, J}, editor = {Cox, Robyn and Feez, Susan}, date = {2019}, pages = {49--67}, publisher = {PETAA}}`)
    expect(d).toMatchObject({
      container: 'The Alphabetic Principle and beyond: Surveying the Landscape',
      containerSentence: 'The alphabetic principle and beyond: Surveying the landscape',
      editors: [
        { family: 'Cox', given: 'Robyn' },
        { family: 'Feez', given: 'Susan' }
      ],
      pages: '49–67',
      publisher: 'PETAA'
    })
  })

  it('treats a report number as a report number, and the institution as publisher', () => {
    const d =
      details(`@report{k, title = {A Report}, author = {{World Bank}}, date = {2021}, institution = {World Bank},
      location = {Washington, D.C.}, number = {WPS 123}, type = {Working Paper}}`)
    expect(d).toMatchObject({
      reportNumber: 'WPS 123',
      genre: 'Working Paper',
      publisher: 'World Bank',
      institution: 'World Bank',
      place: 'Washington, D.C.'
    })
    expect(d.issue).toBeUndefined()
  })

  it('reads a thesis with its university and type', () => {
    expect(
      details(
        `@thesis{k, title = {Reading isiZulu}, author = {Land, S}, date = {2015}, type = {PhD thesis}, institution = {University of KwaZulu-Natal}}`
      )
    ).toMatchObject({ genre: 'PhD thesis', institution: 'University of KwaZulu-Natal' })
  })

  it('flags preprints, and reads software versions and full dates', () => {
    expect(
      details(`@online{k, title = {T}, date = {2025-06-12}, pubstate = {prepublished}}`)
    ).toMatchObject({
      preprint: true,
      date: '2025-06-12'
    })
    expect(
      details(`@software{k, title = {Emmeans}, date = {2026}, version = {2.0.1}}`).version
    ).toBe('2.0.1')
  })

  it('joins list-valued fields such as several publishers', () => {
    const d = details(
      `@book{k, title = {T}, date = {2020}, publisher = {First Press and Second Press}, location = {London and New York}}`
    )
    expect(d).toMatchObject({ publisher: 'First Press; Second Press', place: 'London; New York' })
  })

  it('falls back to a year field and omits everything that is missing', () => {
    expect(details(`@misc{k, title = {Bare}, year = {2001}}`)).toEqual({
      titleSentence: 'Bare',
      date: '2001'
    })
  })

  it('normalises text: whitespace collapsed, accents composed', () => {
    const d = details(
      `@article{k, title = {A   Title}, journaltitle = {Journal  of {\\"O}ther}, date = {2020}}`
    )
    expect(d.container).toBe('Journal of Ö' + 'ther')
  })
})
