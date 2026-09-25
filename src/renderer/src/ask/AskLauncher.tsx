import { useEffect, useRef } from 'react'
import { MessageCircle, Minus, SendHorizontal } from 'lucide-react'
import { ASK_SHORTCUT, matchesShortcut } from '@shared/shortcuts'
import { IconButton } from '../components/IconButton'
import { Input } from '../components/Input'
import { useAsk } from './ask-context'
import styles from './AskLauncher.module.css'

/**
 * A floating "Ask" pill that expands in place into a chat panel. Not a modal:
 * the rest of the app stays usable while it is open. Cmd/Ctrl+J toggles it.
 */
export function AskLauncher(): React.JSX.Element {
  const { messages, draft, setDraft, open, setOpen, pending, send } = useAsk()
  const pillRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (matchesShortcut(event, ASK_SHORTCUT)) {
        event.preventDefault()
        setOpen(!open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, setOpen])

  // Move focus into the panel when it opens, and back to the pill when it closes.
  useEffect(() => {
    if (open) inputRef.current?.focus()
    else if (wasOpen.current) pillRef.current?.focus()
    wasOpen.current = open
  }, [open])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, open])

  if (!open) {
    return (
      <button ref={pillRef} type="button" className={styles.pill} onClick={() => setOpen(true)}>
        <MessageCircle size={16} strokeWidth={1.75} aria-hidden />
        Ask
      </button>
    )
  }

  return (
    <section
      className={styles.panel}
      aria-label="Ask Claude"
      onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
    >
      <header className={styles.header}>
        <span className={styles.title}>
          <span className={styles.dot} aria-hidden />
          Claude
        </span>
        <IconButton label="Collapse" onClick={() => setOpen(false)}>
          <Minus size={16} strokeWidth={1.75} aria-hidden />
        </IconButton>
      </header>
      <div className={styles.messages} role="log" aria-live="polite">
        {messages.length === 0 && <p className={styles.hint}>Ask Claude anything.</p>}
        {messages.map((m) => (
          <div
            key={m.id}
            className={[styles.message, m.role === 'user' ? styles.user : styles.assistant].join(
              ' '
            )}
          >
            {m.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        <Input
          ref={inputRef}
          className={styles.input}
          value={draft}
          placeholder="Message Claude…"
          aria-label="Message"
          onChange={(event) => setDraft(event.target.value)}
        />
        <IconButton label="Send" type="submit" disabled={!draft.trim() || pending}>
          <SendHorizontal size={16} strokeWidth={1.75} aria-hidden />
        </IconButton>
      </form>
    </section>
  )
}
