import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Download,
  Filter,
  RefreshCw,
  Building2,
  Calendar,
  Layers,
  ShieldCheck,
  ShieldAlert,
  Info,
  HelpCircle,
  FileSpreadsheet,
  ChevronDown,
  RotateCcw,
  MessageSquareQuote,
  BellRing,
  Star,
  MapPin
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  fetchAnalyticsOverview,
  fetchAnalyticsTrends,
  fetchAnalyticsDepartments,
  fetchAnalyticsCategories,
  fetchAnalyticsWorkflow,
  exportAnalyticsReport,
  fetchDepartments
} from '../api/client';

const STATUS_COLORS = {
  SUBMITTED: '#3b82f6',
  UNDER_REVIEW: '#f59e0b',
  ASSIGNED: '#8b5cf6',
  IN_PROGRESS: '#0284c7',
  AWAITING_INFORMATION: '#ec4899',
  RESOLVED: '#10b981',
  CLOSED: '#64748b',
  REOPENED: '#ef4444'
};

const PRIORITY_COLORS = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#f97316',
  CRITICAL: '#ef4444'
};

export default function AnalyticsDashboardPage() {
  const { user, isAdmin, isOfficer } = useAuth();
  const { t, lang, tDepartment, tCategory, tStatus, tPriority } = useLanguage();

  // Filter States
  const [datePreset, setDatePreset] = useState('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [trendInterval, setTrendInterval] = useState('day');

  // Directory States
  const [departmentsList, setDepartmentsList] = useState([]);

  // Analytics Data States
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState([]);
  const [deptPerformance, setDeptPerformance] = useState([]);
  const [catGeography, setCatGeography] = useState(null);
  const [workflow, setWorkflow] = useState(null);

  // UI States
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);

  // Set date ranges according to preset
  const handleDatePreset = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    let start = '';
    let end = now.toISOString().slice(0, 10);

    if (preset === '7d') {
      const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      start = d.toISOString().slice(0, 10);
    } else if (preset === '30d') {
      const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      start = d.toISOString().slice(0, 10);
    } else if (preset === '90d') {
      const d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      start = d.toISOString().slice(0, 10);
    } else if (preset === 'all') {
      start = '';
      end = '';
    }

    setStartDate(start);
    setEndDate(end);
  };

  // Initial load
  useEffect(() => {
    handleDatePreset('30d');
    loadDepartmentDirectory();
  }, []);

  // Fetch whenever filters change
  useEffect(() => {
    loadAllAnalytics();
  }, [startDate, endDate, selectedDepartment, selectedCategory, trendInterval]);

  async function loadDepartmentDirectory() {
    try {
      const res = await fetchDepartments();
      if (res?.data) {
        setDepartmentsList(res.data);
      }
    } catch {
      // non-fatal fallback
    }
  }

  const queryParams = useMemo(() => {
    const params = {};
    if (startDate) params.startDate = `${startDate}T00:00:00.000Z`;
    if (endDate) params.endDate = `${endDate}T23:59:59.999Z`;
    if (selectedDepartment && selectedDepartment !== 'ALL') {
      params.departmentId = selectedDepartment;
    }
    if (selectedCategory && selectedCategory !== 'ALL') {
      params.category = selectedCategory;
    }
    return params;
  }, [startDate, endDate, selectedDepartment, selectedCategory]);

  async function loadAllAnalytics() {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, trendsRes, deptRes, catRes, workflowRes] = await Promise.all([
        fetchAnalyticsOverview(queryParams),
        fetchAnalyticsTrends({ ...queryParams, interval: trendInterval }),
        fetchAnalyticsDepartments(queryParams),
        fetchAnalyticsCategories(queryParams),
        fetchAnalyticsWorkflow(queryParams)
      ]);

      setOverview(overviewRes.data);
      setTrends(trendsRes.data?.trends || []);
      setDeptPerformance(deptRes.data?.departments || []);
      setCatGeography(catRes.data);
      setWorkflow(workflowRes.data);
    } catch (err) {
      console.error('Failed to load analytics data:', err);
      setError(err.message || 'Failed to fetch analytics metrics from server');
    } finally {
      setLoading(false);
    }
  }

  // Handle CSV Export
  async function handleExport(reportType = 'all') {
    setShowExportMenu(false);
    setExporting(true);
    try {
      const response = await exportAnalyticsReport({
        ...queryParams,
        reportType,
        format: 'csv'
      });

      // Create a blob link and trigger browser download
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filenameDate = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.setAttribute('download', `civicsarthi_analytics_${reportType}_${filenameDate}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert(`Export failed: ${err.message || 'Unable to download CSV report'}`);
    } finally {
      setExporting(false);
    }
  }

  // Derived metrics for UI
  const metrics = overview?.metrics || {};
  const comparison = overview?.comparison || {};

  // Status chart data
  const statusChartData = useMemo(() => {
    if (!workflow?.statusDistribution) return [];
    return Object.entries(workflow.statusDistribution).map(([status, count]) => ({
      name: tStatus(status),
      status,
      count,
      fill: STATUS_COLORS[status] || '#64748b'
    }));
  }, [workflow, lang]);

  // Priority chart data
  const priorityChartData = useMemo(() => {
    if (!catGeography?.priorities) return [];
    return Object.entries(catGeography.priorities).map(([priority, count]) => ({
      name: tPriority(priority),
      priority,
      count,
      fill: PRIORITY_COLORS[priority] || '#64748b'
    }));
  }, [catGeography, lang]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header & Controls Strip */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-600/30 text-blue-400 rounded-lg border border-blue-500/40">
                <BarChart3 size={24} />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  {t.analytics.title}
                </h1>
                <p className="text-xs sm:text-sm text-slate-400">
                  {t.analytics.subtitle}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons: Export & Refresh */}
          <div className="flex items-center gap-2.5 self-start lg:self-auto">
            <button
              type="button"
              onClick={loadAllAnalytics}
              disabled={loading}
              title={t.analytics.refreshBtn}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>{t.analytics.refreshBtn}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowGlossary(!showGlossary)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
            >
              <HelpCircle size={14} className="text-blue-400" />
              <span>{t.analytics.formulasGlossaryBtn}</span>
            </button>

            {/* Export Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={exporting}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition"
              >
                <Download size={14} />
                <span>{exporting ? t.analytics.generatingCsv : t.analytics.exportReportBtn}</span>
                <ChevronDown size={12} />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-30 py-1.5 text-xs text-slate-200">
                  <div className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-slate-700/60">
                    {t.analytics.csvFormats}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExport('all')}
                    className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-2 text-slate-200 font-medium"
                  >
                    <FileSpreadsheet size={13} className="text-emerald-400" />
                    {t.analytics.fullReport}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('overview')}
                    className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-2 text-slate-200"
                  >
                    <BarChart3 size={13} className="text-blue-400" />
                    {t.analytics.executiveKpi}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('departments')}
                    className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-2 text-slate-200"
                  >
                    <Building2 size={13} className="text-indigo-400" />
                    {t.analytics.deptPerfTable}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('categories')}
                    className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-2 text-slate-200"
                  >
                    <Layers size={13} className="text-amber-400" />
                    {t.analytics.catGeoReport}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('workflow')}
                    className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-2 text-slate-200"
                  >
                    <CheckCircle2 size={13} className="text-pink-400" />
                    {t.analytics.workflowQualityReport}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. Interactive Filter Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
          {/* Preset Date Range Chips */}
          <div className="md:col-span-5 flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 text-[11px] font-semibold mr-1">{t.analytics.timeframe}</span>
            {[
              { id: '7d', label: t.analytics.preset7d },
              { id: '30d', label: t.analytics.preset30d },
              { id: '90d', label: t.analytics.preset90d },
              { id: 'all', label: t.analytics.presetAllTime }
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleDatePreset(p.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                  datePreset === p.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs */}
          <div className="md:col-span-3 flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setDatePreset('custom');
                setStartDate(e.target.value);
              }}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs w-full focus:outline-none focus:border-blue-500"
              title="Start Date"
            />
            <span className="text-slate-500 text-[10px]">{t.analytics.to}</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setDatePreset('custom');
                setEndDate(e.target.value);
              }}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs w-full focus:outline-none focus:border-blue-500"
              title="End Date"
            />
          </div>

          {/* Department Filter (Admin) or Scope Badge (Officer) */}
          <div className="md:col-span-2">
            {isAdmin ? (
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">{t.analytics.allDepartments}</option>
                {departmentsList.map((d) => (
                  <option key={d.id} value={d.id}>
                    {tDepartment(d.code || d.name)}
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 flex items-center gap-1.5 text-xs">
                <Building2 size={12} className="text-blue-400" />
                <span className="truncate">{user?.departmentId ? tDepartment(user.departmentId) : tDepartment('Assigned Department')}</span>
              </div>
            )}
          </div>

          {/* Category Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">{t.analytics.allCategories}</option>
              {['roads', 'electricity', 'water', 'healthcare', 'pension', 'scholarship', 'ration', 'municipal'].map(
                (c) => (
                  <option key={c} value={c}>
                    {tCategory(c)}
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Metric Definitions Drawer (Optional) */}
      {showGlossary && (
        <div className="bg-slate-800 border border-blue-900/50 rounded-xl p-5 text-slate-300 text-xs shadow-md space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-700">
            <div className="flex items-center gap-2 font-bold text-white text-sm">
              <Info size={16} className="text-blue-400" />
              <span>{t.analytics.glossaryTitle}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowGlossary(false)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="bg-slate-900/80 p-3 rounded border border-slate-700/60">
              <div className="font-semibold text-blue-300 mb-1">{t.analytics.resolutionRate} (%)</div>
              <p className="text-[11px] text-slate-400 mb-1">
                <strong>Formula:</strong> {t.analytics.resolutionRateFormula}
              </p>
            </div>
            <div className="bg-slate-900/80 p-3 rounded border border-slate-700/60">
              <div className="font-semibold text-emerald-300 mb-1">{t.analytics.slaComplianceRate} (%)</div>
              <p className="text-[11px] text-slate-400 mb-1">
                <strong>Formula:</strong> {t.analytics.slaComplianceFormula}
              </p>
            </div>
            <div className="bg-slate-900/80 p-3 rounded border border-slate-700/60">
              <div className="font-semibold text-rose-300 mb-1">{t.analytics.overdueCases}</div>
              <p className="text-[11px] text-slate-400 mb-1">
                <strong>Formula:</strong> {t.analytics.reopenRateFormula}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-950/80 border border-rose-800 text-rose-200 p-4 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadAllAnalytics}
            className="px-2.5 py-1 bg-rose-900 hover:bg-rose-800 text-white rounded text-[11px] font-semibold"
          >
            {t.common.retry}
          </button>
        </div>
      )}

      {/* 2. Executive KPI Summary Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Card 1: Total Complaints */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>{t.analytics.totalRegistered}</span>
            <Layers size={14} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {loading ? '...' : (metrics.totalComplaints ?? 0)}
          </div>
          {comparison.hasSufficientComparisonData && (
            <div className="text-[10px] mt-1 font-medium flex items-center gap-1 text-slate-600">
              <span
                className={
                  comparison.percentChange?.totalComplaints >= 0 ? 'text-emerald-600' : 'text-slate-500'
                }
              >
                {comparison.percentChange?.totalComplaints > 0 ? '+' : ''}
                {comparison.percentChange?.totalComplaints}%
              </span>
              <span>{t.analytics.vsPriorPeriod}</span>
            </div>
          )}
        </div>

        {/* Card 2: Active Backlog */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>{t.analytics.activeBacklog}</span>
            <Clock size={14} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-700">
            {loading ? '...' : (metrics.activeComplaints ?? 0)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {metrics.totalComplaints > 0
              ? t.analytics.ofTotalWorkload.replace('{pct}', Math.round(((metrics.activeComplaints || 0) / metrics.totalComplaints) * 100))
              : (lang === 'hi' ? '0% खुला' : '0% open')}
          </div>
        </div>

        {/* Card 3: Resolved & Closed */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>{t.analytics.resolvedCard}</span>
            <CheckCircle2 size={14} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {loading ? '...' : (metrics.resolvedAndClosed ?? 0)}
          </div>
          <div className="text-[10px] text-emerald-800 font-semibold mt-1">
            {loading ? '...' : `${metrics.resolutionRate ?? 0}% ${t.analytics.resolutionRate}`}
          </div>
        </div>

        {/* Card 4: SLA Compliance Rate */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>{t.analytics.slaComplianceRate}</span>
            <ShieldCheck size={14} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-700">
            {loading
              ? '...'
              : metrics.slaComplianceRate !== null && metrics.slaComplianceRate !== undefined
              ? `${metrics.slaComplianceRate}%`
              : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {metrics.eligibleResolvedForSla > 0
              ? `${metrics.resolvedWithinSlaCount}/${metrics.eligibleResolvedForSla} ${lang === 'hi' ? 'मानक SLA के भीतर' : 'resolved within SLA'}`
              : (lang === 'hi' ? 'कोई निस्तारित मामला नहीं' : 'No resolved cases')}
          </div>
        </div>

        {/* Card 5: Overdue Backlog */}
        <div className="bg-white border border-rose-200 rounded-xl p-4 shadow-sm bg-rose-50/20">
          <div className="flex items-center justify-between text-rose-700 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>{t.analytics.overdueCases}</span>
            <AlertTriangle size={14} className="text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700">
            {loading ? '...' : (metrics.overdueComplaints ?? 0)}
          </div>
          <div className="text-[10px] text-rose-600 font-medium mt-1">
            {metrics.overdueComplaints > 0 ? t.analytics.exceededDeadline : t.analytics.zeroSlaBreaches}
          </div>
        </div>

        {/* Card 6: Urgent / Critical */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>{t.analytics.highAndCritical}</span>
            <Flame size={14} className="text-orange-600" />
          </div>
          <div className="text-2xl font-black text-orange-700">
            {loading ? '...' : (metrics.highAndCriticalCount ?? 0)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {t.analytics.criticalPriorityCount.replace('{count}', metrics.priorityCounts?.CRITICAL ?? 0)}
          </div>
        </div>
      </div>

      {/* 3. Trends & Velocity Section (Recharts) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <TrendingUp size={16} className="text-blue-600" />
              <span>{t.analytics.velocityTitle}</span>
            </h2>
            <p className="text-[11px] text-slate-500">
              {t.analytics.velocitySubtitle}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs self-start sm:self-auto">
            {['day', 'week', 'month'].map((iv) => (
              <button
                key={iv}
                type="button"
                onClick={() => setTrendInterval(iv)}
                className={`px-2.5 py-1 rounded text-xs font-semibold capitalize transition ${
                  trendInterval === iv
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {iv === 'day' ? (lang === 'hi' ? 'दैनिक' : 'day') : iv === 'week' ? (lang === 'hi' ? 'साप्ताहिक' : 'week') : (lang === 'hi' ? 'मासिक' : 'month')}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="h-72 w-full pt-2">
          {trends.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
              <Calendar size={28} className="mb-1 text-slate-300" />
              <span>{t.analytics.noTimeSeries}</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSubmitted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '11px'
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Area
                  type="monotone"
                  dataKey="submitted"
                  name={t.analytics.grievancesRegistered}
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorSubmitted)"
                />
                <Area
                  type="monotone"
                  dataKey="resolved"
                  name={t.analytics.remediatedResolved}
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorResolved)"
                />
                <Area
                  type="monotone"
                  dataKey="openBacklog"
                  name={t.analytics.activeBacklog}
                  stroke="#8b5cf6"
                  strokeDasharray="4 4"
                  fill="none"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 4. Two-Column Charts: Status Distribution & Priority Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Status Distribution */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Layers size={15} className="text-blue-600" />
                <span>{t.analytics.lifecycleDistributionTitle}</span>
              </h2>
              <p className="text-[11px] text-slate-500">
                {t.analytics.lifecycleDistributionSubtitle}
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
              {t.analytics.totalCasesBadge.replace('{count}', metrics.totalComplaints || 0)}
            </span>
          </div>

          <div className="h-64 w-full">
            {statusChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                {t.common.noRecords}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    fontSize={10}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    tickLine={false}
                  />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '11px'
                    }}
                  />
                  <Bar dataKey="count" name={lang === 'hi' ? 'शिकायतें' : 'Complaints'} radius={[4, 4, 0, 0]}>
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
          <div className="border-b border-slate-100 pb-2.5">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Flame size={15} className="text-orange-600" />
              <span>{t.analytics.priorityMixTitle}</span>
            </h2>
            <p className="text-[11px] text-slate-500">{t.analytics.priorityMixSubtitle}</p>
          </div>

          <div className="h-64 w-full">
            {priorityChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No priority data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityChartData}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="count"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                    fontSize={10}
                  >
                    {priorityChartData.map((entry, index) => (
                      <Cell key={`pie-cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '11px'
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* 5. Department Performance Matrix Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Building2 size={16} className="text-blue-600" />
              <span>{t.analytics.deptMatrixTitle}</span>
            </h2>
            <p className="text-[11px] text-slate-500">
              {t.analytics.deptMatrixSubtitle}
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded">
            {t.analytics.deptsTrackedBadge.replace('{count}', deptPerformance.length)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3">{t.analytics.thDeptName}</th>
                <th className="py-2.5 px-2">{t.analytics.thSlaTarget}</th>
                <th className="py-2.5 px-2 text-right">{t.analytics.thTotal}</th>
                <th className="py-2.5 px-2 text-right">{t.analytics.thActive}</th>
                <th className="py-2.5 px-2 text-right">{t.analytics.thResolved}</th>
                <th className="py-2.5 px-2 text-right">{t.analytics.thOverdue}</th>
                <th className="py-2.5 px-2 text-right">{t.analytics.thResolutionRate}</th>
                <th className="py-2.5 px-2 text-right">{t.analytics.thSlaCompliance}</th>
                <th className="py-2.5 px-2 text-right">{t.analytics.thAvgDuration}</th>
                <th className="py-2.5 px-3 text-right">{t.analytics.thLoopsStale}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {deptPerformance.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-6 text-center text-slate-400">
                    {t.analytics.noDeptRecords}
                  </td>
                </tr>
              ) : (
                deptPerformance.map((dept) => (
                  <tr key={dept.departmentId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      <div>{tDepartment(dept.departmentName)}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{dept.code}</div>
                    </td>
                    <td className="py-2.5 px-2 text-slate-600">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-medium">
                        {t.analytics.daysUnit.replace('{days}', dept.targetSlaDays)}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right font-medium">{dept.totalComplaints}</td>
                    <td className="py-2.5 px-2 text-right text-amber-700 font-medium">
                      {dept.activeWorkload}
                    </td>
                    <td className="py-2.5 px-2 text-right text-emerald-700 font-medium">
                      {dept.resolvedCount}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      {dept.overdueCount > 0 ? (
                        <span className="px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[10px]">
                          {dept.overdueCount}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right font-semibold">
                      {dept.resolutionRate}%
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      {dept.slaComplianceRate !== null ? (
                        <span
                          className={`font-semibold ${
                            dept.slaComplianceRate >= 80 ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {dept.slaComplianceRate}%
                        </span>
                      ) : (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-600">
                      {dept.averageResolutionDurationHours !== null
                        ? t.analytics.hrsUnit.replace('{hrs}', dept.averageResolutionDurationHours)
                        : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[11px]">
                      <span className="text-slate-600">{t.analytics.loopsCount.replace('{count}', dept.reassignmentLoopsCount || 0)}</span>
                      <span className="text-slate-300 mx-1">•</span>
                      <span className="text-amber-700">{t.analytics.staleCount.replace('{count}', dept.staleCasesCount || 0)}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Categories & Geography Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Categories Breakdown */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
          <div className="border-b border-slate-100 pb-2.5">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Layers size={15} className="text-blue-600" />
              <span>{t.analytics.catSectorTitle}</span>
            </h2>
            <p className="text-[11px] text-slate-500">{t.analytics.catSectorSubtitle}</p>
          </div>

          <div className="space-y-2.5">
            {!catGeography?.categories || catGeography.categories.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">{t.common.noRecords}</div>
            ) : (
              catGeography.categories.map((cat) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-800">
                    <span>{tCategory(cat.category)}</span>
                    <span className="text-slate-500 text-[11px]">
                      {cat.count} {lang === 'hi' ? 'मामले' : 'cases'} ({cat.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${Math.min(100, cat.percentage)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* State & District Aggregates (PII Protected) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <MapPin size={15} className="text-emerald-600" />
                <span>{t.analytics.geoDistributionTitle}</span>
              </h2>
              <p className="text-[11px] text-slate-500">
                {t.analytics.geoDistributionSubtitle}
              </p>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold">
              {t.analytics.piiStripped}
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {!catGeography?.geography || catGeography.geography.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">{t.common.noRecords}</div>
            ) : (
              catGeography.geography.map((st) => (
                <div key={st.state} className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                  <div className="flex items-center justify-between font-bold text-xs text-slate-900 mb-1.5">
                    <span>{st.state}</span>
                    <span className="text-blue-700 font-semibold">{st.totalComplaints} {lang === 'hi' ? 'मामले' : 'cases'}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {st.districts.map((d) => (
                      <span
                        key={d.district}
                        className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] text-slate-700"
                      >
                        {d.district}: <strong className="text-slate-900">{d.count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-2 flex items-center gap-1">
            <ShieldCheck size={12} className="text-emerald-600 shrink-0" />
            <span>{t.analytics.strictPrivacyNote}</span>
          </div>
        </div>
      </div>

      {/* 7. Operational Workflow, Quality & Cross-Functional Integrations */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{t.analytics.qualityWorkflowTitle}</span>
          </h2>
          <p className="text-[11px] text-slate-500">
            {t.analytics.qualityWorkflowSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Card A: Clarifications & Reminders */}
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
              <MessageSquareQuote size={14} className="text-blue-600" />
              <span>{t.analytics.clarificationsRemindersTitle}</span>
            </div>
            <div className="space-y-1 text-slate-600 text-[11px]">
              <div className="flex justify-between">
                <span>{t.analytics.citizenClarificationQueries}</span>
                <strong className="text-slate-900">{workflow?.clarifications?.totalRequests || 0}</strong>
              </div>
              <div className="flex justify-between">
                <span>{t.analytics.openAwaitingReply}</span>
                <strong className="text-amber-700">{workflow?.clarifications?.openRequests || 0}</strong>
              </div>
              <div className="flex justify-between">
                <span>{t.analytics.respondedClosed}</span>
                <strong className="text-emerald-700">
                  {(workflow?.clarifications?.respondedRequests || 0) +
                    (workflow?.clarifications?.closedRequests || 0)}
                </strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span>{t.analytics.citizenReminders}</span>
                <strong className="text-blue-700">{workflow?.reminders?.totalRemindersLogged || 0}</strong>
              </div>
            </div>
          </div>

          {/* Card B: Citizen Ratings & Dispute Appeals */}
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
              <Star size={14} className="text-amber-500 fill-amber-500" />
              <span>{t.analytics.satisfactionAppealsTitle}</span>
            </div>
            <div className="space-y-1 text-slate-600 text-[11px]">
              <div className="flex justify-between items-center">
                <span>{t.analytics.avgCitizenRating}</span>
                <span className="font-bold text-amber-700 flex items-center gap-0.5">
                  {workflow?.satisfactionFeedback?.averageRating !== null
                    ? `${workflow?.satisfactionFeedback?.averageRating} / 5`
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{t.analytics.feedbackSubmissions}</span>
                <strong className="text-slate-900">{workflow?.satisfactionFeedback?.totalResponses || 0}</strong>
              </div>
              <div className="flex justify-between">
                <span>{t.analytics.formalAppeals}</span>
                <strong className="text-slate-900">{workflow?.appeals?.totalAppeals || 0}</strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span>{t.analytics.appealsAccepted}</span>
                <strong className="text-emerald-700">{workflow?.appeals?.acceptedAppeals || 0}</strong>
              </div>
            </div>
          </div>

          {/* Card C: Spam Review Desk */}
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
              <ShieldAlert size={14} className="text-indigo-600" />
              <span>{t.analytics.spamReviewTitle}</span>
            </div>
            <div className="space-y-1 text-slate-600 text-[11px]">
              <div className="flex justify-between">
                <span>{t.analytics.screeningFlags}</span>
                <strong className="text-slate-900">
                  {workflow?.spamReviewDesk?.totalScreeningFlags || 0}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>{t.analytics.clearedLegitimate}</span>
                <strong className="text-emerald-700">
                  {workflow?.spamReviewDesk?.humanReviewOutcomes?.clearedLegitimate || 0}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>{t.analytics.confirmedAbuse}</span>
                <strong className="text-rose-700">
                  {workflow?.spamReviewDesk?.humanReviewOutcomes?.confirmedAbuse || 0}
                </strong>
              </div>
              <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-200">
                {t.analytics.flagsNotAbuse}
              </div>
            </div>
          </div>

          {/* Card D: Workflow Bottlenecks & Multi-Agency Subtasks */}
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
              <RotateCcw size={14} className="text-purple-600" />
              <span>{t.analytics.triageAnomaliesTitle}</span>
            </div>
            <div className="space-y-1 text-slate-600 text-[11px]">
              <div className="flex justify-between">
                <span>{t.analytics.reassignmentLoopsCount}</span>
                <strong className="text-slate-900">
                  {workflow?.anomalies?.reassignmentLoops?.count || 0}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>{t.analytics.staleCasesCount}</span>
                <strong className="text-amber-700">
                  {workflow?.anomalies?.staleCases?.count || 0}
                </strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span>{t.analytics.parentIncidentsCount}</span>
                <strong className="text-blue-700">
                  {workflow?.interAgencyWorkload?.parentIncidentsCount || 0}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>{t.analytics.subtaskCompletionRate}</span>
                <strong className="text-emerald-700">
                  {workflow?.interAgencyWorkload?.subtaskCompletionRate !== null
                    ? `${workflow?.interAgencyWorkload?.subtaskCompletionRate}%`
                    : 'N/A'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
