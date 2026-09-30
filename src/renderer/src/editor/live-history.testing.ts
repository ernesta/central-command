import type { EditorView } from '@codemirror/view'
import { liveFindTarget } from './live-find'

/** The matches of `query` in the editor's text, as the find bar asks for them. */
export function findMatches(
  view: EditorView,
  query: string
): ReturnType<ReturnType<typeof liveFindTarget>['search']> {
  return liveFindTarget(view).search(query)
}
