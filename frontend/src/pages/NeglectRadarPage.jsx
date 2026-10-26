import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  fetchNeglectRadar,
  fetchNeglectRadarItem,
  fetchDepartments
} from '../api/client';
import {
  StatusBadge,
  PriorityBadge,
  IncidentStatusBadge,
  SubtaskStatusBadge
} from '../components/StatusBadge';
import {
  AlertTriangle,
  Clock,
  ArrowRight,
  Search,
  Filter,
  RefreshCw,
  Building2,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  X,
  Eye,
  Info,
  Lock,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Activity,
  Layers,
  FileText,
  AlertCircle,
  SlidersHorizontal,
  Check
} from 'lucide-react';

export default function NeglectRadarPage() {
  const { user, isAuthenticated, isOfficer, isAdmin, isCitizen, loading: authLoading } = useAuth();
  const { t, lang, tDepartment, tStatus, tPriority, formatDate } = useLanguage();

  // Data State
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [sources, setSources] = useState({});
  const [isPartial, setIsPartial] = useState(false);
  const [evaluatedAt, setEvaluatedAt] = useState(null);
  const [departments, setDepartments] = useState([]);

  // Loading and Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters State
  const [entityTypeFilter, setEntityTypeFilter] = useState('ALL');
  const [riskLevelFilter, setRiskLevelFilter] = useState('ALL');
  const [signalCodeFilter, setSignalCodeFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('riskScore_desc');
  const [includeTerminal, setIncludeTerminal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Inspection Drawer State
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [itemDetail, setItemDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Load Department list for Admin filter
  useEffect(() => {
    if (isAdmin) {
      fetchDepartments()
        .then((res) => {
          if (res?.data && Array.isArray(res.data)) {
            setDepartments(res.data);
          }
        })
        .catch((err) => {
          console.warn('Could not load departments list for neglect radar filter:', err?.message);
        });
    }
  }, [isAdmin]);

  // Primary Neglect Radar Data Loader
  const loadNeglectRadar = useCallback(async () => {
    if (!isAuthenticated || isCitizen) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = {
        entityType: entityTypeFilter !== 'ALL' ? entityTypeFilter : undefined,
        riskLevel: riskLevelFilter !== 'ALL' ? riskLevelFilter : undefined,
        signalCode: signalCodeFilter || undefined,
        departmentId: isAdmin && departmentFilter ? departmentFilter : undefined,
        search: appliedSearch || undefined,
        sort: sortOrder,
        includeTerminal: includeTerminal ? 'true' : undefined,
        page: currentPage,
        limit: pageSize
      };

      const res = await fetchNeglectRadar(params);
      if (res?.data) {
        setItems(res.data.items || []);
        setSummary(res.data.summary || null);
        setPagination(res.data.pagination || { total: 0, page: 1, limit: pageSize, totalPages: 1 });
        setSources(res.data.sources || {});
        setIsPartial(Boolean(res.data.isPartial));
        setEvaluatedAt(res.data.evaluatedAt || new Date().toISOString());
      }
    } catch (err) {
      console.error('Neglect Radar evaluation error:', err);
      setError({
        message: err.message || 'Failed to load Neglect Radar data from supervisory service.',
        status: err.status || err.response?.status || 500
      });
    } finally {
      setLoading(false);
    }
  }, [
    isAuthenticated,
    isCitizen,
    entityTypeFilter,
    riskLevelFilter,
    signalCodeFilter,
    departmentFilter,
    appliedSearch,
    sortOrder,
    includeTerminal,
    currentPage,
    pageSize,
    isAdmin
  ]);

  useEffect(() => {
    loadNeglectRadar();
  }, [loadNeglectRadar]);

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isDrawerOpen) {
        handleCloseDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen]);

  // Search Submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setAppliedSearch(searchInput.trim());
    setCurrentPage(1);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setAppliedSearch('');
    setCurrentPage(1);
  };

  // Reset all filters to defaults
  const handleResetFilters = () => {
    setEntityTypeFilter('ALL');
    setRiskLevelFilter('ALL');
    setSignalCodeFilter('');
    setDepartmentFilter('');
    setSearchInput('');
    setAppliedSearch('');
    setSortOrder('riskScore_desc');
    setIncludeTerminal(false);
    setCurrentPage(1);
  };

  // Drawer Inspection Handler
  const handleInspectItem = async (item) => {
    setSelectedEntity(item);
    setIsDrawerOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setItemDetail(null);

    try {
      const res = await fetchNeglectRadarItem(item.entityType, item.entityId);
      if (res?.data) {
        setItemDetail(res.data);
      } else {
        throw new Error('Empty response received from supervisory service');
      }
    } catch (err) {
      console.error('Error fetching item details:', err);
      setDetailError(err.message || 'Unable to retrieve evidence details for this record.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedEntity(null);
    setItemDetail(null);
    setDetailError(null);
  };

  // Format Helper for Dates
  const formatTimestamp = (ts) => {
    if (!ts) return '—';
    return formatDate(ts);
  };

  // Risk Level UI Helper
  const getRiskLevelBadge = (level, score) => {
    switch (level) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 border border-rose-200 text-rose-700">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
            {lang === 'hi' ? 'अति-गंभीर जोखिम' : 'Critical Risk'} ({typeof score === 'number' ? score : '—'})
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 border border-amber-200 text-amber-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            {lang === 'hi' ? 'उच्च जोखिम' : 'High Risk'} ({typeof score === 'number' ? score : '—'})
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 border border-blue-200 text-blue-700">
            {lang === 'hi' ? 'मध्यम जोखिम' : 'Medium Risk'} ({typeof score === 'number' ? score : '—'})
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">
            {lang === 'hi' ? 'कम जोखिम' : 'Low Risk'} ({typeof score === 'number' ? score : '—'})
          </span>
        );
      case 'INSUFFICIENT_DATA':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 border border-slate-300 text-slate-700" title="Available records do not support a reliable risk score">
            <Info size={11} className="text-slate-500" />
            {t.neglectRadar.insufficientData}
          </span>
        );
    }
  };

  // Entity Type UI Helper
  const getEntityTypeBadge = (type) => {
    switch (type) {
      case 'COMPLAINT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wide">
            <FileText size={11} />
            {lang === 'hi' ? 'नागरिक शिकायत' : 'Grievance'}
          </span>
        );
      case 'INCIDENT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wide">
            <ShieldAlert size={11} />
            {lang === 'hi' ? 'घटना' : 'Incident'}
          </span>
        );
      case 'SUBTASK':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-violet-50 text-violet-700 border border-violet-200 uppercase tracking-wide">
            <Layers size={11} />
            {lang === 'hi' ? 'उप-कार्य' : 'Subtask'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wide">
            {type}
          </span>
        );
    }
  };

  // Render Status Badge according to Entity Type
  const renderItemStatusBadge = (item) => {
    if (item.entityType === 'INCIDENT') {
      return <IncidentStatusBadge status={item.status} short={true} />;
    }
    if (item.entityType === 'SUBTASK') {
      return <SubtaskStatusBadge status={item.status} />;
    }
    return <StatusBadge status={item.status} />;
  };

  // Determine Safe Workspace Route for Item Navigation
  const getEntityWorkspaceRoute = (item) => {
    if (!item) return null;
    if (item.entityType === 'COMPLAINT') {
      return `/officer/complaints/${encodeURIComponent(item.entityId)}`;
    }
    if (item.entityType === 'INCIDENT') {
      return '/incident';
    }
    // Subtask has no standalone route
    return null;
  };

  // 1. Auth Loading State
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-slate-600">{t.neglectRadar.verifyingCreds}</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Access Block
  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center space-y-4">
        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <Lock size={28} />
        </div>
        <h2 className="text-xl font-bold text-slate-900">{t.neglectRadar.authRequiredTitle}</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          {t.neglectRadar.authRequiredDesc}
        </p>
        <div className="pt-2">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            <span>{t.neglectRadar.signInBtn}</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  // 3. Citizen Role Block
  if (isCitizen) {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center space-y-4">
        <div className="w-14 h-14 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert size={28} />
        </div>
        <h2 className="text-xl font-bold text-slate-900">{t.neglectRadar.accessRestrictedTitle}</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          {t.neglectRadar.accessRestrictedDesc}
        </p>
        <div className="pt-2">
          <Link
            to="/citizen"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            <span>{t.neglectRadar.returnCitizenBtn}</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  const hasActiveFilters =
    entityTypeFilter !== 'ALL' ||
    riskLevelFilter !== 'ALL' ||
    signalCodeFilter !== '' ||
    departmentFilter !== '' ||
    appliedSearch !== '' ||
    includeTerminal;

  return (
    <div className="space-y-6 pb-12">
      {/* Platform Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl shadow-xs">
            <ShieldAlert size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t.neglectRadar.pageTitle}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                {t.neglectRadar.earlyWarningBadge}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              {t.neglectRadar.pageSubtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
          <div className="text-right hidden sm:block">
            <span className="text-[11px] text-slate-400 block">{t.neglectRadar.deptAuth}</span>
            <span className="text-xs font-semibold text-slate-700">
              {isAdmin ? t.neglectRadar.platformWideAdmin : t.neglectRadar.deptScope.replace('{dept}', user?.departmentId || 'Assigned Scope')}
            </span>
          </div>

          <button
            type="button"
            onClick={loadNeglectRadar}
            disabled={loading}
            title={t.neglectRadar.refreshBtn}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium shadow-xs transition disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-blue-600' : ''} />
            <span>{t.neglectRadar.refreshBtn}</span>
          </button>
        </div>
      </div>

      {/* Partial Source Failure Warning Banner */}
      {isPartial && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl flex items-start gap-3 shadow-xs">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold">{lang === 'hi' ? 'आंशिक स्रोत डेटा चेतावनी:' : 'Partial Source Data Warning:'}</span> {t.neglectRadar.partialWarning}
            <div className="mt-1 text-[11px] text-amber-800 flex gap-4">
              <span>{lang === 'hi' ? 'शिकायतें:' : 'Complaints:'} {sources.complaints?.ok ? 'OK' : (lang === 'hi' ? 'अनुपलब्ध' : 'Unavailable')}</span>
              <span>{lang === 'hi' ? 'घटनाएं:' : 'Incidents:'} {sources.incidents?.ok ? 'OK' : (lang === 'hi' ? 'अनुपलब्ध' : 'Unavailable')}</span>
              <span>{lang === 'hi' ? 'उप-कार्य:' : 'Subtasks:'} {sources.subtasks?.ok ? 'OK' : (lang === 'hi' ? 'अनुपलब्ध' : 'Unavailable')}</span>
            </div>
          </div>
        </div>
      )}

      {/* API Level Error Notification */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 p-4 rounded-xl flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold">{t.neglectRadar.evalFailed}</span> {error.message}
              {error.status === 403 && (
                <div className="mt-1 text-[11px] text-rose-700">
                  {t.neglectRadar.accessDenied}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={loadNeglectRadar}
            className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded text-xs font-semibold shrink-0 transition"
          >
            {t.common.retry}
          </button>
        </div>
      )}

      {/* Summary KPI Cards (From server-returned summary) */}
      {summary && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Total Flagged */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">{lang === 'hi' ? 'कुल चिन्हित' : 'Total Flagged'}</span>
                <Activity size={15} className="text-blue-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {summary.totalFlagged}
              </div>
              <span className="text-[11px] text-slate-500">{lang === 'hi' ? 'सक्रिय विसंगतियां' : 'Active anomalies'}</span>
            </div>

            {/* Critical Risk */}
            <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-xs">
              <div className="flex items-center justify-between text-rose-700 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">{t.neglectRadar.criticalRisk}</span>
                <ShieldAlert size={15} className="text-rose-600" />
              </div>
              <div className="text-2xl font-black text-rose-700 tracking-tight">
                {summary.criticalCount}
              </div>
              <span className="text-[11px] text-rose-600 font-medium">{lang === 'hi' ? 'स्कोर ≥ 70' : 'Score ≥ 70'}</span>
            </div>

            {/* High Risk */}
            <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs">
              <div className="flex items-center justify-between text-amber-700 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">{t.neglectRadar.highRisk}</span>
                <AlertTriangle size={15} className="text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-700 tracking-tight">
                {summary.highCount}
              </div>
              <span className="text-[11px] text-amber-600 font-medium">{lang === 'hi' ? 'स्कोर 50–69' : 'Score 50–69'}</span>
            </div>

            {/* Overdue SLA */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">{lang === 'hi' ? 'समयसीमा पार SLA' : 'Overdue SLA'}</span>
                <Clock size={15} className="text-rose-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {summary.overdueSlaCount}
              </div>
              <span className="text-[11px] text-slate-500">{lang === 'hi' ? 'लक्ष्य पार' : 'Target breached'}</span>
            </div>

            {/* Stalled Progress */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">{lang === 'hi' ? 'अवरुद्ध मामले' : 'Stalled Cases'}</span>
                <RotateCcw size={15} className="text-amber-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {summary.staleProgressCount}
              </div>
              <span className="text-[11px] text-slate-500">{lang === 'hi' ? '> 7 दिन से शिथिल' : '> 7 days stagnant'}</span>
            </div>

            {/* Blocked Dependencies */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">{lang === 'hi' ? 'रुका हुआ कार्य' : 'Blocked Work'}</span>
                <Lock size={15} className="text-violet-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {summary.blockedDependencyCount}
              </div>
              <span className="text-[11px] text-slate-500">{lang === 'hi' ? 'अनिस्तारित अवरोध' : 'Unresolved blocks'}</span>
            </div>
          </div>

          {/* Secondary Operational Metrics Bar */}
          <div className="bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4 flex-wrap">
              <span>{lang === 'hi' ? 'मध्यम जोखिम:' : 'Medium Risk:'} <strong className="text-slate-800">{summary.mediumCount}</strong></span>
              <span className="text-slate-300">•</span>
              <span>{lang === 'hi' ? 'कम जोखिम:' : 'Low Risk:'} <strong className="text-slate-800">{summary.lowCount}</strong></span>
              <span className="text-slate-300">•</span>
              <span>{lang === 'hi' ? 'अपर्याप्त डेटा:' : 'Insufficient Data:'} <strong className="text-slate-800">{summary.insufficientDataCount}</strong></span>
              <span className="text-slate-300">•</span>
              <span>{lang === 'hi' ? 'पुनर्आवंटन लूप:' : 'Ping-Pong Loops:'} <strong className="text-slate-800">{summary.reassignmentLoopCount}</strong></span>
              <span className="text-slate-300">•</span>
              <span>{lang === 'hi' ? 'पुनः खोला गया:' : 'Reopened:'} <strong className="text-slate-800">{summary.reopenedCount}</strong></span>
              <span className="text-slate-300">•</span>
              <span>{lang === 'hi' ? 'अनावंटित:' : 'Unassigned:'} <strong className="text-slate-800">{summary.unassignedOwnershipCount}</strong></span>
            </div>
            {evaluatedAt && (
              <span className="text-[11px] text-slate-400">
                {lang === 'hi' ? 'मूल्यांकन संदर्भ:' : 'Evaluation Reference:'} {formatTimestamp(evaluatedAt)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Filter and Search Controls */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
            <SlidersHorizontal size={14} className="text-blue-600" />
            <span>{lang === 'hi' ? 'पर्यवेक्षी फिल्टर एवं छंटनी पैरामीटर' : 'Supervisory Filters & Triage Parameters'}</span>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition"
            >
              <RotateCcw size={12} />
              <span>{lang === 'hi' ? 'सभी फिल्टर रीसेट करें' : 'Reset all filters'}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Entity Type Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">{t.neglectRadar.entityType}</label>
            <select
              value={entityTypeFilter}
              onChange={(e) => {
                setEntityTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">{lang === 'hi' ? 'सभी इकाइयां (शिकायतें, घटनाएं, उप-कार्य)' : 'All Entities (Complaints, Incidents, Subtasks)'}</option>
              <option value="COMPLAINT">{t.neglectRadar.complaintsOnly}</option>
              <option value="INCIDENT">{t.neglectRadar.incidentsOnly}</option>
              <option value="SUBTASK">{t.neglectRadar.subtasksOnly}</option>
            </select>
          </div>

          {/* Risk Level Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">{t.neglectRadar.riskFilter}</label>
            <select
              value={riskLevelFilter}
              onChange={(e) => {
                setRiskLevelFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">{t.neglectRadar.allRisks}</option>
              <option value="CRITICAL">{lang === 'hi' ? 'अति-गंभीर जोखिम (स्कोर ≥ 70)' : 'Critical Risk (Score ≥ 70)'}</option>
              <option value="HIGH">{lang === 'hi' ? 'उच्च जोखिम (स्कोर 50–69)' : 'High Risk (Score 50–69)'}</option>
              <option value="MEDIUM">{lang === 'hi' ? 'मध्यम जोखिम (स्कोर 25–49)' : 'Medium Risk (Score 25–49)'}</option>
              <option value="LOW">{lang === 'hi' ? 'कम जोखिम (स्कोर 0–24)' : 'Low Risk (Score 0–24)'}</option>
              <option value="INSUFFICIENT_DATA">{lang === 'hi' ? 'अपर्याप्त डेटा (< 30% पूर्ण)' : 'Insufficient Data (< 30% complete)'}</option>
            </select>
          </div>

          {/* Specific Signal Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">{t.neglectRadar.signalFilter}</label>
            <select
              value={signalCodeFilter}
              onChange={(e) => {
                setSignalCodeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t.neglectRadar.allSignals}</option>
              <option value="OVERDUE_SLA">{lang === 'hi' ? 'समयसीमा पार SLA लक्ष्य' : 'Overdue SLA Target'}</option>
              <option value="STALE_PROGRESS">{lang === 'hi' ? 'शिथिल परिचालन प्रगति' : 'Stalled Operational Progress'}</option>
              <option value="BLOCKED_DEPENDENCY">{lang === 'hi' ? 'अवरुद्ध निर्भरता' : 'Blocked Dependency'}</option>
              <option value="REASSIGNMENT_LOOP">{lang === 'hi' ? 'पुनर्आवंटन पिंग-पॉन्ग' : 'Reassignment Ping-Pong'}</option>
              <option value="REOPENED_CASE">{lang === 'hi' ? 'पुनः खोली गई शिकायत' : 'Reopened Grievance'}</option>
              <option value="UNASSIGNED_OWNERSHIP">{lang === 'hi' ? 'लापता / अनावंटित उत्तरदायित्व' : 'Missing / Unassigned Owner'}</option>
            </select>
          </div>

          {/* Department Filter (Admin gets dropdown; Officers see locked badge) */}
          <div>
            {isAdmin ? (
              <>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.common.department}</label>
                <select
                  value={departmentFilter}
                  onChange={(e) => {
                    setDepartmentFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{lang === 'hi' ? 'सभी विभाग (अप्रतिबंधित)' : 'All Departments (Unrestricted)'}</option>
                  {departments.map((dept) => (
                    <option key={dept.id || dept.code} value={dept.id || dept.code}>
                      {tDepartment(dept.name || dept.id || dept.code)}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.common.department}</label>
                <div
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 text-slate-700 flex items-center gap-1.5 font-medium cursor-not-allowed"
                  title="Officers are restricted to their authorized department by server policy"
                >
                  <Building2 size={13} className="text-slate-500 shrink-0" />
                  <span className="truncate">{user?.departmentId ? tDepartment(user.departmentId) : (lang === 'hi' ? 'अधिकारी कार्यक्षेत्र' : 'Officer Scope (Authoritative)')}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Search, Sort, and Terminal Toggle Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
          {/* Explicit Search Action */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-lg">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={t.neglectRadar.searchPlaceholder}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  title={t.common.clear}
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition shrink-0"
            >
              {t.common.search}
            </button>
          </form>

          {/* Sort Order & Terminal Records Toggle */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600 shrink-0">{t.neglectRadar.sortBy}</span>
              <select
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-xs rounded-lg border border-slate-300 px-2.5 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="riskScore_desc">{t.neglectRadar.riskDesc}</option>
                <option value="riskScore_asc">{t.neglectRadar.riskAsc}</option>
                <option value="createdAt_desc">{lang === 'hi' ? 'सबसे पुरानी पंजीकृत' : 'Oldest Registered'}</option>
                <option value="createdAt_asc">{lang === 'hi' ? 'नवीनतम पंजीकृत' : 'Newest Registered'}</option>
                <option value="updatedAt_desc">{t.neglectRadar.stalledDesc}</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeTerminal}
                onChange={(e) => {
                  setIncludeTerminal(e.target.checked);
                  setCurrentPage(1);
                }}
                className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
              />
              <span>{t.neglectRadar.terminalPill}</span>
            </label>
          </div>
        </div>
      </div>

      {/* Operational Triage Results Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-7 h-7 text-blue-600 animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-700">{t.neglectRadar.evaluatingSignals}</p>
            <p className="text-xs text-slate-500">{t.neglectRadar.evaluatingSubtitle}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{t.neglectRadar.noAnomaliesTitle}</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                {hasActiveFilters
                  ? t.neglectRadar.noFilterMatchDesc
                  : t.neglectRadar.allHealthyDesc}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
              >
                <RotateCcw size={13} />
                <span>{t.neglectRadar.resetFilters}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3">{t.neglectRadar.thEntity}</th>
                  <th scope="col" className="px-4 py-3">{t.neglectRadar.thStatus}</th>
                  <th scope="col" className="px-4 py-3">{t.neglectRadar.thDepartment}</th>
                  <th scope="col" className="px-4 py-3">{t.neglectRadar.thRiskScore}</th>
                  <th scope="col" className="px-4 py-3">{t.neglectRadar.thAge}</th>
                  <th scope="col" className="px-4 py-3">{t.neglectRadar.thSignals}</th>
                  <th scope="col" className="px-4 py-3 text-right">{t.neglectRadar.thAction}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const isBlocked = item.evidenceSummary?.isBlocked || false;
                  const isOverdue = (item.evidenceSummary?.slaOverdueDays || 0) > 0;
                  const isStalled = (item.evidenceSummary?.daysSinceProgress || 0) >= 7;

                  return (
                    <tr key={`${item.entityType}-${item.entityId}`} className="hover:bg-slate-50/80 transition-colors">
                      {/* Entity & Title */}
                      <td className="px-4 py-3.5 max-w-xs">
                        <div className="flex items-center gap-1.5 mb-1">
                          {getEntityTypeBadge(item.entityType)}
                          <span className="font-mono text-xs font-bold text-slate-900">{item.entityId}</span>
                        </div>
                        <p className="text-xs font-medium text-slate-800 line-clamp-1" title={item.title}>
                          {item.title || `(${lang === 'hi' ? 'अनाम रिकॉर्ड' : 'Untitled record'})`}
                        </p>
                        {item.suggestedAction && (
                          <div className="mt-1 text-[11px] text-slate-500 line-clamp-1 italic">
                            {lang === 'hi' ? 'कार्रवाई:' : 'Action:'} {item.suggestedAction}
                          </div>
                        )}
                      </td>

                      {/* Status / Priority */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="space-y-1">
                          <div>{renderItemStatusBadge(item)}</div>
                          <div><PriorityBadge priority={item.priority} /></div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                          <Building2 size={12} className="text-slate-400" />
                          <span>{tDepartment(item.departmentId) || item.departmentId || (lang === 'hi' ? 'अनअसाइंड' : 'Unassigned')}</span>
                        </span>
                      </td>

                      {/* Risk Assessment */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="space-y-1">
                          <div>{getRiskLevelBadge(item.riskLevel, item.riskScore)}</div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <span>{t.neglectRadar.dataCompleteness}</span>
                            <span className="font-semibold text-slate-700">{item.dataCompleteness}%</span>
                          </div>
                        </div>
                      </td>

                      {/* Velocity & Duration */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-[11px]">
                        <div className="space-y-0.5">
                          <div className="text-slate-700">
                            {t.neglectRadar.registeredAgo.replace('{days}', item.evidenceSummary?.elapsedDays ?? '—')}
                          </div>
                          <div className={isStalled ? 'text-amber-700 font-semibold' : 'text-slate-500'}>
                            {t.neglectRadar.noProgressDays.replace('{days}', item.evidenceSummary?.daysSinceProgress ?? '—')}
                          </div>
                          {isOverdue && (
                            <div className="text-rose-700 font-bold flex items-center gap-1">
                              <Clock size={11} />
                              <span>{t.neglectRadar.pastTargetDays.replace('{days}', item.evidenceSummary.slaOverdueDays)}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Triggered Signals */}
                      <td className="px-4 py-3.5 max-w-sm">
                        <div className="flex flex-wrap gap-1">
                          {item.triggeredSignals && item.triggeredSignals.length > 0 ? (
                            item.triggeredSignals.map((signal) => (
                              <span
                                key={signal.code}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200"
                                title={signal.message || (typeof signal.evidence === 'object' ? JSON.stringify(signal.evidence) : String(signal.evidence || ''))}
                              >
                                <span>{signal.name}</span>
                                <span className="font-bold text-slate-500">+{signal.points}</span>
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">{t.neglectRadar.noSignalsTriggered}</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleInspectItem(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition"
                        >
                          <Eye size={13} />
                          <span>{t.neglectRadar.inspectEvidence}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination && pagination.total > 0 && (
          <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              {t.neglectRadar.showingResults
                .replace('{from}', Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total))
                .replace('{to}', Math.min(pagination.page * pagination.limit, pagination.total))
                .replace('{total}', pagination.total)}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">{t.neglectRadar.pageSize}</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(parseInt(e.target.value, 10));
                    setCurrentPage(1);
                  }}
                  className="rounded border border-slate-300 bg-white text-xs px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1}
                  className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  title={t.neglectRadar.prevPage}
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-2 font-medium text-slate-700">
                  {pagination.page} / {pagination.totalPages || 1}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages || 1, p + 1))}
                  disabled={pagination.page >= (pagination.totalPages || 1)}
                  className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  title={t.neglectRadar.nextPage}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over Detail Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex justify-end transition-opacity">
          <div
            className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedEntity && getEntityTypeBadge(selectedEntity.entityType)}
                  <span className="font-mono text-sm font-black text-slate-900" id="drawer-title">
                    {selectedEntity?.entityId}
                  </span>
                  {selectedEntity && renderItemStatusBadge(selectedEntity)}
                </div>
                <h2 className="text-base font-bold text-slate-900 leading-snug">
                  {itemDetail?.title || selectedEntity?.title || '(Untitled record)'}
                </h2>
              </div>

              <button
                type="button"
                onClick={handleCloseDrawer}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
                title="Close drawer"
                aria-label="Close detail view"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {detailLoading ? (
                <div className="py-20 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                  <p className="text-sm font-semibold text-slate-700">{t.neglectRadar.retrievingEvidence}</p>
                  <p className="text-xs text-slate-500">{t.neglectRadar.retrievingSubtitle}</p>
                </div>
              ) : detailError ? (
                <div className="bg-rose-50 border border-rose-200 text-rose-900 p-4 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <AlertCircle size={16} className="text-rose-600" />
                    <span>{t.neglectRadar.failedToLoadEvidence}</span>
                  </div>
                  <p className="text-xs text-rose-700">{detailError}</p>
                </div>
              ) : itemDetail ? (
                <>
                  {/* Risk Scorecard & Neutral Statement */}
                  <div className="bg-slate-900 text-white p-5 rounded-xl space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                          {t.neglectRadar.supervisoryRiskAssessment}
                        </span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          {itemDetail.riskScore !== null ? (
                            <>
                              <span className="text-3xl font-black text-white">{itemDetail.riskScore}</span>
                              <span className="text-sm text-slate-400">/ 100</span>
                            </>
                          ) : (
                            <span className="text-lg font-bold text-slate-300">{t.neglectRadar.insufficientData}</span>
                          )}
                        </div>
                      </div>

                      <div>{getRiskLevelBadge(itemDetail.riskLevel, itemDetail.riskScore)}</div>
                    </div>

                    <div className="space-y-1.5 border-t border-slate-800 pt-3">
                      <div className="flex justify-between text-xs text-slate-300">
                        <span>{t.neglectRadar.dataCompleteness}</span>
                        <span className="font-semibold text-white">{itemDetail.dataCompleteness}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(100, itemDetail.dataCompleteness)}%` }}
                        ></div>
                      </div>
                      {itemDetail.dataCompleteness < 100 && (
                        <p className="text-[11px] text-slate-400">
                          {t.neglectRadar.someSignalsUnverified}
                        </p>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-2 leading-relaxed">
                      {t.neglectRadar.neutralDisclaimer}
                    </div>
                  </div>

                  {/* Suggested Operational Action Highlight */}
                  {itemDetail.suggestedAction && (
                    <div className="bg-blue-50 border border-blue-200 text-blue-900 p-4 rounded-xl space-y-1.5 shadow-xs">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800">
                        <ArrowRight size={14} className="text-blue-600" />
                        <span>{t.neglectRadar.recommendedOperationalAction}</span>
                      </div>
                      <p className="text-xs text-blue-950 font-medium leading-relaxed">
                        {itemDetail.suggestedAction}
                      </p>
                    </div>
                  )}

                  {/* Operational Timeline & Evidence Context */}
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock size={13} className="text-blue-600" />
                      <span>{t.neglectRadar.operationalTimelineContext}</span>
                    </h3>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-[11px] text-slate-500 block">{t.neglectRadar.totalRegisteredElapsed}</span>
                        <strong className="text-slate-900 text-sm">
                          {itemDetail.evidenceSummary?.elapsedDays != null ? `${itemDetail.evidenceSummary.elapsedDays} ${lang === 'hi' ? 'दिन' : 'days'}` : '—'}
                        </strong>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-[11px] text-slate-500 block">{t.neglectRadar.daysSinceProgress}</span>
                        <strong className="text-slate-900 text-sm">
                          {itemDetail.evidenceSummary?.daysSinceProgress != null ? `${itemDetail.evidenceSummary.daysSinceProgress} ${lang === 'hi' ? 'दिन' : 'days'}` : '—'}
                        </strong>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-[11px] text-slate-500 block">{t.neglectRadar.authoritativeSlaTarget}</span>
                        <strong className="text-slate-900 text-sm">
                          {itemDetail.evidenceSummary?.slaTargetDays
                            ? `${itemDetail.evidenceSummary.slaTargetDays} ${lang === 'hi' ? 'दिन' : 'days'}`
                            : t.neglectRadar.noAuthoritativeSla}
                        </strong>
                        {(itemDetail.evidenceSummary?.slaOverdueDays || 0) > 0 && (
                          <span className="text-[11px] text-rose-600 font-bold block mt-0.5">
                            {t.neglectRadar.daysOverdue.replace('{days}', itemDetail.evidenceSummary.slaOverdueDays)}
                          </span>
                        )}
                      </div>

                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-[11px] text-slate-500 block">{t.neglectRadar.deptAssignedOfficer}</span>
                        <strong className="text-slate-900 text-sm block truncate">
                          {tDepartment(itemDetail.departmentId) || itemDetail.departmentId || (lang === 'hi' ? 'अनअसाइंड' : 'Unassigned')}
                        </strong>
                        <span className="text-[11px] text-slate-500 block truncate">
                          {itemDetail.evidenceSummary?.assignedOfficerId
                            ? `${lang === 'hi' ? 'अधिकारी:' : 'Officer:'} ${itemDetail.evidenceSummary.assignedOfficerId}`
                            : t.neglectRadar.officerNoneAssigned}
                        </span>
                      </div>
                    </div>

                    {/* Additional entity-specific metrics */}
                    {itemDetail.evidenceSummary?.reassignmentCount > 0 && (
                      <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
                        {t.neglectRadar.reassignmentNote.replace('{count}', itemDetail.evidenceSummary.reassignmentCount)}
                      </div>
                    )}

                    {itemDetail.evidenceSummary?.isBlocked && (
                      <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 text-xs text-rose-900">
                        {t.neglectRadar.dependencyBlock.replace('{reason}', itemDetail.evidenceSummary.blockReason || (lang === 'hi' ? 'अवरुद्ध चिह्नित।' : 'Marked as blocked.'))}
                      </div>
                    )}

                    {itemDetail.entityType === 'INCIDENT' && (
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 flex justify-between">
                        <span>{t.neglectRadar.unresolvedSubtasks.replace('{count}', itemDetail.evidenceSummary?.unresolvedSubtaskCount ?? 0)}</span>
                        <span>{t.neglectRadar.blockedSubtasks.replace('{count}', itemDetail.evidenceSummary?.blockedSubtaskCount ?? 0)}</span>
                      </div>
                    )}
                  </div>

                  {/* Evaluated Signals Breakdown */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <SlidersHorizontal size={13} className="text-blue-600" />
                      <span>{t.neglectRadar.evaluatedSignalsBreakdown}</span>
                    </h3>

                    <div className="space-y-2.5">
                      {itemDetail.signals && itemDetail.signals.map((signal) => {
                        const isTriggered = Boolean(signal.isTriggered || signal.triggered);
                        return (
                          <div
                            key={signal.code}
                            className={`p-3.5 rounded-lg border text-xs transition-colors ${
                              isTriggered
                                ? 'bg-rose-50/40 border-rose-200'
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900">{signal.name}</span>
                                  {isTriggered ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                      {t.neglectRadar.signalTriggeredPoints.replace('{points}', signal.points)}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                                      {t.neglectRadar.signalNotTriggered.replace('{maxPoints}', signal.maxPoints)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="font-mono text-xs font-bold text-slate-700">
                                {signal.points} / {signal.maxPoints}
                              </span>
                            </div>

                            <div className="text-slate-600 text-[11px] mt-1.5 leading-relaxed bg-white/60 p-2.5 rounded-lg border border-slate-100 space-y-1.5">
                              {signal.message && (
                                <p className="text-slate-800 font-medium leading-snug">
                                  {signal.message}
                                </p>
                              )}
                              {signal.evidence && typeof signal.evidence === 'object' ? (
                                <div className="pt-1 border-t border-slate-100/80">
                                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                                    {t.neglectRadar.telemetryParams}
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(signal.evidence).map(([k, v]) => (
                                      <span
                                        key={k}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-mono border border-slate-200"
                                      >
                                        <span className="text-slate-500 font-semibold">{k}:</span>
                                        <span className="font-bold">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : signal.evidence ? (
                                <p className="text-slate-700">
                                  <strong>{lang === 'hi' ? 'साक्ष्य:' : 'Evidence:'}</strong> {String(signal.evidence)}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Missing or Unobserved Signals */}
                  {itemDetail.missingSignals && itemDetail.missingSignals.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Info size={13} className="text-slate-500" />
                        <span>{t.neglectRadar.unobservedSignals}</span>
                      </h3>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
                        {itemDetail.missingSignals.map((ms, idx) => {
                          const code = typeof ms === 'object' ? (ms.code || idx) : ms;
                          const name = typeof ms === 'object' ? (ms.name || ms.code) : ms;
                          const reason = typeof ms === 'object' ? (ms.missingReason || ms.reason || (lang === 'hi' ? 'इस इकाई प्रकार के लिए लागू नहीं' : 'Not applicable for this entity type')) : (lang === 'hi' ? 'इस इकाई प्रकार के लिए लागू नहीं' : 'Not applicable for this entity type');
                          return (
                            <div key={code} className="text-[11px]">
                              • <strong className="text-slate-700">{name}:</strong> {reason}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Direct Workspace Navigation Links */}
                  <div className="border-t border-slate-200 pt-4">
                    {getEntityWorkspaceRoute(itemDetail) ? (
                      <Link
                        to={getEntityWorkspaceRoute(itemDetail)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                      >
                        <span>
                          {itemDetail.entityType === 'COMPLAINT'
                            ? t.neglectRadar.openGrievanceWorkspace
                            : t.neglectRadar.openParentIncidentCockpit}
                        </span>
                        <ExternalLink size={14} />
                      </Link>
                    ) : (
                      <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center text-xs text-slate-600">
                        <span className="font-semibold block text-slate-800">{t.neglectRadar.subtaskRecordTitle}</span>
                        <span>
                          {t.neglectRadar.subtaskRecordDesc}
                        </span>
                        <div className="mt-2">
                          <Link
                            to="/incident"
                            className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-semibold"
                          >
                            <span>{t.neglectRadar.openIncidentCockpit}</span>
                            <ArrowRight size={13} />
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={handleCloseDrawer}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-xs transition"
              >
                {t.neglectRadar.closeEvidencePanel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
