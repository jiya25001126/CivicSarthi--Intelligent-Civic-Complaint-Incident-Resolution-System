import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchComplaints, fetchComplaintStats } from '../api/client';
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
  TrendingUp
} from 'lucide-react';

export default function CitizenDashboard() {
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [complaintsRes, statsRes] = await Promise.all([
        fetchComplaints(),
        fetchComplaintStats()
      ]);
      setComplaints(complaintsRes.data || []);
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
            <span>Track by ID</span>
          </Link>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Total Registered</span>
            <FileText size={18} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {stats ? stats.total : complaints.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Demonstration civic filings</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">In Progress / Assigned</span>
            <Clock size={18} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600">
            {stats ? stats.inProgress : complaints.filter(c => c.status === 'IN_PROGRESS' || c.status === 'ASSIGNED').length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Actively reviewed by departments</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Resolved</span>
            <CheckCircle2 size={18} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {stats ? stats.resolved : complaints.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED').length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Successfully addressed</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Critical Cases</span>
            <AlertTriangle size={18} className="text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-600">
            {stats ? stats.critical : complaints.filter(c => c.priority === 'CRITICAL').length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Safety & infrastructure emergencies</p>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} className="shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">Failed to fetch data:</span> {error}
          </div>
        </div>
      )}

      {/* Recent Complaints */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-800">Recent Grievance Filings</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
              {complaints.length} total
            </span>
          </div>
          <Link
            to="/citizen/complaints"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold"
          >
            <span>View All</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500 flex flex-col items-center gap-3">
            <RefreshCw size={24} className="animate-spin text-blue-600" />
            <span>Loading grievances from CivicSarthi backend...</span>
          </div>
        ) : recentComplaints.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No complaints found in the demonstration registry.
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
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Filed Date</th>
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
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <PriorityBadge priority={item.priority} />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-500">
                      {new Date(item.createdAt).toLocaleDateString('en-IN', {
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
