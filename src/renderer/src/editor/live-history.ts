import { isolateHistory } from '@codemirror/commands'
import { EditorState, Transaction, type Extension } from '@codemirror/state'

/*
 * Undo. The history joins typing with the edit next to it when they come within half a second (that is how a burst of
 * typing becomes one step), and it treats anything called `delete.…` as typing, and lets typing join the edit before it.
 * So a command of ours — Enter, a list key, Cmd-B, a table's new row, a paste, a chosen mention — could be undone
 * together with the words typed just before or after it. Every command is one key press and one undo step, on its own.
 * Plain typing, and the Backspace that corrects it, keep the library's grouping.
 */
const COMMANDS =
  /^(format($|\.)|delete\.(list|chip)$|input$|input\.(table|replace|complete|paste)$)/

export const liveHistory: Extension = EditorState.transactionExtender.of((tr) => {
  if (!tr.docChanged) return null
  const event = tr.annotation(Transaction.userEvent)
  return event && COMMANDS.test(event) ? { annotations: isolateHistory.of('full') } : null
})
