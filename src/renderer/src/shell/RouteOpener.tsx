import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { openRoute, setNavigator } from './navigate-store'

/** Opens the page the main process asks for (a clicked notification). Only in-app routes are followed. Renders nothing. */
export function RouteOpener(): null {
  const navigate = useNavigate()
  useEffect(() => {
    setNavigator((route) => void navigate(route))
    const off = window.api.app.onOpenRoute(openRoute)
    return () => {
      off()
      setNavigator(null)
    }
  }, [navigate])
  return null
}
