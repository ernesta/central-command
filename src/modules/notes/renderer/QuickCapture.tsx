import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { matchesShortcut } from '@shared/shortcuts'
import { QUICK_CAPTURE_SHORTCUT } from '../shared/shortcuts'
import { getCaptureGroup } from './capture-group'
import { noteRoute } from './notes-paths'
import type { NoteLocationState } from './NotePage'

/**
 * Starts a note from anywhere in the app: the shortcut makes an ungrouped note (or one in the group being
 * looked at) at once and opens it with the cursor in the text, so you can type first and title later.
 * Renders nothing.
 */
export function QuickCapture(): null {
  const navigate = useNavigate()
  const busy = useRef(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!matchesShortcut(event, QUICK_CAPTURE_SHORTCUT)) return
      event.preventDefault()
      if (event.repeat || busy.current) return
      busy.current = true
      const { group, subgroup } = getCaptureGroup()
      window.api.notes
        .create({ workspace: 'research', group, subgroup })
        .then((file) =>
          navigate(noteRoute(file.ref.id), { state: { focus: 'body' } satisfies NoteLocationState })
        )
        .catch((error: unknown) => console.error('Could not start a note:', error))
        .finally(() => {
          busy.current = false
        })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate])

  return null
}
