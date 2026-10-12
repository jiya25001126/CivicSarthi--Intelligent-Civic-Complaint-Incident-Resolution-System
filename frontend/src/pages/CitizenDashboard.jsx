import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyComplaints } from '../api/client';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import {
  FilePlus,
  Search,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Inbox
} from 'lucide-react';
import { formatOutcomeType } from '../constants/resolutionQuality.constants';

export default function CitizenDashboard() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchMyComplaints();
      const list = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      setComplaints(list);
    } catch (err) {
      setError(err.message || 'Failed to load citizen grievance records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute status counts strictly from the citizen's own complaints
  const totalCount = complaints.length;
  const triageCount = complaints.filter(
    (c) => c.status === 'SUBMITTED' || c.status === 'UNDER_REVIEW'
  ).length;
  const activeCount = complaints.filter(
    (c) => c.status === 'ASSIGNED' || c.status === 'IN_PROGRESS' || c.status === 'AWAITING_INFORMATION'
  ).length;
  const resolvedCount = complaints.filter(
    (c) => c.status === 'RESOLVED' || c.status === 'CLOSED'
  ).length;

  const recentComplaints = complaints.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Citizen Grievance Portal</h1>
          <p className="text-sm text-slate-600 mt-1">
            Track filed grievances, review department actions, and monitor resolution timelines.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            to="/citizen/submit"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <FilePlus size={15} />
            <span>Submit Grievance</span>
          </Link>
          <Link
            to="/citizen/track"
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            <Search size={15} />
            <span>Track by Reference</span>
          </Link>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition disabled:opacity-50"
            title="Refresh Data"
            aria-label="Refresh grievance data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats Cards — strictly derived from authenticated citizen data */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Total Filed</span>
            <FileText size={18} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {loading ? '—' : totalCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Grievances registered by you</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Pending Triage</span>
            <Clock size={18} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600">
            {loading ? '—' : triageCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Submitted & initial review</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Active Remediation</span>
            <TrendingUp size={18} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-600">
            {loading ? '—' : activeCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Assigned or in progress</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Resolved & Closed</span>
            <CheckCircle2 size={18} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {loading ? '—' : resolvedCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Completed by department</p>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="shrink-0" />
            <div className="text-sm">
              <span className="font-semibold">Failed to fetch data:</span> {error}
            </div>
          </div>
          <button
            onClick={loadData}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Recent Complaints Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-800">My Recent Grievances</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
              {complaints.length} total
            </span>
          </div>
          {complaints.length > 0 && (
            <Link
              to="/citizen/complaints"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold"
            >
              <span>View All</span>
              <ArrowRight size={13} />
            </Link>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500 flex flex-col items-center gap-3">
            <RefreshCw size={24} className="animate-spin text-blue-600" />
            <span>Loading grievances from CivicSarthi backend...</span>
          </div>
        ) : complaints.length === 0 ? (
          /* Empty state for citizen without complaints */
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <Inbox size={32} />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-base font-bold text-slate-800">No Grievances Lodged Yet</h3>
              <p className="text-xs text-slate-500">
                You have not registered any civic complaints under this account. File your first grievance to begin tracking departmental action.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Link
                to="/citizen/submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
              >
                <FilePlus size={15} />
                <span>Lodge First Grievance</span>
              </Link>
              <Link
                to="/citizen/track"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                <Search size={15} />
                <span>Track Public Reference</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Reference No</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-6 py-3">Subject</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Filed Date</th>
                  <th className="px-4 py-3">Last Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentComplaints.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5 font-bold font-mono text-slate-900 whitespace-nowrap">
                      {item.referenceNumber || item.id}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium capitalize">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 max-w-sm">
                      <p className="font-semibold text-slate-900 line-clamp-1">
                        {item.title || item.text}
                      </p>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {item.description || item.text}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div>
                        <StatusBadge status={item.status} />
                        {item.resolutionDetails?.outcomeType && (
                          <span className="block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 w-fit">
                            {formatOutcomeType(item.resolutionDetails.outcomeType)}
                          </span>
                        )}
                        {item.resolutionDetails?.isException && !item.resolutionDetails?.outcomeType && (
                          <span className="block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 w-fit">
                            Exception Granted
                          </span>
                        )}
                        {item.statusDescription && !item.resolutionDetails?.outcomeType && (
                          <p className="text-[10px] text-slate-500 mt-1 max-w-[180px] line-clamp-1">
                            {item.statusDescription}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-500">
                      {new Date(item.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-500">
                      {new Date(item.updatedAt || item.lastUpdated || item.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-2">
                      <Link
                        to={`/citizen/track/${encodeURIComponent(item.referenceNumber || item.id)}`}
                        className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold"
                      >
                        <span>Track</span>
                      </Link>
                      <Link
                        to={`/citizen/complaints/${encodeURIComponent(item.id)}`}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold"
                      >
                        <span>Details</span>
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
    </div>
  );
}
