import React from 'react';
import { Languages, HelpCircle, ArrowRight } from 'lucide-react';

export default function StatusTranslatorPage() {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
            <Languages size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Status Translator</h1>
            <p className="text-sm text-slate-600">
              Translating bureaucratic jargon and CPGRAMS statuses into plain, reassuring vernacular summaries.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center space-y-4">
        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
          <HelpCircle size={24} />
        </div>
        <h2 className="text-base font-semibold text-slate-800">
          Plain Language & Regional Vernacular Engine
        </h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Converts cryptic official statuses (such as "FORWARDED_TO_SUBORDINATE_OFFICE" or "INTERIM_REPLY") into simple explanations with realistic expected resolution steps.
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">
          <span>Scheduled for Phase 12 Implementation</span>
          <ArrowRight size={14} />
        </div>
      </div>
    </div>
  );
}
