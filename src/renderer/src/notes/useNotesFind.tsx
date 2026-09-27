import type { Editor } from '@milkdown/kit/core'
import type { EditorView } from '@milkdown/kit/prose/view'
import { ChevronDown, ChevronUp, Replace, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@renderer/components/Button'
import { matchesShortcut } from '@shared/shortcuts'
import {
  findBridgeCtx,
  findMatches,
  notesFindPlugin,
  REPLACE_ALL_SHORTCUT,
  REPLACE_ONE_SHORTCUT,
  REPLACE_TOGGLE_SHORTCUT,
  replaceAllMatches,
  replaceMatch,
  scrollToMatch,
  setFindMatches,
  type FindBridge,
  type FindMatch
} from './notes-find'
import styles from './NotesFindBar.module.css'

/**
 * Find (and replace) within one note's text, as `notesFindPlugin`'s Cmd-F and Cmd-Option-F open it. Keeps its
 * own copy of what the plugin's key handler needs (a view once the editor exists) and tells React through the
 * callbacks it is built with, so the plugin never sees a stale closure (the same shape as `TodoMenuController`).
 */
class NotesFindController implements FindBridge {
  view: EditorView | null = null
  matches: FindMatch[] = []
  active = 0

  constructor(
    private readonly onOpen: (view: EditorView, showReplace: boolean) => void,
    private readonly onClose: () => void
  ) {}

  isOpen = (): boolean => this.view !== null

  open = (view: EditorView, showReplace: boolean): void => {
    this.view = view
    this.onOpen(view, showReplace)
  }

  close = (): void => {
    if (this.view) setFindMatches(this.view, [], 0)
    this.view = null
    this.matches = []
    this.active = 0
    this.onClose()
  }

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

  /** Replaces the current match, then lands on whichever match now takes its place (or the next one). */
  replaceOne = (replacement: string, query: string): void => {
    if (!this.view || this.matches.length === 0) return
    replaceMatch(this.view, this.matches[this.active], replacement)
    this.matches = findMatches(this.view.state.doc, query)
    this.active = this.matches.length === 0 ? 0 : this.active % this.matches.length
    setFindMatches(this.view, this.matches, this.active)
    scrollToMatch(this.view, this.matches[this.active])
  }

  replaceAll = (replacement: string): void => {
    if (!this.view || this.matches.length === 0) return
    replaceAllMatches(this.view, this.matches, replacement)
    this.matches = []
    this.active = 0
    setFindMatches(this.view, [], 0)
  }
}

/**
 * Find and replace within the note (Cmd-F, Ctrl-F elsewhere; Cmd-Option-F opens straight to replace). `setup`
 * goes to `NotesEditor`; `bar` and `open` go to `EditorCard`, which shows the bar in place of its facts line
 * while find is open. Nothing here assumes where it is rendered, so a page never has to wire this up itself.
 */
export function useNotesFind(): {
  setup: (editor: Editor) => Editor
  open: boolean
  bar: React.ReactNode
} {
  const [open, setOpen] = useState(false)
  const [showReplace, setShowReplace] = useState(false)
  const [controller] = useState(
    () =>
      new NotesFindController(
        (_view, replace) => {
          setOpen(true)
          setShowReplace(replace)
        },
        () => {
          setOpen(false)
          setShowReplace(false)
        }
      )
  )
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  // A new object every time, even when the count or the active index happens to repeat, so a re-render
  // always follows (React would otherwise skip it, comparing the old and new state as equal).
  const [result, setResult] = useState({ count: 0, active: 0 })
  const findRef = useRef<HTMLInputElement>(null)

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
    setReplacement('')
    setResult({ count: 0, active: 0 })
  }
  const replaceOne = (): void => {
    if (query === '' || result.count === 0) return
    controller.replaceOne(replacement, query)
    setResult({ count: controller.matches.length, active: controller.active })
  }
  const replaceAll = (): void => {
    if (query === '' || result.count === 0) return
    controller.replaceAll(replacement)
    setResult({ count: 0, active: 0 })
  }
  const toggleReplace = (): void => setShowReplace((v) => !v)

  const handleInputKey = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (matchesShortcut(event, REPLACE_ALL_SHORTCUT)) {
      event.preventDefault()
      replaceAll()
    } else if (matchesShortcut(event, REPLACE_ONE_SHORTCUT)) {
      event.preventDefault()
      replaceOne()
    } else if (matchesShortcut(event, REPLACE_TOGGLE_SHORTCUT)) {
      event.preventDefault()
      toggleReplace()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (query !== '') move(event.shiftKey ? -1 : 1)
    }
  }

  // A window-level listener, not just the two fields' own key handling: clicking "Replace all" (or a
  // "Replace" that empties the matches) disables that button, which blurs it to nothing focused at all, so
  // Escape must still close the bar from there. `closeRef` keeps this effect from needing to reattach every
  // render, the same pattern `NotesEditor` uses for `onChange`.
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  })
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closeRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const setup = (editor: Editor): Editor =>
    editor
      .config((ctx) => ctx.set(findBridgeCtx.key, controller))
      .use(findBridgeCtx)
      .use(notesFindPlugin)

  const bar = open ? (
    <div className={styles.bar}>
      <div className={styles.row} role="search" aria-label="Find in the note">
        <input
          ref={findRef}
          autoFocus
          className={styles.input}
          type="text"
          placeholder="Find in this note"
          aria-label="Find in this note"
          value={query}
          onChange={(event) => search(event.target.value)}
          onKeyDown={handleInputKey}
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
          aria-label={showReplace ? 'Hide replace' : 'Show replace'}
          aria-pressed={showReplace}
          onClick={toggleReplace}
        >
          <Replace size={16} strokeWidth={1.75} aria-hidden />
        </button>
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
      </div>
      {showReplace && (
        <div className={styles.row}>
          <input
            className={styles.input}
            type="text"
            placeholder="Replace with"
            aria-label="Replace with"
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
            onKeyDown={handleInputKey}
          />
          <Button size="small" disabled={result.count === 0} onClick={replaceOne}>
            Replace
          </Button>
          <Button size="small" disabled={result.count === 0} onClick={replaceAll}>
            Replace all
          </Button>
        </div>
      )}
    </div>
  ) : null

  return { setup, open, bar }
}
