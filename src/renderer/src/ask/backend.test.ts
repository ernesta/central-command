import { describe, expect, it } from 'vitest'
import { placeholderBackend } from './backend'

describe('placeholderBackend', () => {
  it('says Claude is not connected, whatever is asked', async () => {
    expect(await placeholderBackend.reply([{ id: '1', role: 'user', text: 'hi' }])).toBe(
      "Claude isn't connected yet."
    )
  })
})
