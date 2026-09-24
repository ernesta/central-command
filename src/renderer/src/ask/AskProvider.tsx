import { useCallback, useMemo, useState } from 'react'
import { AskContext } from './ask-context'
import { placeholderBackend, type AskBackend, type AskMessage } from './backend'

/**
 * Holds the conversation, draft and open state above the router, so they
 * survive collapsing the panel and switching workspaces (in memory only).
 */
export function AskProvider({
  children,
  backend = placeholderBackend
}: {
  children: React.ReactNode
  backend?: AskBackend
}): React.JSX.Element {
  const [messages, setMessages] = useState<readonly AskMessage[]>([])
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const send = useCallback(async () => {
    const text = draft.trim()
    if (!text || pending) return
    const userMessage: AskMessage = { id: crypto.randomUUID(), role: 'user', text }
    const history = [...messages, userMessage]
    setMessages(history)
    setDraft('')
    setPending(true)
    try {
      const reply = await backend.reply(history)
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', text: reply }
      ])
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: 'Something went wrong. Please try again.'
        }
      ])
    } finally {
      setPending(false)
    }
  }, [backend, draft, messages, pending])

  const value = useMemo(
    () => ({ messages, draft, setDraft, open, setOpen, pending, send }),
    [messages, draft, open, pending, send]
  )
  return <AskContext.Provider value={value}>{children}</AskContext.Provider>
}
