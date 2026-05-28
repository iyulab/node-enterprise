import type { ReactNode } from 'react'

export function FormRow({
  children,
  full,
}: {
  children: ReactNode
  full?: boolean
}) {
  if (full) {
    return <div style={{ width: '100%' }}>{children}</div>
  }
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
      }}
    >
      {children}
    </div>
  )
}
