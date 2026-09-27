import type { Editor } from '@milkdown/kit/core'
import type { EditorView } from '@milkdown/kit/prose/view'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  findBridgeCtx,
  findMatches,
  notesFindPlugin,
  scrollToMatch,
  setFindMatches,
  type FindBridge,
  type FindMatch
} from './notes-find'
import styles from './NotesFindBar.module.css'

/**
 * Find within one note's text, as `notesFindPlugin`'s Cmd-F opens it. Keeps its own copy of what the plugin's
 * key handler needs (a view once the editor exists) and tells React through a setter, so the plugin never
 * sees a stale closure (the same shape as `TodoMenuController`).
 */
class NotesFindController implements FindBridge {
  view: EditorView | null = null
  matches: FindMatch[] = []
  active = 0

  constructor(private readonly setOpen: (open: boolean) => void) {}

  isOpen = (): boolean => this.view !== null

  open = (view: EditorView): void => {
    this.view = view
    this.setOpen(true)
  }

  close = (): void => {
    if (this.view) setFindMatches(this.view, [], 0)
    this.view = null
    this.matches = []
    this.active = 0
    this.setOpen(false)
  }

  /** Runs when the editor is recreated (a reload from disk): the old view is gone. */
  detach = (): void => {
    if (this.view) this.close()
  }

  search = (query: string): void => {
    if (!this.view) return
    this.matches = findMatches(this.view.state.doc, query)
    this.active = 0
    setFindMatches(this.view, this.matches, this.active)
    scrollToMatch(this.view, this.matches[this.active])
  }

  move = (step: 1 | -1): void => {
    if (!this.view || this.matches.length === 0) return
    this.active = (this.active + step + this.matches.length) % this.matches.length
    setFindMatches(this.view, this.matches, this.active)
    scrollToMatch(this.view, this.matches[this.active])
  }
}

/**
 * Find within the note (Cmd-F, Ctrl-F elsewhere): a bar at the bottom of the window while it is open. `setup`
 * goes to `NotesEditor`, which every kind of note shares, so this needs no wiring from any page.
 */
export function useNotesFind(): { setup: (editor: Editor) => Editor; bar: React.ReactNode } {
  const [open, setOpenState] = useState(false)
  const [controller] = useState(() => new NotesFindController(setOpenState))
  const [query, setQuery] = useState('')
  // A new object every time, even when the count or the active index happens to repeat, so a re-render
  // always follows (React would otherwise skip it, comparing the old and new state as equal).
  const [result, setResult] = useState({ count: 0, active: 0 })
  const inputRef = useRef<HTMLInputElement>(null)

  // Loading a different note into the same editor instance (or a reload from disk) must not leave a stale
  // find open over content that has moved on.
  useEffect(() => controller.detach, [controller])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const search = (value: string): void => {
    setQuery(value)
    controller.search(value)
    setResult({ count: controller.matches.length, active: controller.active })
  }
  const move = (step: 1 | -1): void => {
    controller.move(step)
    setResult({ count: controller.matches.length, active: controller.active })
  }
  const close = (): void => {
    controller.close()
    setQuery('')
    setResult({ count: 0, active: 0 })
  }

  const setup = (editor: Editor): Editor =>
    editor
      .config((ctx) => ctx.set(findBridgeCtx.key, controller))
      .use(findBridgeCtx)
      .use(notesFindPlugin)

  const bar = open
    ? createPortal(
        <div className={styles.bar} role="search" aria-label="Find in the note">
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            placeholder="Find in this note"
            aria-label="Find in this note"
            value={query}
            onChange={(event) => search(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                if (query !== '') move(event.shiftKey ? -1 : 1)
              } else if (event.key === 'Escape') {
                event.preventDefault()
                close()
              }
            }}
          />
          <span className={styles.count} role="status">
            {query === ''
              ? ''
              : result.count === 0
                ? 'No matches'
                : `${result.active + 1} of ${result.count}`}
          </span>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Previous match"
            disabled={result.count === 0}
            onClick={() => move(-1)}
          >
            <ChevronUp size={16} strokeWidth={1.75} aria-hidden />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Next match"
            disabled={result.count === 0}
            onClick={() => move(1)}
          >
            <ChevronDown size={16} strokeWidth={1.75} aria-hidden />
          </button>
          <button type="button" className={styles.iconButton} aria-label="Close" onClick={close}>
            <X size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>,
        document.body
      )
    : null

  return { setup, bar }
}
