import { describe, expect, it } from 'vitest'
import { changeSentences, mentionedText, mergeSentence } from './people-copy'

const usage = { name: 'X', meetings: 9, trainings: 1, attended: 5, todos: 17, todoMeetings: 9 }

describe('changeSentences', () => {
  it('says what a new name changes, with counts', () => {
    expect(changeSentences(usage, true, false)).toEqual([
      'This will update the name in 5 meetings and 1 training.'
    ])
  })
  it('says what new initials change, with counts', () => {
    expect(changeSentences(usage, false, true)).toEqual([
      'Initials will change in 17 TODOs across 9 meetings.'
    ])
    expect(changeSentences({ ...usage, todos: 1, todoMeetings: 1 }, false, true)).toEqual([
      'Initials will change in 1 TODO in 1 meeting.'
    ])
  })
  it('gives both, and nothing when no note would change', () => {
    expect(changeSentences(usage, true, true)).toHaveLength(2)
    expect(changeSentences({ ...usage, attended: 0, trainings: 0, todos: 0 }, true, true)).toEqual(
      []
    )
    expect(changeSentences(undefined, true, true)).toEqual([])
  })
})

describe('merge and mention text', () => {
  it('counts meetings and trainings', () => {
    expect(mergeSentence(usage)).toBe(
      'Names and TODO initials in 9 meetings and 1 training will change to theirs.'
    )
    expect(mentionedText({ ...usage, meetings: 0, trainings: 2 })).toBe('Mentioned in 2 trainings.')
  })
})
