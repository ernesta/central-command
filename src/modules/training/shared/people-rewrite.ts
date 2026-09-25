import { isNoChange, renameInList, type PersonChange } from '@shared/people-rewrite'
import { joinNote, parseTrainingMeta, splitNote, updateTrainingHead } from './front-matter'

/** A training entry's text after a person changed: their name in the leads. Nothing else is touched. */
export function rewriteTrainingPeople(content: string, change: PersonChange): string {
  if (isNoChange(change)) return content
  const { head, body } = splitNote(content)
  const leads = renameInList(parseTrainingMeta(head).meta.leads, change.names)
  return joinNote({ head: leads ? updateTrainingHead(head, { leads }) : head, body })
}
