import React, { useEffect, useState } from 'react';
import { fetchHistoricalResolutionSuggestions } from '../api/client';
import {
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Building2,
  ChevronRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

// In-memory module cache to prevent duplicate API requests when rendered in multiple locations
const suggestionsCache = new Map();

export default function HistoricalResolutionSuggestions({
  complaintId,
  onApplyTemplate,
  title = 'Historical Resolution Suggestions',
  subtitle = 'Assists officers with proven remediation strategies from prior resolved cases.',
  badgeText = null
}) {
  const [data, setData] = useState(() => (complaintId ? suggestionsCache.get(complaintId) || null : null));
  const [loading, setLoading] = useState(() => (complaintId ? !suggestionsCache.has(complaintId) : false));
  const [error, setError] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const loadSuggestions = async (force = false) => {
    if (!complaintId) return;
    if (!force && suggestionsCache.has(complaintId)) {
      setData(suggestionsCache.get(complaintId));
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetchHistoricalResolutionSuggestions(complaintId);
      const resData = res?.data || null;
      suggestionsCache.set(complaintId, resData);
      setData(resData);
    } catch (err) {
      setError(err.message || 'Failed to load historical resolution suggestions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (complaintId) {
      loadSuggestions(false);
    }
  }, [complaintId]);

  const handleApply = (summary, index) => {
    if (typeof onApplyTemplate === 'function') {
      onApplyTemplate(summary);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2500);
    }
  };

  if (loading) {
    return (
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
        <RefreshCw size={16} className="animate-spin text-blue-600 mx-auto" />
        <p className="text-xs text-slate-500 font-medium">Analyzing historical departmental cases...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle size={15} className="text-amber-600 shrink-0" />
          <span>{error}</span>
        </div>
        <button
          type="button"
          onClick={() => loadSuggestions(true)}
          className="text-xs font-semibold text-amber-900 underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const suggestions = data?.suggestions || [];

  return (
    <div className="space-y-3 p-4 rounded-xl border border-indigo-100 bg-indigo-50/40">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-indigo-600 text-white shrink-0 shadow-sm">
            <Sparkles size={16} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-950">
                {title}
              </h4>
              {badgeText && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-200 text-indigo-900">
                  {badgeText}
                </span>
              )}
            </div>
            <p className="text-[11px] text-indigo-800/80">
              {subtitle}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => loadSuggestions(true)}
          className="text-indigo-600 hover:text-indigo-800 text-xs font-medium flex items-center gap-1 p-1 rounded hover:bg-indigo-100/60 transition"
          title="Refresh suggestions"
        >
          <RefreshCw size={12} />
          <span className="text-[10px] hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Advisory Banner */}
      <div className="p-2 rounded-lg bg-white border border-indigo-100 text-[11px] text-slate-600 flex items-center gap-1.5 shadow-sm">
        <ShieldCheck size={14} className="text-indigo-600 shrink-0" />
        <span>Advisory Intelligence: Suggestions are strictly decision-support. Officers retain full operational authority.</span>
      </div>

      {/* Honest Empty State */}
      {suggestions.length === 0 ? (
        <div className="p-6 rounded-xl bg-white border border-slate-200 text-center space-y-1">
          <p className="text-xs font-semibold text-slate-700">No Historical Resolutions Available</p>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
            {data?.message || 'No prior resolved complaints in this department match this issue pattern above the similarity threshold.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {suggestions.map((item, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-indigo-300 transition space-y-2"
            >
              {/* Top Row: Ref, Similarity & Duration */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {item.referenceNumber}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    {Math.round(item.similarityScore * 100)}% Match
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <Clock size={13} className="text-slate-400" />
                  <span>Resolved in {item.resolutionDuration}</span>
                </div>
              </div>

              {/* Match Reasons Tags */}
              {item.matchReasons && item.matchReasons.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.matchReasons.map((reason, rIdx) => (
                    <span
                      key={rIdx}
                      className="text-[10px] px-1.5 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 rounded"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              )}

              {/* Sanitized Resolution Action */}
              <div className="text-xs text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-medium leading-relaxed">
                <span className="font-bold text-slate-700 block mb-0.5 text-[11px] uppercase tracking-wider">
                  Remediation Action Taken:
                </span>
                {item.sanitizedResolutionSummary}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-1">
                <div className="text-[11px] text-slate-500">
                  <span>Method: </span>
                  <span className="font-semibold text-slate-700 font-mono text-[10px]">
                    {item.verificationMethod}
                  </span>
                </div>

                {onApplyTemplate && (
                  <button
                    type="button"
                    onClick={() => handleApply(item.sanitizedResolutionSummary, idx)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition"
                  >
                    {copiedIndex === idx ? (
                      <>
                        <Check size={13} className="text-emerald-600" />
                        <span className="text-emerald-700">Inserted!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Use as Template</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
