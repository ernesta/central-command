import { useEffect } from 'react'
import { Navigate, useSearchParams } from 'react-router'

/**
 * `/search?q=…` was a page; the results are now the search window grown. Anything that still links here opens that window
 * with the query filled in while the address goes back to the start page.
 */
export function SearchRedirect({ onOpen }: { onOpen: (query: string) => void }): React.JSX.Element {
  const [params] = useSearchParams()
  const query = params.get('q') ?? ''
  useEffect(() => {
    onOpen(query)
    // Once per visit to the address.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <Navigate to="/" replace />
}
