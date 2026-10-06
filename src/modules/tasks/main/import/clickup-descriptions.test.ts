import { describe, expect, it } from 'vitest'
import {
  planDescriptionBackfill,
  tidyClickupMarkdown,
  type StoredTask
} from './clickup-descriptions'

/** The real embed from "Check for new articles in Kathy's reading list" (task 86c8jv8pm). */
const KATHY_URL =
  'https://docs.google.com/document/d/1qUKtsW6iTTbF3wZe10rr6PIdRA7M75Z-v3aQGBWjvaE/edit?tab=t.0'
const KATHY_EMBED = `[\n\ndocs.google.com\n\n${KATHY_URL}\n\n](${KATHY_URL})`

describe('tidyClickupMarkdown', () => {
  it('turns the real link embed into the bare URL', () => {
    expect(tidyClickupMarkdown(KATHY_EMBED)).toBe(KATHY_URL)
  })

  it('drops a label that only repeats the URL, the domain, or both', () => {
    expect(tidyClickupMarkdown(`[${KATHY_URL}](${KATHY_URL})`)).toBe(KATHY_URL)
    expect(tidyClickupMarkdown('[example.com](https://example.com/a)')).toBe(
      'https://example.com/a'
    )
    expect(tidyClickupMarkdown('[www.example.com](https://example.com/a)')).toBe(
      'https://example.com/a'
    )
    expect(tidyClickupMarkdown('[](https://example.com/a)')).toBe('https://example.com/a')
  })

  it('drops a label holding a URL ClickUp truncated with an ellipsis', () => {
    expect(
      tidyClickupMarkdown('[https://example.com/very…](https://example.com/very-long-path)')
    ).toBe('https://example.com/very-long-path')
  })

  it('keeps a label that says something the URL does not', () => {
    expect(tidyClickupMarkdown('[Kathy’s reading list](https://example.com/a)')).toBe(
      '[Kathy’s reading list](https://example.com/a)'
    )
    expect(tidyClickupMarkdown('[the example.com sheet](https://example.com/a)')).toBe(
      '[the example.com sheet](https://example.com/a)'
    )
  })

  it('collapses a multi-line label it keeps onto one line', () => {
    expect(tidyClickupMarkdown('[a\n\nreal   label](https://example.com/a)')).toBe(
      '[a real label](https://example.com/a)'
    )
  })

  it('leaves an image alone', () => {
    expect(tidyClickupMarkdown('![](https://example.com/a.png)')).toBe(
      '![](https://example.com/a.png)'
    )
    expect(tidyClickupMarkdown('![Code 1](https://example.com/a.png)')).toBe(
      '![Code 1](https://example.com/a.png)'
    )
  })

  it('keeps prose, normalises line breaks and trims', () => {
    expect(tidyClickupMarkdown('Review the sex matching issue\r\nPotentially drop coalesce')).toBe(
      'Review the sex matching issue\nPotentially drop coalesce'
    )
    expect(tidyClickupMarkdown('\n\nOne\n\n\n\nTwo  \n\n')).toBe('One\n\nTwo')
  })

  // Cases the real library showed that no synthetic fixture did (6 Oct 2026 dry run).

  it('drops a label whose URL ClickUp escaped for Markdown', () => {
    const url = 'https://rhul.sharepoint.com/sites/AH_Ethical_Review/SitePages/Home.aspx'
    const escaped = 'https://rhul.sharepoint.com/sites/AH\\_Ethical\\_Review/SitePages/Home.aspx'
    expect(tidyClickupMarkdown(`[${escaped}](${url})`)).toBe(url)
    // The other real one: the domain alongside the escaped URL.
    const talk = 'https://mariakna.github.io/talks/korochkina_cbu_talk_091025.pdf'
    const talkEscaped = 'https://mariakna.github.io/talks/korochkina\\_cbu\\_talk\\_091025.pdf'
    expect(tidyClickupMarkdown(`[mariakna.github.io ${talkEscaped}](${talk})`)).toBe(talk)
    // A domain that is not the URL's own is a real word, so the label stays.
    expect(tidyClickupMarkdown(`[mariakna.github.io ${escaped}](${url})`)).toContain('](')
  })

  it('gives each bare URL its own line, so two embeds never run together', () => {
    const a = 'https://post.parliament.uk/fellowships/'
    const b = 'https://intranet.royalholloway.ac.uk/events.aspx'
    expect(tidyClickupMarkdown(`[${a}](${a})[${b}](${b})`)).toBe(`${a}\n${b}`)
    // A separator already there is enough; only a run-together needs the break.
    expect(tidyClickupMarkdown(`see [${a}](${a})then [${b}](${b})`)).toBe(`see ${a}\nthen ${b}`)
  })

  it('turns ClickUp bullets into the ones the editor writes', () => {
    expect(tidyClickupMarkdown('*   https://a.example/x\n*   https://b.example/y')).toBe(
      '- https://a.example/x\n- https://b.example/y'
    )
    expect(tidyClickupMarkdown('*   One\n    *   Nested')).toBe('- One\n    - Nested')
  })

  it('counts a lone thematic break as nothing, but keeps one among real text', () => {
    expect(tidyClickupMarkdown('* * *')).toBe('')
    expect(tidyClickupMarkdown('---')).toBe('')
    expect(tidyClickupMarkdown('\n\n* * *\n\n')).toBe('')
    expect(tidyClickupMarkdown('One\n\n* * *\n\nTwo')).toBe('One\n\n* * *\n\nTwo')
  })

  it('is empty for a description that holds nothing', () => {
    expect(tidyClickupMarkdown('')).toBe('')
    expect(tidyClickupMarkdown('\n\n   \n')).toBe('')
  })
})

const task = (over: Partial<StoredTask> = {}): StoredTask => ({
  uid: 'u1',
  sourceId: 's1',
  title: 'A task',
  description: '',
  ...over
})

describe('planDescriptionBackfill', () => {
  it('plans the tidied Markdown for a task with an empty description', () => {
    const plan = planDescriptionBackfill([task()], new Map([['s1', KATHY_EMBED]]))
    expect(plan.changes).toEqual([
      { uid: 'u1', sourceId: 's1', title: 'A task', description: KATHY_URL, kind: 'link' }
    ])
    expect(plan.kept).toBe(0)
    expect(plan.empty).toBe(0)
    expect(plan.missing).toEqual([])
  })

  it('calls a description with prose text, not link', () => {
    const plan = planDescriptionBackfill([task()], new Map([['s1', 'Do the thing']]))
    expect(plan.changes[0]).toMatchObject({ description: 'Do the thing', kind: 'text' })
  })

  it('never overwrites a description we already hold', () => {
    const held = [task({ description: 'Mine, typed since' })]
    const plan = planDescriptionBackfill(held, new Map([['s1', 'Something else entirely']]))
    expect(plan.changes).toEqual([])
    expect(plan.kept).toBe(1)
  })

  it('counts a task empty on both sides as nothing to do', () => {
    const plan = planDescriptionBackfill([task()], new Map([['s1', '']]))
    expect(plan.changes).toEqual([])
    expect(plan.empty).toBe(1)
  })

  it('reports an id ClickUp did not return rather than guessing', () => {
    const plan = planDescriptionBackfill([task()], new Map())
    expect(plan.changes).toEqual([])
    expect(plan.missing).toEqual(['s1'])
  })

  it('handles the real shape: many tasks, a few with embeds', () => {
    const tasks = [
      task({ uid: 'a', sourceId: 'a', description: '' }),
      task({ uid: 'b', sourceId: 'b', description: 'already here' }),
      task({ uid: 'c', sourceId: 'c', description: '' }),
      task({ uid: 'd', sourceId: 'd', description: '' })
    ]
    const plan = planDescriptionBackfill(
      tasks,
      new Map([
        ['a', KATHY_EMBED],
        ['b', 'ignored'],
        ['c', '']
      ])
    )
    expect(plan.changes.map((c) => c.uid)).toEqual(['a'])
    expect(plan.kept).toBe(1)
    expect(plan.empty).toBe(1)
    expect(plan.missing).toEqual(['d'])
  })
})
