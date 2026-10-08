import React from 'react';
import { AlertTriangle, Clock, ArrowRight } from 'lucide-react';

export default function NeglectRadarPage() {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
            <AlertTriangle size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Neglect Radar & Stall Detection</h1>
            <p className="text-sm text-slate-600">
              Automated anomaly detection for reassignment ping-pong loops, stale complaints, and silent SLA breaches.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center space-y-4">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <Clock size={24} />
        </div>
        <h2 className="text-base font-semibold text-slate-800">
          Proactive Redressal Stall Radar
        </h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Monitors cases cycling between departments without action, flagged by JanSahay's configurable SLA rules (reassignment threshold &gt;= 2, stale updates &gt; 7 days).
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">
          <span>Scheduled for Phase 3 Implementation</span>
          <ArrowRight size={14} />
        </div>
      </div>
    </div>
  );
}
