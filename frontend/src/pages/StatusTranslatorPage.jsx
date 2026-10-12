import React, { useState } from 'react';
import {
  Languages,
  HelpCircle,
  Search,
  CheckCircle2,
  Clock,
  Building2,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Info,
  Calendar,
  Lock,
  Sparkles
} from 'lucide-react';
import { fetchComplaintStatusExplanation, fetchComplaintTracking } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';

export default function StatusTranslatorPage() {
  const [referenceInput, setReferenceInput] = useState('');
  const [language, setLanguage] = useState('en');
  const [explanation, setExplanation] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sampleReferences = ['CS-2026-0001', 'CS-2026-0002', 'CS-2026-0003'];

  const handleTranslate = async (refToUse = referenceInput, langToUse = language) => {
    const targetRef = (refToUse || '').trim();
    if (!targetRef) return;

    try {
      setLoading(true);
      setError(null);

      const [explainRes, trackRes] = await Promise.allSettled([
        fetchComplaintStatusExplanation(targetRef, { lang: langToUse }),
        fetchComplaintTracking(targetRef)
      ]);

      if (explainRes.status === 'fulfilled' && explainRes.value?.data) {
        setExplanation(explainRes.value.data);
      } else {
        throw new Error(
          explainRes.reason?.message || 'Could not find status details for this reference number.'
        );
      }

      if (trackRes.status === 'fulfilled' && trackRes.value?.data) {
        setTracking(trackRes.value.data);
      } else {
        setTracking(null);
      }
    } catch (err) {
      setError(err.message || 'Grievance reference not found. Please verify the reference number.');
      setExplanation(null);
      setTracking(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageToggle = (newLang) => {
    setLanguage(newLang);
    if (explanation || referenceInput.trim()) {
      handleTranslate(referenceInput, newLang);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleTranslate(referenceInput, language);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
              <Languages size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Citizen Status Translator</h1>
              <p className="text-sm text-slate-600">
                Translating bureaucratic administrative jargon into reassuring, plain-language vernacular explanations.
              </p>
            </div>
          </div>

          {/* Language Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl self-start sm:self-auto border border-slate-200">
            <button
              type="button"
              onClick={() => handleLanguageToggle('en')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                language === 'en'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => handleLanguageToggle('hi')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                language === 'hi'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              हिंदी (Hindi)
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              required
              placeholder="Enter grievance reference (e.g. CS-2026-0001)..."
              value={referenceInput}
              onChange={(e) => setReferenceInput(e.target.value)}
              className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono font-semibold"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition disabled:opacity-50"
          >
            {loading ? 'Translating...' : 'Translate Status'}
          </button>
        </form>

        {/* Quick Demo Reference Chips */}
        <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
          <span>Try quick sample:</span>
          {sampleReferences.map((ref) => (
            <button
              key={ref}
              type="button"
              onClick={() => {
                setReferenceInput(ref);
                handleTranslate(ref, language);
              }}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-mono text-xs font-semibold transition"
            >
              {ref}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-center gap-3 text-sm">
          <AlertCircle size={20} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Translation Output Card */}
      {explanation && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            {/* Status Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-lg text-slate-800">
                    {explanation.referenceNumber}
                  </span>
                  <StatusBadge status={explanation.officialStatus} />
                  <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-semibold">
                    {explanation.language === 'hi' ? 'हिंदी में अनुवादित' : 'Plain English'}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-2">
                  {explanation.statusLabel}
                </h2>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 self-start sm:self-auto font-medium">
                <ShieldCheck size={16} />
                <span>Zero Private Notes Leaked</span>
              </div>
            </div>

            {/* Translation Quadrant */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Meaning */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                  <Info size={16} className="text-blue-600" />
                  <span>{language === 'hi' ? 'इस स्थिति का क्या अर्थ है?' : 'What this status means'}</span>
                </div>
                <p className="text-sm text-slate-800 leading-relaxed font-medium">
                  {explanation.meaning}
                </p>
              </div>

              {/* What Happened */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>{language === 'hi' ? 'अब तक क्या हुआ है?' : 'What has actually happened'}</span>
                </div>
                <p className="text-sm text-slate-800 leading-relaxed font-medium">
                  {explanation.whatHappened}
                </p>
              </div>

              {/* Next Steps */}
              <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200/70 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800">
                  <ArrowRight size={16} className="text-amber-600" />
                  <span>{language === 'hi' ? 'आप आगे क्या कर सकते हैं?' : 'What you can do next'}</span>
                </div>
                <p className="text-sm text-amber-950 leading-relaxed font-medium">
                  {explanation.nextSteps}
                </p>
              </div>

              {/* SLA & Timeline */}
              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200/70 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-800">
                  <Clock size={16} className="text-blue-600" />
                  <span>{language === 'hi' ? 'समय-सीमा व प्रगति' : 'SLA & Expected Timelines'}</span>
                </div>
                <p className="text-sm text-blue-950 leading-relaxed font-medium">
                  {explanation.slaGuidance}
                </p>
              </div>
            </div>

            {/* Verified Meta Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1">
                  <Building2 size={13} />
                  <span>Department: <strong>{explanation.verifiedContext?.departmentId}</strong></span>
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={13} />
                  <span>Last Updated: <strong>{new Date(explanation.verifiedContext?.lastUpdated).toLocaleString()}</strong></span>
                </span>
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <Lock size={12} />
                <span>Deterministic vernacular engine</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State when no query performed */}
      {!explanation && !loading && !error && (
        <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center space-y-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <HelpCircle size={24} />
          </div>
          <h2 className="text-base font-semibold text-slate-800">
            Understand Grievance Progress Without Cryptic Department Acronyms
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Enter your tracking reference above to receive instant, transparent clarity on what stage your case has reached, what the department is doing, and what steps you can take next.
          </p>
        </div>
      )}
    </div>
  );
}
