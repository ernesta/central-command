interface ImportedIconProps {
  size?: number
  className?: string
}

/** ClickUp's mark (an up chevron over a curve) drawn as a Lucide-style line icon: time imported from ClickUp. */
export function ImportedIcon({ size = 16, className }: ImportedIconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4.5 11.5 12 5l7.5 6.5" />
      <path d="M5 16.5c1.8 1.9 4.2 3 7 3s5.2-1.1 7-3" />
    </svg>
  )
}
