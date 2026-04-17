import React from 'react'

/**
 * LoadingSkeleton
 * Thin wrapper around the `.skeleton` CSS class defined in index.css.
 * Accepts arbitrary className to set width / height / margin.
 */
export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />
}

/* ── Preset skeleton shapes ─────────────────────────────────────────── */

/** One KPI stat card (number + label) */
export function StatCardSkeleton() {
  return (
    <div className="card space-y-3 animate-pulse">
      <Skeleton className="h-3 w-20 rounded" />
      <Skeleton className="h-8 w-28 rounded-lg" />
      <Skeleton className="h-3 w-32 rounded" />
    </div>
  )
}

/** A single table row — pass cols to control number of cells */
export function TableRowSkeleton({ cols = 5 }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3.5 border-b border-slate-50">
          <Skeleton className={`h-3.5 rounded ${i === 0 ? 'w-24' : i === cols - 1 ? 'w-16' : 'w-20'}`} />
        </td>
      ))}
    </tr>
  )
}

/** Full table body placeholder */
export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} cols={cols} />
      ))}
    </tbody>
  )
}

/** Policy / feature card */
export function CardSkeleton({ lines = 3 }) {
  return (
    <div className="card space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-32 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 rounded ${i === lines - 1 ? 'w-3/4' : 'w-full'}`} />
      ))}
    </div>
  )
}

/** A full-page loading state — 4 stat cards + table */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading dashboard">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      {/* Table placeholder */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <Skeleton className="h-4 w-32 rounded" />
        </div>
        <table className="w-full">
          <TableSkeleton rows={6} cols={5} />
        </table>
      </div>
    </div>
  )
}

export default Skeleton
