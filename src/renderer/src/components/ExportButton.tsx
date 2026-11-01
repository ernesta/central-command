import { Download } from 'lucide-react'
import { Button } from './Button'

/** "Export": a quiet button (a faint box, so it lines up with the edge it sits at). Same label and place in every list. */
export function ExportButton({
  onClick,
  disabled,
  busy
}: {
  onClick?: () => void
  disabled?: boolean
  busy?: boolean
}): React.JSX.Element {
  return (
    <Button
      variant="quiet"
      icon={<Download size={14} strokeWidth={1.75} aria-hidden />}
      disabled={disabled || busy}
      onClick={onClick}
    >
      {busy ? 'Exporting…' : 'Export'}
    </Button>
  )
}
