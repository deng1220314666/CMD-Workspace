interface IconProps {
  size?: number
  className?: string
}

const iconProps = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
  'aria-hidden': true,
})

export function TerminalIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m7 9 3 3-3 3" />
      <path d="M13 15h4" />
    </svg>
  )
}

export function FolderIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" />
    </svg>
  )
}

export function MoreIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function PlusIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function ChevronLeftIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

export function ChevronRightIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

export function ChevronDownIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <path d="m7 10 5 5 5-5" />
    </svg>
  )
}

export function CloseIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <path d="m7 7 10 10M17 7 7 17" />
    </svg>
  )
}

export function SearchIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </svg>
  )
}

export function CopyIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  )
}

export function ClipboardIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <rect x="5" y="5" width="14" height="16" rx="2" />
      <path d="M9 5V3h6v2M9 11h6M9 15h6" />
    </svg>
  )
}

export function ClearIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <path d="m4 15 7-7 7 7-4 4H8z" />
      <path d="M14 19h6" />
    </svg>
  )
}

export function SplitHorizontalIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M12 4v16" />
    </svg>
  )
}

export function SplitVerticalIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 12h18" />
    </svg>
  )
}

export function EditIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <path d="M4 20h4l11-11-4-4L4 16zM13.5 6.5l4 4" />
    </svg>
  )
}
