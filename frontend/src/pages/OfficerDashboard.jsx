import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchComplaints, fetchComplaintStats } from '../api/client';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
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
  BarChart3
} from 'lucide-react';

export default function OfficerDashboard() {
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [compRes, statsRes] = await Promise.all([
        fetchComplaints(),
        fetchComplaintStats()
      ]);
      setComplaints(compRes.data || []);
      setStats(statsRes.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter urgent / attention cases
  const criticalOrHigh = complaints.filter(
    c => c.priority === 'CRITICAL' || c.priority === 'HIGH' || c.status === 'SUBMITTED'
  ).slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Title & Cockpit Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Officer Triage & Decision Cockpit
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
              Officer Mode
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Departmental caseload overview, bottleneck diagnostics, and urgent case triage.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            to="/officer/analytics"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold shadow-sm transition border border-slate-700"
          >
            <BarChart3 size={14} className="text-blue-400" />
            <span>Analytics & Reports</span>
          </Link>
          <Link
            to="/officer/complaints"
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <span>Complaint Management</span>
            <ArrowRight size={14} />
          </Link>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Total Active Queue</span>
            <ShieldCheck size={18} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {stats ? stats.total : complaints.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">All registered cases</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Critical Priority</span>
            <Flame size={18} className="text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-600">
            {stats ? stats.critical : complaints.filter(c => c.priority === 'CRITICAL').length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Urgent intervention required</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Reassignment Loops</span>
            <Repeat size={18} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600">
            {stats ? stats.reassignmentLoops : complaints.filter(c => (c.reassignments || 0) >= 2).length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">&ge; 2 department handoffs</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Stale Cases</span>
            <Clock size={18} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-600">
            {stats ? stats.staleCases : complaints.filter(c => c.slaMetrics?.isStale).length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">&gt; 7 days without update</p>
        </div>
      </div>

      {/* Action / Priority Triage Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-800">
              High Priority & Newly Submitted Queue
            </span>
            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
              Needs Immediate Review
            </span>
          </div>
          <Link
            to="/officer/complaints"
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
          >
            Manage All {complaints.length} Cases &rarr;
          </Link>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500 flex flex-col items-center gap-3">
            <RefreshCw size={24} className="animate-spin text-blue-600" />
            <span>Loading cases...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Reference No</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-6 py-3">Grievance Issue</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Priority</th>
                  <th className="px-4 py-3">SLA Alert</th>
                  <th className="px-4 py-3 text-right">Triage Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {criticalOrHigh.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5 font-bold font-mono text-slate-900 whitespace-nowrap">
                      {item.referenceNumber || item.id}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-700 whitespace-nowrap">
                      {item.departmentId || item.department}
                    </td>
                    <td className="px-6 py-3.5 max-w-sm">
                      <p className="font-semibold text-slate-900 line-clamp-1">
                        {item.title || item.text}
                      </p>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {item.description || item.text}
                      </p>
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
                          Breached ({item.slaMetrics.ageDays}d)
                        </span>
                      ) : item.slaMetrics?.isStale ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                          <Clock size={13} />
                          Stale ({item.slaMetrics.daysSinceUpdate}d)
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-medium">
                          Active ({item.slaMetrics?.ageDays || 0}d)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <Link
                        to={`/officer/complaints/${encodeURIComponent(item.id)}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-bold text-xs transition"
                      >
                        <span>Review</span>
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
