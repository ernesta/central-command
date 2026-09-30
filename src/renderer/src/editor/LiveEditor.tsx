import { EditorView } from '@codemirror/view'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router'
import { entityHref, parseEntityHref } from '@shared/entities'
import { EntityHoverCard } from '../entities/EntityHoverCard'
import { EntityPicker } from '../entities/EntityPicker'
import { entityIconVars } from '../entities/icons'
import { EntityPickerController } from '../entities/picker-controller'
import { providerFor, type EntitySelf } from '../entities/registry'
import { useEntityHover } from '../entities/useEntityHover'
import { createLiveState } from './live-state'
import styles from './LiveEditor.module.css'

/** The same props `NotesEditor` takes, less what only Milkdown needs (`setup`, `findSetup`); see `EDITOR_LIVE_MARKUP_PLAN.md`. */
export interface LiveEditorProps {
  /** The Markdown to start from. To load different content, remount with a new `key`. */
  initial: string
  /** Called with the full Markdown after every change the user makes. */
  onChange: (markdown: string) => void
  /** Called when focus leaves the editor. */
  onBlur: () => void
  placeholder: string
  showPlaceholder: boolean
  /** Put the cursor in the note as soon as the editor is ready (a note started from quick capture). */
  autoFocus?: boolean
  /** The note or meeting this text belongs to, so `@` never offers it as a link to itself. */
  entitySelf?: EntitySelf
}

/**
 * The notes editor where the document is the Markdown text itself (CodeMirror 6): markers such as `### `, `**` and
 * `](url)` are real characters, drawn only on the block or span the cursor is in. See `live-decorations.ts`.
 */
export function LiveEditor({
  initial,
  onChange,
  onBlur,
  placeholder,
  showPlaceholder,
  autoFocus,
  entitySelf
}: LiveEditorProps): React.JSX.Element {
  const navigate = useNavigate()
  const hostRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [start] = useState(initial)

  // The `@` picker and what mentions point at, for this editor (see `src/renderer/src/entities`).
  const [controller] = useState(() => new EntityPickerController())
  const [iconVars] = useState(entityIconVars)
  const picker = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  useEffect(() => {
    controller.setSelf(entitySelf ?? null)
  }, [controller, entitySelf])
  const { hover, onMouseOver, onMouseOut, stop: stopHover } = useEntityHover('.live-chip')

  // The editor reads the latest callbacks without being rebuilt when they change.
  const onChangeRef = useRef(onChange)
  const openLinkRef = useRef<(href: string) => void>(() => undefined)
  useEffect(() => {
    onChangeRef.current = onChange
    openLinkRef.current = (href) => {
      const ref = parseEntityHref(href)
      if (!ref) {
        window.open(href, '_blank')
        return
      }
      stopHover()
      void providerFor(ref.kind)
        ?.resolve(ref.key)
        .then((summary) => {
          if (summary) void navigate(summary.route)
        })
    }
  })

  // React's development mode mounts, unmounts and mounts again: the editor is built from `start` each time, and the
  // first one is thrown away before anyone can type in it.
  useEffect(() => {
    const parent = hostRef.current
    if (!parent) return
    const view = new EditorView({
      parent,
      state: createLiveState({
        doc: start,
        label: placeholder,
        onChange: (text) => onChangeRef.current(text),
        openLink: (href) => openLinkRef.current(href),
        entities: { host: controller, open: (ref) => openLinkRef.current(entityHref(ref)) }
      })
    })
    viewRef.current = view
    if (autoFocus) view.focus()
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [start, placeholder, autoFocus, controller])

  // Holding Cmd (Ctrl) turns a click on a link into "open it", so show the pointer for as long as it is held.
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

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      style={iconVars}
      onBlur={() => {
        controller.dismiss()
        onBlur()
      }}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
      // The space around the text still puts the cursor in the note.
      onClick={(event) => {
        if (event.target === event.currentTarget) viewRef.current?.focus()
      }}
    >
      {showPlaceholder && (
        <div className={styles.placeholder} aria-hidden>
          {placeholder}
        </div>
      )}
      <div ref={hostRef} />
      <EntityPicker
        snapshot={picker}
        onHover={controller.setActive}
        onChoose={(index) => void controller.choose(index)}
      />
      {hover && <EntityHoverCard controller={controller} target={hover} />}
    </div>
  )
}
