import React from 'react'
import { Inbox } from 'lucide-react'

/**
 * EmptyState
 * Renders a centred empty-content placeholder.
 *
 * Props:
 *   icon        — Lucide icon component (default: Inbox)
 *   title       — Heading text (required)
 *   description — Supporting paragraph (optional)
 *   action      — Any React node, e.g. a <button> (optional)
 *   compact     — Smaller vertical padding (optional, default false)
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact = false,
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-4 ${compact ? 'py-8' : 'py-14'}`}>
      <div className="w-12 h-12 bg-navy/5 rounded-2xl flex items-center justify-center mb-4">
        <Icon size={22} className="text-navy/35" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-semibold text-gray-800 mb-1">{title}</p>
      {description && (
        <p className="text-sm text-gray-400 max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
