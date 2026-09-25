import { isNoChange, renameInList, type PersonChange } from '@shared/people-rewrite'
import { joinNote, parseMeta, splitNote, updateHead } from './front-matter'
import { renameTodoOwners } from './todos'

/**
 * A meeting file's text after a person changed: their name in the attendees, and their initials in the
 * owners of TODOs (including several owners and Previous TODOs). Nothing else is touched; a note that
 * mentions nobody affected comes back byte for byte.
 */
export function rewriteMeetingPeople(content: string, change: PersonChange): string {
  if (isNoChange(change)) return content
  const { head, body } = splitNote(content)
  const attendees = renameInList(parseMeta(head).meta.attendees, change.names)
  const newHead = attendees ? updateHead(head, { attendees }) : head
  const newBody = renameTodoOwners(body, change.initials).body
  return joinNote({ head: newHead, body: newBody })
}
