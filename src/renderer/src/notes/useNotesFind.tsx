import { ChevronDown, ChevronUp, Replace, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@renderer/components/Button'
import { IconButton } from '@renderer/components/IconButton'
import { matchesShortcut } from '@shared/shortcuts'
import {
  REPLACE_ALL_SHORTCUT,
  REPLACE_ONE_SHORTCUT,
  REPLACE_TOGGLE_SHORTCUT,
  type FindBridge,
  type FindMatch,
  type FindTarget
} from './find-types'
import styles from './NotesFindBar.module.css'

/**
 * Find (and replace) within one note's text, as the editor's Cmd-F and Cmd-Option-F open it (`editor/live-find.ts`).
 * Keeps its own copy of what the editor's key handlers need (a target once the editor exists) and tells React through
 * the callbacks it is built with, so the editor never sees a stale closure (the same shape as `TodoMenuController`).
 * It works on a `FindTarget`, so it does not know which editor it serves.
 */
export class NotesFindController implements FindBridge {
  target: FindTarget | null = null
  matches: FindMatch[] = []
  active = 0
  /** The bar's own replace-one and replace-all, for the keys pressed in the note; null while the replace row is hidden. */
  replaceKey: ((all: boolean) => void) | null = null

  constructor(
    private readonly onOpen: (showReplace: boolean) => void,
    private readonly onClose: () => void
  ) {}

  isOpen = (): boolean => this.target !== null

  open = (target: FindTarget, showReplace: boolean): void => {
    this.target = target
    this.onOpen(showReplace)
  }

  close = (): void => {
    this.target?.highlight([], 0)
    this.reset()
  }

  /** The editor is gone: leave it alone (nothing to un-highlight) and close. */
  detach = (): void => {
    if (this.target) this.reset()
  }

  private reset(): void {
    this.target = null
    this.matches = []
    this.active = 0
    this.replaceKey = null
    this.onClose()
  }

  setReplaceKey = (run: ((all: boolean) => void) | null): void => {
    this.replaceKey = run
  }

  replaceFromEditor = (all: boolean): boolean => {
    if (!this.target || !this.replaceKey) return false
    this.replaceKey(all)
    return true
  }

  private show(): void {
    this.target?.highlight(this.matches, this.active)
    this.target?.scrollTo(this.matches[this.active])
  }

  search = (query: string): void => {
    if (!this.target) return
    this.matches = this.target.search(query)
    this.active = 0
    this.show()
  }

  move = (step: 1 | -1): void => {
    if (!this.target || this.matches.length === 0) return
    this.active = (this.active + step + this.matches.length) % this.matches.length
    this.show()
  }

  /**
   * Replaces the current match, then lands on whichever match now takes its place (or the next one). The matches are found
   * again first: the text may have changed under them (typing in the note while the bar is open), and a replacement
   * must only ever land on text that matches now.
   */
  replaceOne = (replacement: string, query: string): void => {
    if (!this.target) return
    this.matches = this.target.search(query)
    if (this.matches.length === 0) return
    this.active = Math.min(this.active, this.matches.length - 1)
    this.target.replace(this.matches[this.active], replacement)
    this.matches = this.target.search(query)
    this.active = this.matches.length === 0 ? 0 : this.active % this.matches.length
    this.show()
  }

  replaceAll = (replacement: string, query: string): void => {
    if (!this.target) return
    this.matches = this.target.search(query)
    if (this.matches.length === 0) return
    this.target.replaceAll(this.matches, replacement)
    this.matches = []
    this.active = 0
    this.target.highlight([], 0)
  }
}

/**
 * Find and replace within the note (Cmd-F, Ctrl-F elsewhere; Cmd-Option-F opens straight to replace). `bridge`
 * goes to the editor through `FindContext`; `bar` and `open` go to `EditorCard`, which shows the bar in place of its facts line
 * while find is open. Nothing here assumes where it is rendered, so a page never has to wire this up itself.
 */
export function useNotesFind(): {
  /** What the editor's Cmd-F reaches (`FindContext`). */
  bridge: FindBridge
  open: boolean
  bar: React.ReactNode
} {
  const [open, setOpen] = useState(false)
  const [showReplace, setShowReplace] = useState(false)
  const [controller] = useState(
    () =>
      new NotesFindController(
        (replace) => {
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
    controller.replaceAll(replacement, query)
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
  // render, the same pattern `LiveEditor` uses for `onChange`.
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

  // Cmd-Enter and Cmd-Shift-Enter pressed in the note itself (the live editor binds them) do what the bar's Replace and
  // Replace all do, once the replace row is shown. Read through a ref so the controller never holds a stale closure.
  const replaceRef = useRef({ replaceOne, replaceAll })
  useEffect(() => {
    replaceRef.current = { replaceOne, replaceAll }
  })
  useEffect(() => {
    controller.setReplaceKey(
      open && showReplace
        ? (all) => (all ? replaceRef.current.replaceAll() : replaceRef.current.replaceOne())
        : null
    )
  }, [controller, open, showReplace])

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
        <IconButton
          className={styles.iconButton}
          label={showReplace ? 'Hide replace' : 'Show replace'}
          shortcut={REPLACE_TOGGLE_SHORTCUT}
          aria-pressed={showReplace}
          onClick={toggleReplace}
        >
          <Replace size={16} strokeWidth={1.75} aria-hidden />
        </IconButton>
        <IconButton
          className={styles.iconButton}
          label="Previous match"
          shortcut="Shift-Enter"
          disabled={result.count === 0}
          onClick={() => move(-1)}
        >
          <ChevronUp size={16} strokeWidth={1.75} aria-hidden />
        </IconButton>
        <IconButton
          className={styles.iconButton}
          label="Next match"
          shortcut="Enter"
          disabled={result.count === 0}
          onClick={() => move(1)}
        >
          <ChevronDown size={16} strokeWidth={1.75} aria-hidden />
        </IconButton>
        <IconButton className={styles.iconButton} label="Close" shortcut="Escape" onClick={close}>
          <X size={16} strokeWidth={1.75} aria-hidden />
        </IconButton>
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

  return { bridge: controller, open, bar }
}
