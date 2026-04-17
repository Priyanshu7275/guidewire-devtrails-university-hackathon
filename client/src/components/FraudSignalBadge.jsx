/*
 * components/FraudSignalBadge.jsx — Fraud Detection Signal Display
 *
 * Shows a single fraud signal returned by the claims API.
 * Each signal has a type, severity (CRITICAL / HIGH / MEDIUM / LOW), and detail.
 *
 * Props:
 *   signal (object) — { type, severity, detail }
 */

import React from 'react'
import { AlertOctagon, AlertTriangle, Info, ShieldAlert } from 'lucide-react'

/* Maps severity to Tailwind colour classes and an icon */
const severityConfig = {
  CRITICAL: { classes: 'bg-red-100 text-red-800 border-red-200',   icon: <AlertOctagon size={13} /> },
  HIGH:     { classes: 'bg-orange-100 text-orange-800 border-orange-200', icon: <ShieldAlert size={13} /> },
  MEDIUM:   { classes: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: <AlertTriangle size={13} /> },
  LOW:      { classes: 'bg-blue-100 text-blue-800 border-blue-200', icon: <Info size={13} /> },
}

export default function FraudSignalBadge({ signal }) {
  const config = severityConfig[signal.severity?.toUpperCase()] || severityConfig.LOW

  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded border text-xs ${config.classes}`}>
      <span className="mt-0.5 flex-shrink-0">{config.icon}</span>
      <div>
        <span className="font-semibold">{signal.type.replace(/_/g, ' ')}</span>
        {signal.detail && (
          <span className="ml-1 font-normal opacity-80">— {signal.detail}</span>
        )}
      </div>
    </div>
  )
}
