import type { PersonUsage } from './people-usage'

const plural = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? '' : 's'}`

/** "2 meetings and 1 training"; nothing for zero of both. */
function inNotes(meetings: number, trainings: number): string {
  return [
    meetings > 0 && plural(meetings, 'meeting'),
    trainings > 0 && plural(trainings, 'training')
  ]
    .filter(Boolean)
    .join(' and ')
}

/** The sentences the Change dialog shows for an edit; empty when the edit changes no note, so no dialog is needed. */
export function changeSentences(
  usage: PersonUsage | undefined,
  nameChanged: boolean,
  initialsChanged: boolean
): string[] {
  if (!usage) return []
  const sentences: string[] = []
  const named = inNotes(usage.attended, usage.trainings)
  if (nameChanged && named) sentences.push(`This will update the name in ${named}.`)
  if (initialsChanged && usage.todos > 0) {
    const where = usage.todoMeetings > 1 ? 'across' : 'in'
    sentences.push(
      `Initials will change in ${plural(usage.todos, 'TODO')} ${where} ${plural(usage.todoMeetings, 'meeting')}.`
    )
  }
  return sentences
}

/** What Merge does to the notes that mention the person. */
export function mergeSentence(usage: PersonUsage | undefined): string {
  const where = usage ? inNotes(usage.meetings, usage.trainings) : ''
  return `Names and TODO initials${where ? ` in ${where}` : ''} will change to theirs.`
}

/** "Mentioned in 2 meetings and 1 training." */
export function mentionedText(usage: PersonUsage): string {
  return `Mentioned in ${inNotes(usage.meetings, usage.trainings)}.`
}
