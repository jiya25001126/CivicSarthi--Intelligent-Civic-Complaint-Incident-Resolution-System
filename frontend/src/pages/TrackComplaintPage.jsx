import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchComplaintTracking, fetchComplaintStatusExplanation } from '../api/client';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import { useLanguage } from '../context/LanguageContext';
import {
  Search,
  CheckCircle2,
  Clock,
  User,
  ShieldCheck,
  Building2,
  ArrowRight,
  AlertCircle,
  FileText,
  MapPin,
  Calendar,
  ExternalLink,
  Shield,
  Lock,
  Languages,
  Info
} from 'lucide-react';
import {
  formatOutcomeType,
  formatVerificationMethod,
  formatExceptionReason
} from '../constants/resolutionQuality.constants';

export default function TrackComplaintPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, lang, formatDate, tDepartment, tStatus } = useLanguage();

  const [inputQuery, setInputQuery] = useState(id || '');
  const [complaint, setComplaint] = useState(null);
  const [history, setHistory] = useState([]);
  const [statusExplanation, setStatusExplanation] = useState(null);
  const [translatorLang, setTranslatorLang] = useState(lang || 'en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setTranslatorLang(lang);
  }, [lang]);

  const fetchExplanation = async (searchId, l = lang) => {
    try {
      const expRes = await fetchComplaintStatusExplanation(searchId, { lang: l });
      if (expRes?.data) {
        setStatusExplanation(expRes.data);
      }
    } catch (expErr) {
      console.info('Status explanation fallback:', expErr.message);
    }
  };

  const performSearch = async (searchId, l = lang) => {
    if (!searchId || !searchId.trim()) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetchComplaintTracking(searchId.trim());
      setComplaint(res.data);
      setHistory(res.data?.statusHistory || []);
      await fetchExplanation(searchId.trim(), l);
    } catch (err) {
      setError(err.message || t('trackComplaint.notFoundError'));
      setComplaint(null);
      setHistory([]);
      setStatusExplanation(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      setInputQuery(id);
      performSearch(id, lang);
    }
  }, [id, lang]);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (inputQuery.trim()) {
      navigate(`/citizen/track/${encodeURIComponent(inputQuery.trim())}`);
      performSearch(inputQuery.trim(), translatorLang);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Search Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Search size={24} className="text-blue-600" />
            {t('trackComplaint.title')}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {t('trackComplaint.subtitle')}
          </p>
        </div>

        <form onSubmit={handleFormSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <label htmlFor="track-search-input" className="sr-only">{t('common.referenceNo')}</label>
            <Search size={18} className="absolute left-3.5 top-3.5 text-slate-400" aria-hidden="true" />
            <input
              id="track-search-input"
              type="text"
              required
              aria-required="true"
              aria-invalid={Boolean(error)}
              placeholder={t('trackComplaint.inputPlaceholder')}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono font-semibold"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm transition disabled:opacity-50"
          >
            {loading ? t('trackComplaint.searchingButton') : t('trackComplaint.trackButton')}
          </button>
        </form>
      </div>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-center gap-3 text-sm"
        >
          <AlertCircle size={20} className="shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Results View */}
      {complaint && (
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-xl text-blue-700">
                    {complaint.referenceNumber || complaint.id}
                  </span>
                  <StatusBadge status={complaint.status} />
                  <PriorityBadge priority={complaint.priority} />
                </div>
                <h2 className="text-base font-bold text-slate-900 mt-1">
                  {complaint.title || complaint.text}
                </h2>
                {complaint.statusDescription && (
                  <p className="text-xs text-blue-800 bg-blue-50/80 p-2.5 rounded-lg border border-blue-200 mt-2">
                    <span className="font-semibold">{lang === 'hi' ? 'वर्तमान स्थिति का अर्थ: ' : 'Current Status Meaning: '}</span>
                    {complaint.statusDescription}
                  </p>
                )}
              </div>
              <Link
                to={`/citizen/complaints/${encodeURIComponent(complaint.id)}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold self-start sm:self-auto transition"
              >
                <span>{lang === 'hi' ? 'नागरिक दृश्य' : 'Citizen View'}</span>
                <ExternalLink size={13} />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block mb-0.5">{t('common.department')}</span>
                <span className="font-bold text-slate-800">{tDepartment(complaint.departmentId || complaint.department)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block mb-0.5">{lang === 'hi' ? 'क्षेत्राधिकार' : 'Jurisdiction'}</span>
                <span className="font-bold text-slate-800">{complaint.district}, {complaint.state}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block mb-0.5">{t('common.filedDate')}</span>
                <span className="font-bold text-slate-800">
                  {formatDate(complaint.createdAt)}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block mb-0.5">{lang === 'hi' ? 'पुनः आवंटन / हस्तांतरण' : 'Handoffs / Reassignments'}</span>
                <span className="font-bold text-slate-800">
                  {complaint.reassignments || 0} {lang === 'hi' ? 'बार' : 'times'}
                </span>
              </div>
            </div>

            {/* Privacy Notice */}
            <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <Lock size={13} className="text-slate-400 shrink-0" />
              <span>
                {lang === 'hi'
                  ? 'सार्वजनिक ट्रैकिंग दृश्य: निजी नागरिक संपर्क जानकारी और आंतरिक अधिकारी समीक्षा टिप्पणियां पूर्णतः सुरक्षित हैं।'
                  : 'Public Tracking View: Private citizen contact information and internal officer review notes are strictly protected.'}
              </span>
            </div>
          </div>

          {/* Citizen-Friendly Vernacular Status Translator Card */}
          {statusExplanation && (
            <div className="bg-white p-6 rounded-2xl border border-emerald-200/80 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                    <Languages size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      {t('trackComplaint.plainLanguageTitle')}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {t('trackComplaint.plainLanguageSubtitle')}
                    </p>
                  </div>
                </div>

                {/* Language Toggle */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setTranslatorLang('en');
                      fetchExplanation(complaint.referenceNumber || complaint.id, 'en');
                    }}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                      translatorLang === 'en'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTranslatorLang('hi');
                      fetchExplanation(complaint.referenceNumber || complaint.id, 'hi');
                    }}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                      translatorLang === 'hi'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    हिंदी
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1">
                  <span className="font-bold text-slate-700 block">
                    {translatorLang === 'hi' ? 'इस स्थिति का क्या अर्थ है?' : 'What this status means'}
                  </span>
                  <p className="text-slate-800 leading-relaxed font-medium">
                    {statusExplanation.meaning}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1">
                  <span className="font-bold text-slate-700 block">
                    {translatorLang === 'hi' ? 'अब तक क्या हुआ है?' : 'What has actually happened'}
                  </span>
                  <p className="text-slate-800 leading-relaxed font-medium">
                    {statusExplanation.whatHappened}
                  </p>
                </div>

                <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200/70 space-y-1">
                  <span className="font-bold text-amber-900 block">
                    {translatorLang === 'hi' ? 'आप आगे क्या कर सकते हैं?' : 'What you can do next'}
                  </span>
                  <p className="text-amber-950 leading-relaxed font-medium">
                    {statusExplanation.nextSteps}
                  </p>
                </div>

                <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200/70 space-y-1">
                  <span className="font-bold text-blue-900 block">
                    {translatorLang === 'hi' ? 'समय-सीमा व प्रगति' : 'SLA & Expected Timelines'}
                  </span>
                  <p className="text-blue-950 leading-relaxed font-medium">
                    {statusExplanation.slaGuidance}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Official Resolution Verification Record Card (Citizen Public Tracking View) */}
          {complaint.resolutionDetails && (
            <div className="bg-gradient-to-br from-emerald-50/50 to-white p-6 rounded-2xl border-2 border-emerald-500 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                  <div>
                    <h3 className="font-bold text-base text-slate-900">
                      {t('trackComplaint.resolutionDetailsHeading')}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {lang === 'hi'
                        ? 'सिविकसारथी निवारण मानकों के तहत सत्यापित प्रक्रियात्मक गुणवत्ता मानदंड'
                        : 'Procedural quality criteria verified under CivicSarthi Resolution Standards'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {t('common.status')}: {tStatus(complaint.status)}
                  </span>
                  {typeof complaint.resolutionDetails.score === 'number' && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
                      {complaint.resolutionDetails.score}% {lang === 'hi' ? 'अनुपालन स्कोर' : 'Compliance Score'}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-white rounded-xl border border-emerald-200/80">
                  <span className="text-slate-500 block mb-0.5">{t('trackComplaint.outcomeTypeLabel')}</span>
                  <span className="font-bold text-slate-900">
                    {formatOutcomeType(complaint.resolutionDetails.outcomeType, lang)}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-emerald-200/80">
                  <span className="text-slate-500 block mb-0.5">{t('trackComplaint.verificationMethodLabel')}</span>
                  <span className="font-bold text-slate-900">
                    {formatVerificationMethod(complaint.resolutionDetails.verificationMethod, lang)}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-emerald-200/80">
                  <span className="text-slate-500 block mb-0.5">{lang === 'hi' ? 'समाधान तिथि' : 'Resolution Date'}</span>
                  <span className="font-bold text-slate-900">
                    {complaint.resolutionDetails.resolvedAt
                      ? formatDate(complaint.resolutionDetails.resolvedAt)
                      : (lang === 'hi' ? 'दर्ज' : 'Recorded')}
                  </span>
                </div>
              </div>

              {complaint.resolutionDetails.closureRemarks && (
                <div className="p-3.5 bg-white rounded-xl border border-emerald-200/80 space-y-1">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    {t('trackComplaint.closureRemarksLabel')}
                  </span>
                  <p className="text-xs text-slate-800 leading-relaxed font-normal">
                    {complaint.resolutionDetails.closureRemarks}
                  </p>
                </div>
              )}

              {complaint.resolutionDetails.isException && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                  <ShieldCheck size={16} className="text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">{t('trackComplaint.exceptionReasonLabel')}: </span>
                    <span>
                      {formatExceptionReason(complaint.resolutionDetails.exceptionReason, lang)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status Progression Timeline */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">
                {t('trackComplaint.statusTimelineTitle')}
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {history.length} {lang === 'hi' ? 'जीवनचक्र घटनाएं' : 'lifecycle events'}
              </span>
            </div>

            {history.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4">
                {lang === 'hi' ? 'अभी तक कोई स्थिति प्रगति दर्ज नहीं की गई है।' : 'No status progression recorded yet.'}
              </p>
            ) : (
              <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {history.map((event, idx) => {
                  const isLatest = idx === history.length - 1;
                  return (
                    <div key={idx} className="relative group">
                      {/* Timeline dot */}
                      <div
                        className={`absolute -left-6 sm:-left-8 top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          isLatest
                            ? 'bg-blue-600 border-white text-white shadow-md ring-4 ring-blue-100'
                            : 'bg-white border-slate-400 text-slate-600'
                        }`}
                      >
                        <Clock size={12} />
                      </div>

                      <div className="space-y-1.5 bg-slate-50/60 p-4 rounded-xl border border-slate-200/80">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={event.status} />
                            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                              {event.actorType || (lang === 'hi' ? 'अधिकारी' : 'OFFICER')}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 font-medium">
                            {formatDate(event.timestamp)}
                          </span>
                        </div>

                        {event.statusDescription && (
                          <p className="text-[11px] text-blue-700 italic font-medium">
                            {event.statusDescription}
                          </p>
                        )}

                        <p className="text-xs text-slate-700 leading-relaxed font-normal pt-0.5">
                          {event.remarks || (lang === 'hi' ? 'सिस्टम में स्थिति अद्यतित की गई।' : 'Status updated in system.')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
