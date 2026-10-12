import { useState } from 'react'
import { useLocation, useNavigationType } from 'react-router'

/** The window's own history: the key of every entry reached and where we are in them. */
export interface HistoryPosition {
  keys: string[]
  index: number
}

/**
 * The next position after navigating to `key` by `type`. A page's `location.key` cannot say whether there is
 * anything to go back to (the start-up redirect from `/` already has a real key), so the position is tracked here.
 */
export function advance(
  position: HistoryPosition,
  type: 'PUSH' | 'REPLACE' | 'POP',
  key: string
): HistoryPosition {
  if (type === 'PUSH') {
    return { keys: [...position.keys.slice(0, position.index + 1), key], index: position.index + 1 }
  }
  if (type === 'REPLACE') {
    const keys = [...position.keys]
    keys[position.index] = key
    return { keys, index: position.index }
  }
  const found = position.keys.indexOf(key)
  return found === -1 ? position : { keys: position.keys, index: found }
}

/** Whether Back has an earlier page in this window to go to. */
export function useCanGoBack(): boolean {
  const { key } = useLocation()
  const type = useNavigationType()
  const [state, setState] = useState({ position: { keys: [key], index: 0 }, seen: key })
  if (state.seen !== key) {
    // Derived during render (React's pattern for state that follows a prop): one pass, no effect.
    setState({ position: advance(state.position, type, key), seen: key })
  }
  return state.position.index > 0
}
