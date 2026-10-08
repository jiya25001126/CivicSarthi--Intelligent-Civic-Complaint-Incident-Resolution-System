import React from 'react';
import { ShieldAlert, Network, ArrowRight } from 'lucide-react';

export default function IncidentPage() {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
            <ShieldAlert size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Parent Incident Clustering</h1>
            <p className="text-sm text-slate-600">
              Aggregating multi-issue disaster & civic grievances under a unified parent coordination incident.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center space-y-4">
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
          <Network size={24} />
        </div>
        <h2 className="text-base font-semibold text-slate-800">
          Composite Incident Detection Engine
        </h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          In upcoming phases, JanSahay clusters related grievances (e.g. Flood Inundation #1, #2, #3) across Power, Water, and Roads departments into a synchronized multi-agency action incident.
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">
          <span>Scheduled for Phase 2 Implementation</span>
          <ArrowRight size={14} />
        </div>
      </div>
    </div>
  );
}
