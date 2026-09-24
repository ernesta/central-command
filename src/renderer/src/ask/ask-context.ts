import { createContext, useContext } from 'react'
import type { AskMessage } from './backend'

export interface AskContextValue {
  messages: readonly AskMessage[]
  draft: string
  setDraft: (draft: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  /** True while waiting for the backend's reply. */
  pending: boolean
  send: () => Promise<void>
}

export const AskContext = createContext<AskContextValue | null>(null)

export function useAsk(): AskContextValue {
  const ctx = useContext(AskContext)
  if (!ctx) throw new Error('useAsk must be used inside AskProvider')
  return ctx
}
