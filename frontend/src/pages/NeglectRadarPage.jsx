import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
    try {
      const d = new Date(ts);
      return d.toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch {
      return ts;
    }
  };

  // Risk Level UI Helper
  const getRiskLevelBadge = (level, score) => {
    switch (level) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 border border-rose-200 text-rose-700">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
            Critical Risk ({typeof score === 'number' ? score : '—'})
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 border border-amber-200 text-amber-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            High Risk ({typeof score === 'number' ? score : '—'})
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 border border-blue-200 text-blue-700">
            Medium Risk ({typeof score === 'number' ? score : '—'})
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">
            Low Risk ({typeof score === 'number' ? score : '—'})
          </span>
        );
      case 'INSUFFICIENT_DATA':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 border border-slate-300 text-slate-700" title="Available records do not support a reliable risk score">
            <Info size={11} className="text-slate-500" />
            Insufficient Data
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
            Grievance
          </span>
        );
      case 'INCIDENT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wide">
            <ShieldAlert size={11} />
            Incident
          </span>
        );
      case 'SUBTASK':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-violet-50 text-violet-700 border border-violet-200 uppercase tracking-wide">
            <Layers size={11} />
            Subtask
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
          <p className="text-sm font-medium text-slate-600">Verifying supervisory credentials...</p>
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
        <h2 className="text-xl font-bold text-slate-900">Authentication Required</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Neglect Radar is an internal GovTech operational triage system restricted to authorized Department Officers and Platform Administrators. Please sign in with official credentials.
        </p>
        <div className="pt-2">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            <span>Sign In with Officer Credentials</span>
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
        <h2 className="text-xl font-bold text-slate-900">Supervisory Access Restricted</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Neglect Radar is an internal decision support and supervisory triage tool restricted to Department Officers and System Administrators. Public tracking and citizen accounts do not have access to internal operational scoring.
        </p>
        <div className="pt-2">
          <Link
            to="/citizen"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            <span>Return to Citizen Dashboard</span>
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
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Neglect Radar & Supervisory Monitoring</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Phase 8 Early-Warning
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Automated supervisory anomaly detection for stalled civic grievances, breached SLA targets, and blocked multi-agency dependencies.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
          <div className="text-right hidden sm:block">
            <span className="text-[11px] text-slate-400 block">Department Authorization</span>
            <span className="text-xs font-semibold text-slate-700">
              {isAdmin ? 'Platform Wide (Administrator)' : `Department: ${user?.departmentId || 'Assigned Scope'}`}
            </span>
          </div>

          <button
            type="button"
            onClick={loadNeglectRadar}
            disabled={loading}
            title="Refresh Neglect Radar evaluation"
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium shadow-xs transition disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-blue-600' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Partial Source Failure Warning Banner */}
      {isPartial && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl flex items-start gap-3 shadow-xs">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold">Partial Source Data Warning:</span> One or more underlying repositories were unavailable during this evaluation cycle.
            <div className="mt-1 text-[11px] text-amber-800 flex gap-4">
              <span>Complaints: {sources.complaints?.ok ? 'OK' : 'Unavailable'}</span>
              <span>Incidents: {sources.incidents?.ok ? 'OK' : 'Unavailable'}</span>
              <span>Subtasks: {sources.subtasks?.ok ? 'OK' : 'Unavailable'}</span>
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
              <span className="font-bold">Evaluation Request Failed:</span> {error.message}
              {error.status === 403 && (
                <div className="mt-1 text-[11px] text-rose-700">
                  Access denied by server authorization guard. Ensure you are signed in as an officer or administrator with appropriate department credentials.
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={loadNeglectRadar}
            className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded text-xs font-semibold shrink-0 transition"
          >
            Retry
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
                <span className="text-[11px] font-semibold uppercase tracking-wider">Total Flagged</span>
                <Activity size={15} className="text-blue-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {summary.totalFlagged}
              </div>
              <span className="text-[11px] text-slate-500">Active anomalies</span>
            </div>

            {/* Critical Risk */}
            <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-xs">
              <div className="flex items-center justify-between text-rose-700 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Critical Risk</span>
                <ShieldAlert size={15} className="text-rose-600" />
              </div>
              <div className="text-2xl font-black text-rose-700 tracking-tight">
                {summary.criticalCount}
              </div>
              <span className="text-[11px] text-rose-600 font-medium">Score ≥ 70</span>
            </div>

            {/* High Risk */}
            <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs">
              <div className="flex items-center justify-between text-amber-700 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">High Risk</span>
                <AlertTriangle size={15} className="text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-700 tracking-tight">
                {summary.highCount}
              </div>
              <span className="text-[11px] text-amber-600 font-medium">Score 50–69</span>
            </div>

            {/* Overdue SLA */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Overdue SLA</span>
                <Clock size={15} className="text-rose-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {summary.overdueSlaCount}
              </div>
              <span className="text-[11px] text-slate-500">Target breached</span>
            </div>

            {/* Stalled Progress */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Stalled Cases</span>
                <RotateCcw size={15} className="text-amber-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {summary.staleProgressCount}
              </div>
              <span className="text-[11px] text-slate-500">&gt; 7 days stagnant</span>
            </div>

            {/* Blocked Dependencies */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Blocked Work</span>
                <Lock size={15} className="text-violet-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {summary.blockedDependencyCount}
              </div>
              <span className="text-[11px] text-slate-500">Unresolved blocks</span>
            </div>
          </div>

          {/* Secondary Operational Metrics Bar */}
          <div className="bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4 flex-wrap">
              <span>Medium Risk: <strong className="text-slate-800">{summary.mediumCount}</strong></span>
              <span className="text-slate-300">•</span>
              <span>Low Risk: <strong className="text-slate-800">{summary.lowCount}</strong></span>
              <span className="text-slate-300">•</span>
              <span>Insufficient Data: <strong className="text-slate-800">{summary.insufficientDataCount}</strong></span>
              <span className="text-slate-300">•</span>
              <span>Ping-Pong Loops: <strong className="text-slate-800">{summary.reassignmentLoopCount}</strong></span>
              <span className="text-slate-300">•</span>
              <span>Reopened: <strong className="text-slate-800">{summary.reopenedCount}</strong></span>
              <span className="text-slate-300">•</span>
              <span>Unassigned: <strong className="text-slate-800">{summary.unassignedOwnershipCount}</strong></span>
            </div>
            {evaluatedAt && (
              <span className="text-[11px] text-slate-400">
                Evaluation Reference: {formatTimestamp(evaluatedAt)}
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
            <span>Supervisory Filters &amp; Triage Parameters</span>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition"
            >
              <RotateCcw size={12} />
              <span>Reset all filters</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Entity Type Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Entity Scope</label>
            <select
              value={entityTypeFilter}
              onChange={(e) => {
                setEntityTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Entities (Complaints, Incidents, Subtasks)</option>
              <option value="COMPLAINT">Citizen Grievances only</option>
              <option value="INCIDENT">Parent Incidents only</option>
              <option value="SUBTASK">Subtasks only</option>
            </select>
          </div>

          {/* Risk Level Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Risk Severity</label>
            <select
              value={riskLevelFilter}
              onChange={(e) => {
                setRiskLevelFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="CRITICAL">Critical Risk (Score ≥ 70)</option>
              <option value="HIGH">High Risk (Score 50–69)</option>
              <option value="MEDIUM">Medium Risk (Score 25–49)</option>
              <option value="LOW">Low Risk (Score 0–24)</option>
              <option value="INSUFFICIENT_DATA">Insufficient Data (&lt; 30% complete)</option>
            </select>
          </div>

          {/* Specific Signal Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Triggered Signal</label>
            <select
              value={signalCodeFilter}
              onChange={(e) => {
                setSignalCodeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Signals</option>
              <option value="OVERDUE_SLA">Overdue SLA Target</option>
              <option value="STALE_PROGRESS">Stalled Operational Progress</option>
              <option value="BLOCKED_DEPENDENCY">Blocked Dependency</option>
              <option value="REASSIGNMENT_LOOP">Reassignment Ping-Pong</option>
              <option value="REOPENED_CASE">Reopened Grievance</option>
              <option value="UNASSIGNED_OWNERSHIP">Missing / Unassigned Owner</option>
            </select>
          </div>

          {/* Department Filter (Admin gets dropdown; Officers see locked badge) */}
          <div>
            {isAdmin ? (
              <>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department Scope</label>
                <select
                  value={departmentFilter}
                  onChange={(e) => {
                    setDepartmentFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Departments (Unrestricted)</option>
                  {departments.map((dept) => (
                    <option key={dept.id || dept.code} value={dept.id || dept.code}>
                      {dept.name || dept.id || dept.code}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department Scope</label>
                <div
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 text-slate-700 flex items-center gap-1.5 font-medium cursor-not-allowed"
                  title="Officers are restricted to their authorized department by server policy"
                >
                  <Building2 size={13} className="text-slate-500 shrink-0" />
                  <span className="truncate">{user?.departmentId || 'Officer Scope (Authoritative)'}</span>
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
                placeholder="Search by ID (e.g. CS-2026-0001) or title..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  title="Clear search input"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition shrink-0"
            >
              Search
            </button>
          </form>

          {/* Sort Order & Terminal Records Toggle */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600 shrink-0">Sort:</span>
              <select
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-xs rounded-lg border border-slate-300 px-2.5 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="riskScore_desc">Highest Risk Score</option>
                <option value="riskScore_asc">Lowest Risk Score</option>
                <option value="createdAt_desc">Oldest Registered</option>
                <option value="createdAt_asc">Newest Registered</option>
                <option value="updatedAt_desc">Longest Stalled</option>
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
              <span>Include resolved / closed</span>
            </label>
          </div>
        </div>
      </div>

      {/* Operational Triage Results Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-7 h-7 text-blue-600 animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-700">Evaluating Neglect Radar signals across repositories...</p>
            <p className="text-xs text-slate-500">Checking SLA adherence, progress velocities, and multi-agency dependencies.</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">No Neglect Anomalies Detected</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                {hasActiveFilters
                  ? 'No records match the current filter criteria. Try broadening your entity scope or resetting your filters.'
                  : 'All evaluated civic grievances and incidents are progressing within designated service targets and activity thresholds.'}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
              >
                <RotateCcw size={13} />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3">Entity &amp; Title</th>
                  <th scope="col" className="px-4 py-3">Status / Priority</th>
                  <th scope="col" className="px-4 py-3">Department</th>
                  <th scope="col" className="px-4 py-3">Risk Assessment</th>
                  <th scope="col" className="px-4 py-3">Velocity &amp; Duration</th>
                  <th scope="col" className="px-4 py-3">Triggered Signals</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
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
                          {item.title || '(Untitled record)'}
                        </p>
                        {item.suggestedAction && (
                          <div className="mt-1 text-[11px] text-slate-500 line-clamp-1 italic">
                            Action: {item.suggestedAction}
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
                          <span>{item.departmentId || 'Unassigned'}</span>
                        </span>
                      </td>

                      {/* Risk Assessment */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="space-y-1">
                          <div>{getRiskLevelBadge(item.riskLevel, item.riskScore)}</div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <span>Data completeness:</span>
                            <span className="font-semibold text-slate-700">{item.dataCompleteness}%</span>
                          </div>
                        </div>
                      </td>

                      {/* Velocity & Duration */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-[11px]">
                        <div className="space-y-0.5">
                          <div className="text-slate-700">
                            Registered: <strong className="text-slate-900">{item.evidenceSummary?.elapsedDays ?? '—'}d</strong> ago
                          </div>
                          <div className={isStalled ? 'text-amber-700 font-semibold' : 'text-slate-500'}>
                            No progress: <strong>{item.evidenceSummary?.daysSinceProgress ?? '—'}d</strong>
                          </div>
                          {isOverdue && (
                            <div className="text-rose-700 font-bold flex items-center gap-1">
                              <Clock size={11} />
                              <span>+{item.evidenceSummary.slaOverdueDays}d past target</span>
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
                                title={signal.evidence}
                              >
                                <span>{signal.name}</span>
                                <span className="font-bold text-slate-500">+{signal.points}</span>
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No signals triggered</span>
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
                          <span>Inspect Evidence</span>
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
              Showing <strong className="text-slate-900">{Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}</strong> to{' '}
              <strong className="text-slate-900">{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> of{' '}
              <strong className="text-slate-900">{pagination.total}</strong> results
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Page size:</span>
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
                  title="Previous page"
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
                  title="Next page"
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
                  <p className="text-sm font-semibold text-slate-700">Retrieving safe supervisory evidence...</p>
                  <p className="text-xs text-slate-500">Checking signal evaluations and data completeness.</p>
                </div>
              ) : detailError ? (
                <div className="bg-rose-50 border border-rose-200 text-rose-900 p-4 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <AlertCircle size={16} className="text-rose-600" />
                    <span>Failed to load item evidence</span>
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
                          Supervisory Risk Assessment
                        </span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          {itemDetail.riskScore !== null ? (
                            <>
                              <span className="text-3xl font-black text-white">{itemDetail.riskScore}</span>
                              <span className="text-sm text-slate-400">/ 100</span>
                            </>
                          ) : (
                            <span className="text-lg font-bold text-slate-300">Insufficient Data</span>
                          )}
                        </div>
                      </div>

                      <div>{getRiskLevelBadge(itemDetail.riskLevel, itemDetail.riskScore)}</div>
                    </div>

                    <div className="space-y-1.5 border-t border-slate-800 pt-3">
                      <div className="flex justify-between text-xs text-slate-300">
                        <span>Data Completeness:</span>
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
                          Some signals could not be verified due to incomplete historical records.
                        </p>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-2 leading-relaxed">
                      CivicSarthi supervisory scores are algorithmic operational indicators measuring SLA velocity and activity. They do not constitute allegations of officer negligence or misconduct.
                    </div>
                  </div>

                  {/* Suggested Operational Action Highlight */}
                  {itemDetail.suggestedAction && (
                    <div className="bg-blue-50 border border-blue-200 text-blue-900 p-4 rounded-xl space-y-1.5 shadow-xs">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800">
                        <ArrowRight size={14} className="text-blue-600" />
                        <span>Recommended Operational Action</span>
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
                      <span>Operational Timeline &amp; Context</span>
                    </h3>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-[11px] text-slate-500 block">Total Registered Elapsed</span>
                        <strong className="text-slate-900 text-sm">
                          {itemDetail.evidenceSummary?.elapsedDays ?? '—'} days
                        </strong>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-[11px] text-slate-500 block">Days Since Meaningful Progress</span>
                        <strong className="text-slate-900 text-sm">
                          {itemDetail.evidenceSummary?.daysSinceProgress ?? '—'} days
                        </strong>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-[11px] text-slate-500 block">Authoritative SLA Target</span>
                        <strong className="text-slate-900 text-sm">
                          {itemDetail.evidenceSummary?.slaTargetDays
                            ? `${itemDetail.evidenceSummary.slaTargetDays} days`
                            : 'No authoritative SLA'}
                        </strong>
                        {(itemDetail.evidenceSummary?.slaOverdueDays || 0) > 0 && (
                          <span className="text-[11px] text-rose-600 font-bold block mt-0.5">
                            +{itemDetail.evidenceSummary.slaOverdueDays} days overdue
                          </span>
                        )}
                      </div>

                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-[11px] text-slate-500 block">Department / Assigned Officer</span>
                        <strong className="text-slate-900 text-sm block truncate">
                          {itemDetail.departmentId || 'Unassigned'}
                        </strong>
                        <span className="text-[11px] text-slate-500 block truncate">
                          Officer: {itemDetail.evidenceSummary?.assignedOfficerId || 'None assigned'}
                        </span>
                      </div>
                    </div>

                    {/* Additional entity-specific metrics */}
                    {itemDetail.evidenceSummary?.reassignmentCount > 0 && (
                      <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
                        <strong>Reassignment Count:</strong> Case has been transferred{' '}
                        {itemDetail.evidenceSummary.reassignmentCount} times across departments.
                      </div>
                    )}

                    {itemDetail.evidenceSummary?.isBlocked && (
                      <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 text-xs text-rose-900">
                        <strong>Dependency Block:</strong> {itemDetail.evidenceSummary.blockReason || 'Marked as blocked.'}
                      </div>
                    )}

                    {itemDetail.entityType === 'INCIDENT' && (
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 flex justify-between">
                        <span>Unresolved Subtasks: <strong>{itemDetail.evidenceSummary?.unresolvedSubtaskCount ?? 0}</strong></span>
                        <span>Blocked Subtasks: <strong>{itemDetail.evidenceSummary?.blockedSubtaskCount ?? 0}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Evaluated Signals Breakdown */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <SlidersHorizontal size={13} className="text-blue-600" />
                      <span>Evaluated Risk Signals Breakdown</span>
                    </h3>

                    <div className="space-y-2.5">
                      {itemDetail.signals && itemDetail.signals.map((signal) => (
                        <div
                          key={signal.code}
                          className={`p-3.5 rounded-lg border text-xs transition-colors ${
                            signal.triggered
                              ? 'bg-rose-50/40 border-rose-200'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">{signal.name}</span>
                                {signal.triggered ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                    Triggered (+{signal.points} pts)
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                                    Not triggered (0 / {signal.maxPoints} pts)
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="font-mono text-xs font-bold text-slate-700">
                              {signal.points} / {signal.maxPoints}
                            </span>
                          </div>

                          <p className="text-slate-600 text-[11px] mt-1.5 leading-relaxed bg-white/60 p-2 rounded border border-slate-100">
                            <strong>Evidence:</strong> {signal.evidence}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Missing or Unobserved Signals */}
                  {itemDetail.missingSignals && itemDetail.missingSignals.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Info size={13} className="text-slate-500" />
                        <span>Unobserved / Non-Applicable Signals</span>
                      </h3>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
                        {itemDetail.missingSignals.map((ms) => (
                          <div key={ms.code} className="text-[11px]">
                            • <strong className="text-slate-700">{ms.name}:</strong> {ms.missingReason || 'Not applicable for this entity type'}
                          </div>
                        ))}
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
                            ? 'Open Grievance Management Workspace'
                            : 'Open Parent Incident Cockpit'}
                        </span>
                        <ExternalLink size={14} />
                      </Link>
                    ) : (
                      <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center text-xs text-slate-600">
                        <span className="font-semibold block text-slate-800">Subtask Operational Record</span>
                        <span>
                          Subtask details are fully verified above. Subtasks are coordinated within their parent incident workspace.
                        </span>
                        <div className="mt-2">
                          <Link
                            to="/incident"
                            className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-semibold"
                          >
                            <span>Open Incident Cockpit</span>
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
                Close Evidence Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
