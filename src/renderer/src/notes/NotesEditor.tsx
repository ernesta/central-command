import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import { Milkdown, MilkdownProvider, useEditor, useInstance } from '@milkdown/react'
import { useEffect, useRef } from 'react'
import { notesChangeCtx } from './notes-change-plugin'
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
  /**
   * Add editor plugins for one kind of note (for example the TODO helper for meetings). Applied
   * once, when the editor is created, and before the shared plugins, so its key handling runs first.
   */
  setup?: (editor: Editor) => Editor
  /** Put the cursor in the note as soon as the editor is ready (a note started from quick capture). */
  autoFocus?: boolean
}

function Inner({
  initial,
  onChange,
  onBlur,
  placeholder,
  showPlaceholder,
  setup,
  autoFocus
}: NotesEditorProps): React.JSX.Element {
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEditor((root) => {
    const editor = Editor.make().config((ctx) => {
      ctx.set(rootCtx, root)
      ctx.set(defaultValueCtx, initial)
      ctx.set(notesChangeCtx.key, (markdown) => onChangeRef.current(markdown))
    })
    return withNotesPlugins(setup ? setup(editor) : editor)
  })
  const [loading, getEditor] = useInstance()

  // Focus each time an editor becomes ready. In development React mounts, unmounts and mounts again, and the first
  // editor is thrown away; a guard that only focused once would leave the cursor in nothing.
  const getEditorRef = useRef(getEditor)
  useEffect(() => {
    getEditorRef.current = getEditor
  })
  useEffect(() => {
    if (loading || !autoFocus) return
    getEditorRef.current()?.action((ctx) => ctx.get(editorViewCtx).focus())
  }, [loading, autoFocus])

  // Clicking the empty space around the text should still put the cursor in the note. A link is opened with Cmd (or
  // Ctrl) held: a plain click puts the cursor in it, as in any editor. The main process opens web addresses in the
  // browser and refuses anything else.
  const focusEditor = (event: React.MouseEvent): void => {
    const link = (event.target as HTMLElement).closest('a[href]')
    if ((event.metaKey || event.ctrlKey) && link) {
      event.preventDefault()
      window.open(link.getAttribute('href') ?? '', '_blank')
      return
    }
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
