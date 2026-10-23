import { Button } from '@renderer/components/Button'

interface BackToTodayProps {
  /** "This week" or "This month". */
  label: string
  onClick: () => void
}

/** A small button at the card header's far end that returns to the current period; the caller renders it only while away from it. */
export function BackToToday({ label, onClick }: BackToTodayProps): React.JSX.Element {
  return (
    <Button size="small" onClick={onClick}>
      {label}
    </Button>
  )
}
