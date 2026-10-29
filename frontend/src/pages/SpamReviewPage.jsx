import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  fetchSpamReviews,
  fetchSpamReviewById,
  recordSpamReviewDecision,
  fetchCitizenReputation
} from '../api/client';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  FileText,
  Clock,
  UserCheck,
  Building2,
  ChevronRight,
  Info
} from 'lucide-react';

const RISK_BADGES = {
  LOW: { label: 'Low Risk', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  MEDIUM: { label: 'Medium Risk', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  HIGH: { label: 'High Risk', bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  CRITICAL: { label: 'Critical Risk', bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' }
};

const STATUS_BADGES = {
  PENDING_REVIEW: { label: 'Pending Review', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  PENDING: { label: 'Pending Review', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  IN_REVIEW: { label: 'In Review', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  RESOLVED: { label: 'Resolved', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
  REVIEWED: { label: 'Resolved', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' }
};

const OUTCOME_BADGES = {
  LEGITIMATE: { label: 'Legitimate', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  NEEDS_MORE_INFORMATION: { label: 'Needs Info', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  CONFIRMED_ABUSE: { label: 'Confirmed Abuse', bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
  ESCALATED: { label: 'Escalated', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' }
};

export default function SpamReviewPage() {
  const { user, isOfficer, isAdmin } = useAuth();
  const { t, lang, formatDate } = useLanguage();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Selected Detail Modal
  const [selectedReview, setSelectedReview] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [citizenReputation, setCitizenReputation] = useState(null);

  // Decision Form
  const [decisionOutcome, setDecisionOutcome] = useState('LEGITIMATE');
  const [decisionReason, setDecisionReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState(null);

  const loadReviews = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (statusFilter !== 'ALL') {
        const mapped = statusFilter === 'PENDING_REVIEW' ? 'PENDING' : statusFilter === 'RESOLVED' ? 'REVIEWED' : statusFilter;
        params.reviewStatus = mapped;
        params.status = mapped;
      }
      if (riskFilter !== 'ALL') params.riskLevel = riskFilter;
      const res = await fetchSpamReviews(params);
      setReviews(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch flagged spam reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [statusFilter, riskFilter]);

  const handleOpenReview = async (review) => {
    try {
      setLoadingDetail(true);
      setSelectedReview(review);
      setDecisionOutcome('LEGITIMATE');
      setDecisionReason('');
      setReviewNotes('');
      setDecisionError(null);
      setCitizenReputation(null);

      // Fetch fresh detail with complaint metadata
      const detailRes = await fetchSpamReviewById(review.id);
      if (detailRes?.data) {
        setSelectedReview(detailRes.data);
      }

      // Fetch citizen reputation context
      const citizenId = detailRes?.data?.citizenId || review.citizenId;
      if (citizenId) {
        try {
          const repRes = await fetchCitizenReputation(citizenId);
          if (repRes?.data) {
            setCitizenReputation(repRes.data);
          }
        } catch {
          // Non-blocking if reputation fetch fails
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load review details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleRecordDecision = async (e) => {
    e.preventDefault();
    if (!selectedReview) return;

    if (!decisionReason || decisionReason.trim().length < 10) {
      setDecisionError('A specific human justification of at least 10 characters is mandatory.');
      return;
    }

    try {
      setSubmittingDecision(true);
      setDecisionError(null);
      await recordSpamReviewDecision(selectedReview.id, {
        decision: decisionOutcome,
        decisionReason: decisionReason.trim(),
        notes: reviewNotes.trim() || undefined
      });

      setSelectedReview(null);
      setDecisionReason('');
      setReviewNotes('');
      await loadReviews();
    } catch (err) {
      setDecisionError(err.message || 'Failed to submit review decision');
    } finally {
      setSubmittingDecision(false);
    }
  };

  const filteredReviews = reviews.filter((r) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      r.id?.toLowerCase().includes(q) ||
      r.complaintId?.toLowerCase().includes(q) ||
      r.complaintReference?.toLowerCase().includes(q) ||
      r.departmentId?.toLowerCase().includes(q) ||
      r.reasons?.some((reason) => reason.toLowerCase().includes(q))
    );
  });

  const pendingCount = reviews.filter((r) => {
    const s = r.reviewStatus || r.status;
    return s === 'PENDING' || s === 'PENDING_REVIEW';
  }).length;
  const highRiskCount = reviews.filter((r) => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL').length;
  const legitimateCount = reviews.filter((r) => r.decision === 'LEGITIMATE').length;
  const abuseCount = reviews.filter((r) => r.decision === 'CONFIRMED_ABUSE').length;

  const getRiskLabel = (level) => {
    if (level === 'LOW') return t.spamReview.lowRisk || 'Low';
    if (level === 'MEDIUM') return t.spamReview.mediumRisk || 'Medium';
    if (level === 'HIGH') return t.spamReview.highRisk || 'High';
    if (level === 'CRITICAL') return t.spamReview.criticalRisk || 'Critical';
    return level;
  };

  const getReviewStatusLabel = (statusKey) => {
    if (statusKey === 'PENDING_REVIEW' || statusKey === 'PENDING') return t.spamReview.pendingReview || 'Pending Review';
    if (statusKey === 'IN_REVIEW') return t.spamReview.inReview || 'In Review';
    if (statusKey === 'RESOLVED' || statusKey === 'REVIEWED') return t.common.resolved || 'Resolved';
    return statusKey;
  };

  const getOutcomeLabel = (outcome) => {
    if (outcome === 'LEGITIMATE') return t.spamReview.outcomeLegitimate || 'Legitimate';
    if (outcome === 'NEEDS_MORE_INFORMATION') return t.spamReview.outcomeNeedsInfo || 'Needs Info';
    if (outcome === 'CONFIRMED_ABUSE') return t.spamReview.outcomeConfirmedAbuse || 'Confirmed Abuse';
    if (outcome === 'ESCALATED') return t.spamReview.outcomeEscalate || 'Escalated';
    return outcome;
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-200">
              <ShieldAlert size={22} />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {t.spamReview.deskTitle || 'Spam & Content Screening Review Desk'}
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">
            {t.spamReview.subtitle || 'Human-in-the-loop review queue for grievances flagged by automated content & fraud heuristics.'}
          </p>
          <div className="mt-3 flex items-center gap-3 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 font-medium">
              <Building2 size={13} className="text-slate-500" />
              {t.spamReview.scopeLabel || 'Scope:'} {user?.departmentId ? (t.spamReview.deptScope ? t.spamReview.deptScope.replace('{id}', user.departmentId) : `Department ${user.departmentId}`) : (t.spamReview.allDeptScope || 'All Departments (System Admin)')}
            </span>
            <span className="inline-flex items-center gap-1 text-slate-500">
              <Info size={13} />
              {t.spamReview.fairnessNote || 'Fairness: Civic criticism and regional languages are protected.'}
            </span>
          </div>
        </div>

        <button
          onClick={loadReviews}
          disabled={loading}
          className="self-start md:self-center px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition flex items-center gap-2"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          {t.spamReview.refreshBtn || 'Refresh Queue'}
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>{t.spamReview.pendingReview || 'Pending Review'}</span>
            <Clock size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{pendingCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">{t.spamReview.awaitingOfficer || 'Awaiting officer determination'}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>{t.spamReview.highCriticalRisk || 'High/Critical Risk'}</span>
            <AlertTriangle size={16} className="text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 mt-2">{highRiskCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">{t.spamReview.riskThreshold || 'Score ≥ 60/100 threshold'}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>{t.spamReview.verifiedLegitimate || 'Verified Legitimate'}</span>
            <ShieldCheck size={16} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">{legitimateCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">{t.spamReview.clearedStandard || 'Cleared for standard resolution'}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>{t.spamReview.confirmedAbuse || 'Confirmed Abuse'}</span>
            <XCircle size={16} className="text-slate-500" />
          </div>
          <div className="text-2xl font-bold text-slate-800 mt-2">{abuseCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">{t.spamReview.humanConfirmed || 'Human-confirmed spam/fake'}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t.spamReview.searchPlaceholder || 'Search by complaint ref, review ID, reason...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <Filter size={14} />
            <span>{t.spamReview.statusLabel || 'Status:'}</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">{t.spamReview.allStatuses || 'All Statuses'}</option>
              <option value="PENDING_REVIEW">{t.spamReview.pendingReview || 'Pending Review'}</option>
              <option value="IN_REVIEW">{t.spamReview.inReview || 'In Review'}</option>
              <option value="RESOLVED">{t.common.resolved || 'Resolved'}</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span>{t.spamReview.riskLabel || 'Risk:'}</span>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">{t.spamReview.allRisks || 'All Risk Levels'}</option>
              <option value="LOW">{t.spamReview.lowRisk || 'Low'}</option>
              <option value="MEDIUM">{t.spamReview.mediumRisk || 'Medium'}</option>
              <option value="HIGH">{t.spamReview.highRisk || 'High'}</option>
              <option value="CRITICAL">{t.spamReview.criticalRisk || 'Critical'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3">
          <AlertCircle size={18} className="shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          <RefreshCw size={24} className="animate-spin mx-auto mb-3 text-blue-600" />
          <p className="text-sm font-medium">{t.spamReview.loadingQueue || 'Loading flagged review queue...'}</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          <ShieldCheck size={36} className="mx-auto mb-3 text-emerald-500" />
          <p className="text-base font-semibold text-slate-700">{t.spamReview.noFlaggedFound || 'No flagged complaints found'}</p>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            {t.spamReview.noFlaggedDesc || 'All submitted grievances in your authorized scope are either clean or have already been reviewed by an officer.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">{t.spamReview.thComplaintRef || 'Complaint Reference'}</th>
                  <th className="py-3.5 px-4">{t.spamReview.thDepartment || 'Department'}</th>
                  <th className="py-3.5 px-4">{t.spamReview.thRiskLevel || 'Risk Level & Score'}</th>
                  <th className="py-3.5 px-4">{t.spamReview.thScreeningSignals || 'Screening Signals'}</th>
                  <th className="py-3.5 px-4">{t.spamReview.thStatusDecision || 'Status & Decision'}</th>
                  <th className="py-3.5 px-4">{t.spamReview.thCreated || 'Created'}</th>
                  <th className="py-3.5 px-4 text-right">{t.spamReview.thAction || 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReviews.map((review) => {
                  const riskStyle = RISK_BADGES[review.riskLevel] || RISK_BADGES.MEDIUM;
                  const reviewStatusKey = review.reviewStatus || review.status;
                  const statusStyle = STATUS_BADGES[reviewStatusKey] || STATUS_BADGES.PENDING_REVIEW;
                  const outcomeStyle = OUTCOME_BADGES[review.decision];

                  return (
                    <tr key={review.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/officer/complaints/${review.complaintId}`}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold"
                            title="View complaint detail"
                          >
                            {review.complaintReference || review.complaintId?.slice(0, 8)}
                            <ExternalLink size={12} />
                          </Link>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          ID: {review.id?.slice(0, 12)}...
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                          {review.departmentId || t.spamReview.unassigned || 'Unassigned'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${riskStyle.bg} ${riskStyle.text} ${riskStyle.border}`}
                          >
                            {getRiskLabel(review.riskLevel)}
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-700">
                            {review.score}/100
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1 max-w-xs">
                          {review.reasons && review.reasons.length > 0 ? (
                            review.reasons.slice(0, 2).map((r, idx) => (
                              <div
                                key={idx}
                                className="text-xs text-slate-600 truncate flex items-center gap-1"
                                title={r}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0"></span>
                                <span className="truncate">{r}</span>
                              </div>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 italic">{t.spamReview.noSignals || 'No explicit signals'}</span>
                          )}
                          {review.reasons && review.reasons.length > 2 && (
                            <span className="text-[11px] text-slate-400 font-medium">
                              {t.spamReview.moreSignals ? t.spamReview.moreSignals.replace('{count}', review.reasons.length - 2) : `+${review.reasons.length - 2} more signals`}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                          >
                            {getReviewStatusLabel(reviewStatusKey)}
                          </span>
                          {outcomeStyle && (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${outcomeStyle.bg} ${outcomeStyle.text} ${outcomeStyle.border}`}
                            >
                              {getOutcomeLabel(review.decision)}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {review.createdAt ? formatDate(review.createdAt) : 'N/A'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenReview(review)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition inline-flex items-center gap-1.5"
                        >
                          {t.spamReview.reviewDeskBtn || 'Review Desk'}
                          <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review Modal / Desk View */}
      {selectedReview && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full my-8 max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-lg bg-rose-100 text-rose-700">
                  <ShieldAlert size={20} />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {t.spamReview.modalHeaderTitle ? t.spamReview.modalHeaderTitle.replace('{ref}', selectedReview.complaintReference || selectedReview.complaintId) : `Flagged Complaint Review: ${selectedReview.complaintReference || selectedReview.complaintId}`}
                  </h2>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>{t.spamReview.thReviewId || 'Review ID'}: {selectedReview.id}</span>
                    <span>•</span>
                    <span>{t.spamReview.thDepartment || 'Dept'}: {selectedReview.departmentId}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedReview(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/50 transition"
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Screening Overview Banner */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div>
                  <div className="text-xs font-medium text-slate-500">{t.spamReview.heuristicRisk || 'Heuristic Risk Level'}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        RISK_BADGES[selectedReview.riskLevel]?.bg
                      } ${RISK_BADGES[selectedReview.riskLevel]?.text} ${
                        RISK_BADGES[selectedReview.riskLevel]?.border
                      }`}
                    >
                      {getRiskLabel(selectedReview.riskLevel)}
                    </span>
                    <span className="text-lg font-bold text-slate-900">{selectedReview.score}/100</span>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-slate-500">{t.spamReview.ruleEngineVersion || 'Rule Engine Version'}</div>
                  <div className="text-sm font-semibold text-slate-800 mt-1">
                    {selectedReview.ruleVersion || 'v1.0.0-deterministic'}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-slate-500">{t.spamReview.currentReviewStatus || 'Current Review Status'}</div>
                  <div className="text-sm font-semibold text-slate-800 mt-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    {getReviewStatusLabel(selectedReview.status)}
                  </div>
                </div>
              </div>

              {/* Citizen Reputation Standing (If Available) */}
              {citizenReputation && (
                <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-900">
                      <UserCheck size={15} className="text-blue-600" />
                      {t.spamReview.citizenReputationTitle || 'Citizen Reputation Standing'}
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
                      {t.spamReview.reputationStatus ? t.spamReview.reputationStatus.replace('{status}', citizenReputation.status) : `Status: ${citizenReputation.status}`}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-3 text-xs text-slate-700">
                    <div>
                      <span className="text-slate-500">{t.spamReview.trustScore || 'Trust Score:'}</span>{' '}
                      <span className="font-bold">{citizenReputation.reputationScore}/100</span>
                    </div>
                    <div>
                      <span className="text-slate-500">{t.spamReview.totalGrievances || 'Total Grievances:'}</span>{' '}
                      <span className="font-bold">{citizenReputation.metrics?.totalSubmissions || 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">{t.spamReview.confirmedAbuse || 'Confirmed Abuse:'}</span>{' '}
                      <span className="font-bold text-rose-600">
                        {citizenReputation.metrics?.confirmedAbuseCount || 0}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-blue-800/80 mt-2 italic">
                    {t.spamReview.reputationAuditable || '* Reputation is auditable. Unconfirmed flags never penalize a citizen. Only human-verified abuse modifies standing.'}
                  </p>
                </div>
              )}

              {/* Heuristic Signals Breakdown */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText size={16} className="text-slate-600" />
                  {t.spamReview.signalsEvidenceTitle || 'Screening Signals & Evidence Factors'}
                </h3>

                {/* Data Preservation Guarantee */}
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <ShieldCheck size={16} className="shrink-0 text-emerald-600" />
                  <span>Data Preservation Guarantee: Flagging or reviewing a complaint never deletes, alters, or hides its original filing record or lifecycle history.</span>
                </div>

                {/* Structured Risk Indicators (Feature B Explainability) */}
                {(selectedReview.riskIndicators || selectedReview.complaint?.screeningResult?.riskIndicators) && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Explainable Risk Factors & Heuristic Weights</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {(selectedReview.riskIndicators || selectedReview.complaint?.screeningResult?.riskIndicators || []).map((ind, i) => (
                        <div key={i} className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs flex flex-col gap-1">
                          <div className="flex items-center justify-between font-semibold">
                            <span className="text-slate-900 font-mono">{ind.signal || ind.code}</span>
                            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">+{ind.weight || ind.score} pts</span>
                          </div>
                          <p className="text-slate-700">{ind.description}</p>
                          {ind.evidence && <p className="text-[11px] text-slate-500 font-medium">Evidence: {ind.evidence}</p>}
                          {ind.recommendation && <p className="text-[11px] text-blue-700 font-medium">Recommendation: {ind.recommendation}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedReview.reasons && selectedReview.reasons.length > 0 ? (
                  <div className="space-y-2">
                    {selectedReview.reasons.map((r, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg border border-rose-200 bg-rose-50/60 text-xs text-rose-900 flex items-start gap-2.5"
                      >
                        <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">{r}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">{t.spamReview.noReasons || 'No triggered reason codes available.'}</p>
                )}
              </div>

              {/* Duplicate Reference Candidates */}
              {selectedReview.duplicateCandidates && selectedReview.duplicateCandidates.length > 0 && (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    {t.spamReview.correlatedSubmissions || 'Correlated Existing Submissions (Automated Duplicate Detection)'}
                  </h4>
                  <div className="space-y-1.5">
                    {selectedReview.duplicateCandidates.map((cand, idx) => (
                      <div
                        key={idx}
                        className="text-xs flex items-center justify-between p-2 rounded bg-white border border-slate-200"
                      >
                        <span className="font-mono text-slate-700">
                          {cand.complaintReference || cand.complaintId}
                        </span>
                        <span className="text-slate-500">
                          {t.spamReview.similarity ? t.spamReview.similarity.replace('{pct}', (cand.similarityScore * 100).toFixed(0)) : `Similarity: ${(cand.similarityScore * 100).toFixed(0)}%`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prior Human Review Decisions (Audit History) */}
              {selectedReview.auditTrail && selectedReview.auditTrail.length > 0 && (
                <div className="border-t border-slate-200 pt-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    {t.spamReview.priorDeterminations || 'Prior Review Determinations'}
                  </h4>
                  <div className="space-y-2">
                    {selectedReview.auditTrail.map((ev, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-slate-100 text-xs text-slate-700 border border-slate-200">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-slate-900">{t.spamReview.thStatusDecision || 'Outcome'}: {getOutcomeLabel(ev.decision)}</span>
                          <span className="text-[11px] text-slate-500">
                            {ev.reviewedAt ? formatDate(ev.reviewedAt) : ''}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-600 font-medium">{t.common.reason || 'Reason'}: {ev.decisionReason}</p>
                        {ev.notes && <p className="text-[11px] text-slate-500 mt-0.5">{t.spamReview.notesLabel || 'Notes'}: {ev.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Review Decision Form */}
              <form onSubmit={handleRecordDecision} className="border-t border-slate-200 pt-4 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-blue-600" />
                  {t.spamReview.recordDeterminationTitle || 'Record Officer Review Determination'}
                </h3>

                {decisionError && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle size={15} />
                    <span>{decisionError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.spamReview.outcomeLabel || 'Determination Outcome *'}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setDecisionOutcome('LEGITIMATE')}
                      className={`p-2.5 rounded-lg text-xs font-semibold border text-center transition flex flex-col items-center gap-1 ${
                        decisionOutcome === 'LEGITIMATE'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      {t.spamReview.outcomeLegitimate || 'Legitimate'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setDecisionOutcome('NEEDS_MORE_INFORMATION')}
                      className={`p-2.5 rounded-lg text-xs font-semibold border text-center transition flex flex-col items-center gap-1 ${
                        decisionOutcome === 'NEEDS_MORE_INFORMATION'
                          ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-500'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Info size={16} className="text-blue-600" />
                      {t.spamReview.outcomeNeedsInfo || 'Needs More Info'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setDecisionOutcome('CONFIRMED_ABUSE')}
                      className={`p-2.5 rounded-lg text-xs font-semibold border text-center transition flex flex-col items-center gap-1 ${
                        decisionOutcome === 'CONFIRMED_ABUSE'
                          ? 'bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-500'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <XCircle size={16} className="text-rose-600" />
                      {t.spamReview.outcomeConfirmedAbuse || 'Confirmed Abuse'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setDecisionOutcome('ESCALATED')}
                      className={`p-2.5 rounded-lg text-xs font-semibold border text-center transition flex flex-col items-center gap-1 ${
                        decisionOutcome === 'ESCALATED'
                          ? 'bg-purple-50 border-purple-500 text-purple-800 ring-2 ring-purple-500'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <AlertTriangle size={16} className="text-purple-600" />
                      {t.spamReview.outcomeEscalate || 'Escalate'}
                    </button>
                  </div>
                </div>

                {/* Fairness and consequence notification banner */}
                <div className="p-3 rounded-lg text-xs bg-slate-50 border border-slate-200 text-slate-600">
                  {decisionOutcome === 'LEGITIMATE' && (
                    <span>
                      {t.spamReview.descLegitimate || '✓ Legitimate: Clears the automated screening flag, marks the complaint safe, and preserves standard grievance resolution workflow.'}
                    </span>
                  )}
                  {decisionOutcome === 'NEEDS_MORE_INFORMATION' && (
                    <span>
                      {t.spamReview.descNeedsInfo || 'ℹ Needs More Information: Keeps complaint on hold pending citizen clarification without penalizing reputation.'}
                    </span>
                  )}
                  {decisionOutcome === 'CONFIRMED_ABUSE' && (
                    <span className="text-rose-700 font-medium">
                      {t.spamReview.descAbuse || '⚠ Confirmed Abuse: Explicit human determination of intentional spam/fake grievance. This decision is auditable and updates the citizen reputation ledger.'}
                    </span>
                  )}
                  {decisionOutcome === 'ESCALATED' && (
                    <span>
                      {t.spamReview.descEscalate || '⬆ Escalated: Forwards the suspicious pattern to departmental executive review.'}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.spamReview.justificationLabel || 'Mandatory Officer Justification * (minimum 10 characters)'}
                  </label>
                  <textarea
                    rows={3}
                    value={decisionReason}
                    onChange={(e) => setDecisionReason(e.target.value)}
                    placeholder={t.spamReview.justificationPlaceholder || 'Provide specific justification for this determination (e.g. Ground inspection verified public pothole exists; automated burst flag was caused by weak cellular connection retry).'}
                    className="w-full p-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
                    <span>{t.spamReview.auditRequirement || 'Explainable audit requirement'}</span>
                    <span>{t.spamReview.charCount ? t.spamReview.charCount.replace('{count}', decisionReason.length) : `${decisionReason.length} characters`}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.spamReview.notesLabel || 'Internal Officer Notes (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder={t.spamReview.notesPlaceholder || 'Optional internal notes for audit records'}
                    className="w-full p-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedReview(null)}
                    className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                  >
                    {t.common.cancel || 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={submittingDecision || decisionReason.trim().length < 10}
                    className="px-5 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {submittingDecision ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        {t.spamReview.savingDecision || 'Saving Decision...'}
                      </>
                    ) : (
                      t.spamReview.submitDetermination || 'Submit Determination'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
