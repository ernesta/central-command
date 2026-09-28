import { useEffect, useState } from 'react'

/** Whether the window is in full screen right now (starts false; the window never opens into it). */
export function useFullScreen(): boolean {
  const [isFullScreen, setIsFullScreen] = useState(false)
  useEffect(() => window.api.app.onFullScreenChange(setIsFullScreen), [])
  return isFullScreen
}
