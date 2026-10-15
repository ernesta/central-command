import { useEffect } from 'react'
import { useNavigate } from 'react-router'

/** Opens the page the main process asks for (a clicked notification). Only in-app routes are followed. Renders nothing. */
export function RouteOpener(): null {
  const navigate = useNavigate()
  useEffect(
    () =>
      window.api.app.onOpenRoute((route) => {
        if (route.startsWith('/') && !route.startsWith('//')) void navigate(route)
      }),
    [navigate]
  )
  return null
}
