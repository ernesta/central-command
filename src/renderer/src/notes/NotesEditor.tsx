import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import { Milkdown, MilkdownProvider, useEditor, useInstance } from '@milkdown/react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router'
import { parseEntityHref } from '@shared/entities'
import { entityHostCtx } from '../entities/entity-plugin'
import { EntityHoverCard, type HoverTarget } from '../entities/EntityHoverCard'
import { EntityPicker } from '../entities/EntityPicker'
import { entityIconVars } from '../entities/icons'
import { EntityPickerController } from '../entities/picker-controller'
import { providerFor, type EntitySelf } from '../entities/registry'
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
  /**
   * Wires up Cmd-F, from `EditorCard`'s `useNotesFind` (the card shows the bar in its own footer). Applied
   * last, after the shared plugins, so its key handling is the outermost.
   */
  findSetup: (editor: Editor) => Editor
  /** Put the cursor in the note as soon as the editor is ready (a note started from quick capture). */
  autoFocus?: boolean
  /** The note or meeting this text belongs to, so `@` never offers it as a link to itself. */
  entitySelf?: EntitySelf
}

const HOVER_DELAY_MS = 350

function Inner({
  initial,
  onChange,
  onBlur,
  placeholder,
  showPlaceholder,
  setup,
  findSetup,
  autoFocus,
  entitySelf
}: NotesEditorProps): React.JSX.Element {
  const navigate = useNavigate()
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  // The `@` picker and what mentions point at, for this editor (see `src/renderer/src/entities`).
  const [controller] = useState(() => new EntityPickerController())
  const [iconVars] = useState(entityIconVars)
  const picker = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  useEffect(() => {
    controller.setSelf(entitySelf ?? null)
  }, [controller, entitySelf])

  useEditor((root) => {
    const editor = Editor.make().config((ctx) => {
      ctx.set(rootCtx, root)
      ctx.set(defaultValueCtx, initial)
      ctx.set(notesChangeCtx.key, (markdown) => onChangeRef.current(markdown))
      ctx.set(entityHostCtx.key, controller)
    })
    return findSetup(withNotesPlugins(setup ? setup(editor) : editor))
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

  // Holding Cmd (Ctrl) turns a click on a link into "open it", so show the pointer for as long as it is held.
  const wrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const show = (event: KeyboardEvent | MouseEvent): void => {
      wrapRef.current?.toggleAttribute('data-open-links', event.metaKey || event.ctrlKey)
    }
    const hide = (): void => wrapRef.current?.removeAttribute('data-open-links')
    window.addEventListener('keydown', show)
    window.addEventListener('keyup', show)
    window.addEventListener('mousemove', show)
    window.addEventListener('blur', hide)
    return () => {
      window.removeEventListener('keydown', show)
      window.removeEventListener('keyup', show)
      window.removeEventListener('mousemove', show)
      window.removeEventListener('blur', hide)
    }
  }, [])

  // A mention the pointer rests on shows what it points at (a card under it); moving on, typing or scrolling hides it.
  const [hover, setHover] = useState<HoverTarget | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stopHover = (): void => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = null
    setHover(null)
  }
  useEffect(() => {
    const hide = (): void => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current)
      hoverTimer.current = null
      setHover(null)
    }
    window.addEventListener('keydown', hide)
    window.addEventListener('scroll', hide, true)
    return () => {
      window.removeEventListener('keydown', hide)
      window.removeEventListener('scroll', hide, true)
    }
  }, [])
  const startHover = (event: React.MouseEvent): void => {
    const mention = (event.target as HTMLElement).closest<HTMLElement>('.ProseMirror .entity')
    if (!mention) return
    const kind = mention.dataset.kind
    const key = mention.dataset.key
    const ref = kind && key ? parseEntityHref(`cc://${kind}/${encodeURIComponent(key)}`) : null
    if (!ref) return
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    const rect = mention.getBoundingClientRect()
    const label = mention.textContent ?? ''
    hoverTimer.current = setTimeout(
      () => setHover({ ref, label, rect: { left: rect.left, bottom: rect.bottom } }),
      HOVER_DELAY_MS
    )
  }

  // Clicking the empty space around the text should still put the cursor in the note. A link is opened with Cmd (or
  // Ctrl) held: a plain click puts the cursor in it, as in any editor. A web address opens in the browser (the main
  // process refuses anything else); a mention opens what it points at, inside the app.
  const focusEditor = (event: React.MouseEvent): void => {
    const link = (event.target as HTMLElement).closest('a[href]')
    if ((event.metaKey || event.ctrlKey) && link) {
      event.preventDefault()
      const href = link.getAttribute('href') ?? ''
      const ref = parseEntityHref(href)
      if (ref) {
        stopHover()
        void providerFor(ref.kind)
          ?.resolve(ref.key)
          .then((summary) => {
            if (summary) void navigate(summary.route)
          })
      } else window.open(href, '_blank')
      return
    }
    if (loading || (event.target as HTMLElement).closest('.ProseMirror')) return
    getEditor()?.action((ctx) => ctx.get(editorViewCtx).focus())
  }

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      style={iconVars}
      onBlur={() => {
        controller.dismiss()
        onBlur()
      }}
      onClick={focusEditor}
      onMouseOver={startHover}
      onMouseOut={stopHover}
    >
      {showPlaceholder && (
        <div className={styles.placeholder} aria-hidden>
          {placeholder}
        </div>
      )}
      <Milkdown />
      <EntityPicker
        snapshot={picker}
        onHover={controller.setActive}
        onChoose={(index) => void controller.choose(index)}
      />
      {hover && <EntityHoverCard controller={controller} target={hover} />}
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
