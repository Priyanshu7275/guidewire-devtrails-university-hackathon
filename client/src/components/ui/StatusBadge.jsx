import React from 'react'
import { CheckCircle2, Clock, AlertCircle, XCircle, Shield, ShieldOff } from 'lucide-react'

/**
 * StatusBadge
 * Renders a coloured pill for claim decisions, claim statuses, and policy statuses.
 *
 * Props:
 *   type    — 'decision' | 'claim' | 'policy' (default: 'decision')
 *   value   — the status/decision string
 *   size    — 'sm' | 'md' (default: 'md')
 *   showIcon — whether to prepend an icon (default: true)
 */

const DECISION_CONFIG = {
  AUTO_APPROVE:  { label: 'Auto Approved',  icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  SOFT_HOLD:     { label: 'Soft Hold',      icon: Clock,        color: 'bg-amber-100   text-amber-700   ring-amber-200' },
  MANUAL_REVIEW: { label: 'Manual Review',  icon: AlertCircle,  color: 'bg-blue-100    text-blue-700    ring-blue-200' },
  AUTO_REJECT:   { label: 'Auto Rejected',  icon: XCircle,      color: 'bg-red-100     text-red-700     ring-red-200' },
}

const CLAIM_STATUS_CONFIG = {
  paid:         { label: 'Paid',         icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  approved:     { label: 'Approved',     icon: CheckCircle2, color: 'bg-green-100   text-green-700   ring-green-200' },
  pending:      { label: 'Pending',      icon: Clock,        color: 'bg-amber-100   text-amber-700   ring-amber-200' },
  under_review: { label: 'Under Review', icon: AlertCircle,  color: 'bg-blue-100    text-blue-700    ring-blue-200' },
  rejected:     { label: 'Rejected',     icon: XCircle,      color: 'bg-red-100     text-red-700     ring-red-200' },
}

const POLICY_STATUS_CONFIG = {
  active:    { label: 'Active',    icon: Shield,    color: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  expired:   { label: 'Expired',   icon: ShieldOff, color: 'bg-slate-100   text-slate-500   ring-slate-200' },
  cancelled: { label: 'Cancelled', icon: XCircle,   color: 'bg-red-100     text-red-700     ring-red-200' },
}

const CONFIG_MAP = {
  decision: DECISION_CONFIG,
  claim:    CLAIM_STATUS_CONFIG,
  policy:   POLICY_STATUS_CONFIG,
}

export default function StatusBadge({ type = 'decision', value, size = 'md', showIcon = true }) {
  const config = CONFIG_MAP[type] || DECISION_CONFIG
  const entry  = config[value] || {
    label: value?.replace(/_/g, ' ') || '—',
    icon:  AlertCircle,
    color: 'bg-slate-100 text-slate-500 ring-slate-200',
  }

  const Icon = entry.icon
  const sizeClasses = size === 'sm'
    ? 'text-2xs px-2 py-0.5 gap-1'
    : 'text-xs  px-2.5 py-1 gap-1.5'
  const iconSize = size === 'sm' ? 10 : 12

  return (
    <span className={`inline-flex items-center font-semibold rounded-full ring-1 ring-inset capitalize ${sizeClasses} ${entry.color}`}>
      {showIcon && <Icon size={iconSize} strokeWidth={2.5} className="flex-shrink-0" />}
      {entry.label}
    </span>
  )
}
