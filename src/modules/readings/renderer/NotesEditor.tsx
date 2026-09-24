import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import { listenerCtx } from '@milkdown/kit/plugin/listener'
import { Milkdown, MilkdownProvider, useEditor, useInstance } from '@milkdown/react'
import { useEffect, useRef } from 'react'
import { withNotesPlugins } from './notes-editor-setup'
import styles from './NotesEditor.module.css'

interface NotesEditorProps {
  /** The Markdown to start from. To load different content, remount with a new `key`. */
  initial: string
  /** Called with the full Markdown after every change the user makes. */
  onChange: (markdown: string) => void
  /** Called when focus leaves the editor. */
  onBlur: () => void
  placeholder: string
  showPlaceholder: boolean
}

function Inner({
  initial,
  onChange,
  onBlur,
  placeholder,
  showPlaceholder
}: NotesEditorProps): React.JSX.Element {
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEditor((root) =>
    withNotesPlugins(
      Editor.make().config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, initial)
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, previous) => {
          if (markdown !== previous) onChangeRef.current(markdown)
        })
      })
    )
  )
  const [loading, getEditor] = useInstance()

  // Clicking the empty space around the text should still put the cursor in the note.
  const focusEditor = (event: React.MouseEvent): void => {
    if (loading || (event.target as HTMLElement).closest('.ProseMirror')) return
    getEditor()?.action((ctx) => ctx.get(editorViewCtx).focus())
  }

  return (
    <div className={styles.wrap} onBlur={onBlur} onClick={focusEditor}>
      {showPlaceholder && (
        <div className={styles.placeholder} aria-hidden>
          {placeholder}
        </div>
      )}
      <Milkdown />
    </div>
  )
}

/** A live-render Markdown editor: typing `## `, `**x**` or `- ` formats in place, with no separate preview. */
export function NotesEditor(props: NotesEditorProps): React.JSX.Element {
  return (
    <MilkdownProvider>
      <Inner {...props} />
    </MilkdownProvider>
  )
}
