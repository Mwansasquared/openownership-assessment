import type { Status } from '../types'

export function StatusBadge({ state }: { state: Status }) {
  return (
    <span className="status-badge" data-state={state}>
      {state.replace('_', ' ')}
    </span>
  )
}
