import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchComplaints, fetchComplaintStats } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import ComplaintLocationModal, { isValidCoordinate } from '../components/ComplaintLocationModal';
import {
  ShieldCheck,
  Flame,
  Repeat,
  Clock,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  MapPin,
  Sparkles,
  X,
  Layers
} from 'lucide-react';

const DEPARTMENT_LABELS = {
  DEPT_ROADS: 'Public Works Department (Roads & Infrastructure)',
  DEPT_WATER: 'Water Supply Department (Municipal Jal Board)',
  DEPT_MUNICIPAL: 'Municipal Administration (Sanitation & Waste)',
  DEPT_POWER: 'State Power Distribution (Electricity)',
  DEPT_HEALTH: 'Directorate of Health Services',
  DEPT_POLICE: 'Civic Police & Traffic Coordination',
  DEPT_RATION: 'Public Distribution & Rationing Services',
  DEPT_REVENUE: 'Revenue & Land Administration',
  DEPT_SCHOLARSHIP: 'Social Welfare & Scholarships',
  DEPT_DISASTER: 'Disaster Management & Emergency Relief',
  DEPT_PENSION: 'Social Security & Pension Directorate'
};

export default function OfficerDashboard() {
  const { user } = useAuth();
  const { lang, t, tStatus, tPriority, tDepartment } = useLanguage();
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterTab, setFilterTab] = useState('URGENT');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedComplaintLocation, setSelectedComplaintLocation] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [compRes, statsRes] = await Promise.all([
        fetchComplaints(),
        fetchComplaintStats()
      ]);
      const list = compRes.data || [];
      setComplaints(list);
      setStats(statsRes.data);
    } catch (err) {
      setError(err.message || 'Failed to load officer cockpit data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const departmentName = (user?.departmentId && tDepartment(user.departmentId)) || user?.departmentId || t('officerDashboard.title', 'Department Caseload');
  const hasSynthetic = complaints.some((c) => c.synthetic === true);

  // Compute caseload metrics dynamically from loaded list
  const criticalCount = complaints.filter(
    (c) => c.priority === 'CRITICAL' || c.priority === 'HIGH' || c.status === 'SUBMITTED'
  ).length;
  const breachedCount = complaints.filter(
    (c) => c.slaMetrics?.isSlaBreached
  ).length;
  const staleCount = complaints.filter(
    (c) => c.slaMetrics?.isStale
  ).length;
  const loopCount = complaints.filter(
    (c) => (c.reassignments || 0) >= 2
  ).length;
  const resolvedCount = complaints.filter(
    (c) => c.status === 'RESOLVED' || c.status === 'CLOSED'
  ).length;

  // Active SLA Distribution Breakdown
  const activeCases = complaints.filter((c) => c.status !== 'RESOLVED' && c.status !== 'CLOSED');
  const onTrackCount = activeCases.filter(
    (c) => !c.slaMetrics?.isSlaBreached && !c.slaMetrics?.isStale
  ).length;

  // Filter complaints based on selected caseload tab and search query
  const filteredComplaints = complaints.filter((c) => {
    if (filterTab === 'URGENT') {
      const isUrgent = c.priority === 'CRITICAL' || c.priority === 'HIGH' || c.status === 'SUBMITTED';
      if (!isUrgent) return false;
    } else if (filterTab === 'BREACHED') {
      if (!c.slaMetrics?.isSlaBreached) return false;
    } else if (filterTab === 'STALE') {
      if (!c.slaMetrics?.isStale) return false;
    } else if (filterTab === 'LOOPS') {
      if ((c.reassignments || 0) < 2) return false;
    } else if (filterTab === 'RESOLVED') {
      if (c.status !== 'RESOLVED' && c.status !== 'CLOSED') return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const ref = (c.referenceNumber || c.id || '').toLowerCase();
      const title = (c.title || c.text || '').toLowerCase();
      const desc = (c.description || '').toLowerCase();
      const cat = (c.category || '').toLowerCase();
      const loc = (c.location?.landmark || c.location?.ward || c.locality || '').toLowerCase();
      if (!ref.includes(q) && !title.includes(q) && !desc.includes(q) && !cat.includes(q) && !loc.includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Title & Cockpit Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {t('officerDashboard.cockpitTitle', 'Officer Triage & Decision Cockpit')}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
              {t('officerDashboard.officerMode', 'Officer Mode')}
            </span>
            {user?.departmentId && (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
                {user.departmentId}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600 mt-1 flex items-center gap-1.5">
            <Building2 size={15} className="text-slate-400" />
            <span className="font-medium text-slate-800">{departmentName}</span>
            <span className="text-slate-400">&bull;</span>
            <span>{t('officerDashboard.cockpitSubtitle', 'Departmental caseload overview, bottleneck diagnostics, and urgent case triage.')}</span>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            to="/officer/analytics"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold shadow-sm transition border border-slate-700"
          >
            <BarChart3 size={14} className="text-blue-400" />
            <span>{t('officerDashboard.analyticsAndReports', 'Analytics & Reports')}</span>
          </Link>
          <Link
            to="/officer/complaints"
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <span>{t('officerDashboard.manageAll', 'Manage All ({count})', { count: complaints.length })}</span>
            <ArrowRight size={14} />
          </Link>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition disabled:opacity-50"
            title={t('common.refresh', 'Refresh')}
            aria-label={t('officerDashboard.refreshAria', 'Refresh dashboard data')}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Synthetic Demo Active Strip */}
      {hasSynthetic && (
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-sky-50 border border-blue-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-700 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles size={16} />
            </div>
            <div>
              <span className="font-bold text-slate-900 block text-xs">
                {t('officerDashboard.syntheticBannerTitle', 'Synthetic Caseload Evaluation Environment Active')}
              </span>
              <span className="text-slate-600 text-[11px]">
                {t('officerDashboard.syntheticBannerDesc', 'Showing realistic demonstration grievances spanning SLA breaches, multi-hop department handoffs, pending triage, and citizen clarifications.')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded-lg bg-white/80 border border-blue-200 text-blue-800 font-semibold text-[11px]">
              {t('officerDashboard.deptCasesActive', '{count} Department Cases Active', { count: complaints.length })}
            </span>
          </div>
        </div>
      )}

      {/* KPI Stats Strip — interactive 1-click filter cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setFilterTab('ALL')}
          className={`p-5 rounded-2xl border text-left transition ${
            filterTab === 'ALL'
              ? 'bg-blue-50/60 border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">{t('officerDashboard.totalActiveQueue', 'Total Active Queue')}</span>
            <ShieldCheck size={18} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {stats ? stats.total : complaints.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{t('officerDashboard.allRegisteredScope', 'All registered cases in scope')}</p>
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('URGENT')}
          className={`p-5 rounded-2xl border text-left transition ${
            filterTab === 'URGENT'
              ? 'bg-rose-50/60 border-rose-500 ring-2 ring-rose-500/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">{t('officerDashboard.criticalHigh', 'Critical & High')}</span>
            <Flame size={18} className="text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-600">
            {criticalCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{t('officerDashboard.urgentIntervention', 'Urgent intervention required')}</p>
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('LOOPS')}
          className={`p-5 rounded-2xl border text-left transition ${
            filterTab === 'LOOPS'
              ? 'bg-amber-50/60 border-amber-500 ring-2 ring-amber-500/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">{t('officerDashboard.reassignmentLoops', 'Reassignment Loops')}</span>
            <Repeat size={18} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600">
            {loopCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{t('officerDashboard.handoffsCount', '≥ 2 department handoffs')}</p>
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('STALE')}
          className={`p-5 rounded-2xl border text-left transition ${
            filterTab === 'STALE'
              ? 'bg-indigo-50/60 border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">{t('officerDashboard.staleCases', 'Stale Cases')}</span>
            <Clock size={18} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-600">
            {staleCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{t('officerDashboard.withoutUpdate', '> 7 days without update')}</p>
        </button>
      </div>

      {/* Caseload SLA Health Distribution Bar */}
      {activeCases.length > 0 && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span className="flex items-center gap-1.5">
              <Layers size={14} className="text-slate-400" />
              {t('officerDashboard.slaHealthBar', 'Department SLA Caseload Health')}
            </span>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5 text-emerald-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                {t('officerDashboard.onTrackLabel', 'On Track: {count}', { count: onTrackCount })}
              </span>
              <span className="flex items-center gap-1.5 text-amber-700">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                {t('officerDashboard.staleAttentionLabel', 'Stale / Attention: {count}', { count: staleCount })}
              </span>
              <span className="flex items-center gap-1.5 text-rose-700">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                {t('officerDashboard.slaBreachedLabel', 'SLA Breached: {count}', { count: breachedCount })}
              </span>
            </div>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden flex">
            <div
              style={{ width: `${(onTrackCount / activeCases.length) * 100}%` }}
              className="bg-emerald-500 transition-all duration-300"
              title={`On Track: ${onTrackCount}`}
            />
            <div
              style={{ width: `${(staleCount / activeCases.length) * 100}%` }}
              className="bg-amber-500 transition-all duration-300"
              title={`Stale: ${staleCount}`}
            />
            <div
              style={{ width: `${(breachedCount / activeCases.length) * 100}%` }}
              className="bg-rose-500 transition-all duration-300"
              title={`SLA Breached: ${breachedCount}`}
            />
          </div>
        </div>
      )}

      {/* Action / Priority Triage Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Controls Header */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          {/* Caseload Filter Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setFilterTab('URGENT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterTab === 'URGENT'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {t('officerDashboard.tabUrgent', 'Urgent & High ({count})', { count: criticalCount })}
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('BREACHED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterTab === 'BREACHED'
                  ? 'bg-red-700 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {t('officerDashboard.tabBreached', 'SLA Breached ({count})', { count: breachedCount })}
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('STALE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterTab === 'STALE'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {t('officerDashboard.tabStale', 'Stale Cases ({count})', { count: staleCount })}
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('LOOPS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterTab === 'LOOPS'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {t('officerDashboard.tabLoops', 'Loops ({count})', { count: loopCount })}
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('RESOLVED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterTab === 'RESOLVED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {t('officerDashboard.tabResolved', 'Resolved ({count})', { count: resolvedCount })}
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterTab === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {t('officerDashboard.tabAll', 'All ({count})', { count: complaints.length })}
            </button>
          </div>

          {/* Instant Search Bar */}
          <div className="relative min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('officerDashboard.searchPlaceholder', 'Search reference, ward, issue...')}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                title={t('common.clear', 'Clear search')}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500 flex flex-col items-center gap-3">
            <RefreshCw size={24} className="animate-spin text-blue-600" />
            <span>{t('common.loading', 'Loading cases...')}</span>
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="p-10 text-center flex flex-col items-center justify-center space-y-2">
            <Filter size={24} className="text-slate-400" />
            <h4 className="text-sm font-bold text-slate-700">{t('officerDashboard.noCasesInView', 'No Cases In Selected View')}</h4>
            <p className="text-xs text-slate-500 max-w-sm">
              {t('officerDashboard.noCasesDesc', 'No complaint matched current filter criteria. Select another caseload view or reset your search query.')}
            </p>
            <button
              type="button"
              onClick={() => {
                setFilterTab('ALL');
                setSearchQuery('');
              }}
              className="mt-2 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
            >
              {t('officerDashboard.showAllCases', 'Show All Cases')}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">{t('officerDashboard.thReference', 'Reference No')}</th>
                  <th className="px-4 py-3">{t('officerDashboard.thDeptWard', 'Department & Ward')}</th>
                  <th className="px-6 py-3">{t('officerDashboard.thIssue', 'Grievance Issue')}</th>
                  <th className="px-3 py-3">{t('officerDashboard.thStatus', 'Status')}</th>
                  <th className="px-3 py-3">{t('officerDashboard.thPriority', 'Priority')}</th>
                  <th className="px-4 py-3">{t('officerDashboard.thSlaAlert', 'SLA Alert')}</th>
                  <th className="px-4 py-3 text-right">{t('officerDashboard.thAction', 'Triage Action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredComplaints.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5 font-bold font-mono text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>{item.referenceNumber || item.id}</span>
                        {item.synthetic && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            {t('officerDashboard.demoBadge', 'Demo')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-medium text-slate-700">
                        {tDepartment(item.departmentId || item.department)}
                      </div>
                      {(item.location?.ward || item.location?.landmark || item.locality) && (
                        <div className="flex items-center gap-0.5 text-[10px] text-slate-500 mt-0.5">
                          <MapPin size={10} className="text-slate-400" />
                          <span>{item.location?.ward || item.location?.landmark || item.locality}</span>
                        </div>
                      )}
                      <div>
                        {isValidCoordinate(item.coordinates) ? (
                          <button
                            type="button"
                            onClick={() => setSelectedComplaintLocation(item)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline mt-1 cursor-pointer"
                          >
                            <MapPin size={11} className="text-blue-500 shrink-0" />
                            <span>{lang === 'hi' ? 'स्थान देखें' : 'View Location'}</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 italic mt-1">
                            <span>{lang === 'hi' ? 'स्थान प्रदान नहीं किया गया' : 'Location not provided'}</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 max-w-sm">
                      <p className="font-semibold text-slate-900 line-clamp-1">
                        {item.title || item.text}
                      </p>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {item.description || item.text}
                      </p>
                      {(item.reassignments || 0) >= 2 && (
                        <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          <Repeat size={10} />
                          {t('officerDashboard.handoffLoops', '{count}x Handoff Loops', { count: item.reassignments })}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <PriorityBadge priority={item.priority} />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {item.slaMetrics?.isSlaBreached ? (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-bold">
                          <AlertTriangle size={13} />
                          {t('officerDashboard.breachedDays', 'Breached ({days}d)', { days: item.slaMetrics.ageDays })}
                        </span>
                      ) : item.slaMetrics?.isStale ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                          <Clock size={13} />
                          {t('officerDashboard.staleDays', 'Stale ({days}d)', { days: item.slaMetrics.daysSinceUpdate })}
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-medium">
                          {t('officerDashboard.activeDays', 'Active ({days}d)', { days: item.slaMetrics?.ageDays || 0 })}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-1.5">
                      {isValidCoordinate(item.coordinates) && (
                        <button
                          type="button"
                          onClick={() => setSelectedComplaintLocation(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition cursor-pointer"
                          title={lang === 'hi' ? 'स्थान देखें' : 'View Location'}
                          aria-label={lang === 'hi' ? 'स्थान देखें' : 'View Location'}
                        >
                          <MapPin size={12} className="text-blue-600" />
                          <span>{lang === 'hi' ? 'स्थान' : 'View Location'}</span>
                        </button>
                      )}
                      <Link
                        to={`/officer/complaints/${encodeURIComponent(item.id)}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-bold text-xs transition"
                      >
                        <span>{t('officerDashboard.reviewBtn', 'Review')}</span>
                        <ExternalLink size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedComplaintLocation && (
        <ComplaintLocationModal
          complaint={selectedComplaintLocation}
          onClose={() => setSelectedComplaintLocation(null)}
          lang={lang}
        />
      )}
    </div>
  );
}
