/** "just now", "2 min ago", "3 h ago", "yesterday", "5 days ago", then a date. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const seconds = Math.round((now.getTime() - then.getTime()) / 1000)
  if (Number.isNaN(seconds)) return ''
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return then.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
