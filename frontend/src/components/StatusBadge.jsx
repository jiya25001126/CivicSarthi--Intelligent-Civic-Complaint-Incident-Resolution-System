import React from 'react';
import {
  Clock,
  Eye,
  UserCheck,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  RefreshCcw,
  Flame
} from 'lucide-react';

export function StatusBadge({ status, className = '' }) {
  const configs = {
    SUBMITTED: {
      label: 'Submitted',
      bg: 'bg-indigo-50 border-indigo-200 text-indigo-700',
      icon: Clock
    },
    UNDER_REVIEW: {
      label: 'Under Review',
      bg: 'bg-amber-50 border-amber-200 text-amber-800',
      icon: Eye
    },
    ASSIGNED: {
      label: 'Assigned',
      bg: 'bg-blue-50 border-blue-200 text-blue-700',
      icon: UserCheck
    },
    IN_PROGRESS: {
      label: 'In Progress',
      bg: 'bg-sky-50 border-sky-200 text-sky-800',
      icon: RotateCw
    },
    AWAITING_INFORMATION: {
      label: 'Awaiting Info',
      bg: 'bg-orange-50 border-orange-200 text-orange-800',
      icon: AlertTriangle
    },
    RESOLVED: {
      label: 'Resolved',
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      icon: CheckCircle2
    },
    CLOSED: {
      label: 'Closed',
      bg: 'bg-slate-100 border-slate-300 text-slate-700',
      icon: Lock
    },
    REOPENED: {
      label: 'Reopened',
      bg: 'bg-purple-50 border-purple-200 text-purple-800',
      icon: RefreshCcw
    }
  };

  const current = configs[status] || {
    label: status || 'Unknown',
    bg: 'bg-slate-100 border-slate-200 text-slate-700',
    icon: Clock
  };

  const Icon = current.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${current.bg} ${className}`}
    >
      <Icon size={12} className="shrink-0" />
      <span>{current.label}</span>
    </span>
  );
}

export function PriorityBadge({ priority, className = '' }) {
  const configs = {
    CRITICAL: {
      label: 'Critical',
      bg: 'bg-red-600 text-white border-red-700',
      icon: Flame
    },
    HIGH: {
      label: 'High',
      bg: 'bg-amber-500 text-white border-amber-600',
      icon: AlertTriangle
    },
    MEDIUM: {
      label: 'Medium',
      bg: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: null
    },
    LOW: {
      label: 'Low',
      bg: 'bg-slate-100 text-slate-700 border-slate-200',
      icon: null
    }
  };

  const current = configs[priority] || {
    label: priority || 'Medium',
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: null
  };

  const Icon = current.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border uppercase tracking-wider ${current.bg} ${className}`}
    >
      {Icon && <Icon size={11} className="shrink-0" />}
      <span>{current.label}</span>
    </span>
  );
}
