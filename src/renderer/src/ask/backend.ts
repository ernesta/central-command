export interface AskMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
}

/**
 * The single seam between the Ask panel and whatever answers it. A real
 * implementation (Claude Code / the Agent SDK) replaces the placeholder by
 * implementing this interface; the UI does not change.
 */
export interface AskBackend {
  reply(history: readonly AskMessage[]): Promise<string>
}

export const placeholderBackend: AskBackend = {
  reply: async () => "Claude isn't connected yet."
}
