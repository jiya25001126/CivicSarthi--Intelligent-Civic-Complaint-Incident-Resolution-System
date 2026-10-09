import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchComplaints, fetchDepartments } from '../api/client';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import {
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Building2,
  Clock,
  Repeat
} from 'lucide-react';

export default function OfficerComplaintManagement() {
  const [complaints, setComplaints] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('createdAt_desc');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [compRes, deptsRes] = await Promise.all([
        fetchComplaints({
          search: search || undefined,
          departmentId: departmentFilter !== 'ALL' ? departmentFilter : undefined,
          category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          priority: priorityFilter !== 'ALL' ? priorityFilter : undefined,
          sort: sortOrder
        }),
        fetchDepartments()
      ]);
      setComplaints(compRes.data || []);
      setDepartments(deptsRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [departmentFilter, categoryFilter, statusFilter, priorityFilter, sortOrder]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadData();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Officer Caseload & Complaint Triage
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Filter, search, reassign, and resolve grievances across municipal and state departments.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Sync Caseload</span>
        </button>
      </div>

      {/* Multi-filter Strip */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search reference no, citizen text, locality, keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition"
          >
            Search
          </button>
        </form>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
          {/* Department Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-700"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="AWAITING_INFORMATION">Awaiting Info</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-700"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-700"
            >
              <option value="ALL">All Categories</option>
              <option value="roads">Roads</option>
              <option value="electricity">Electricity</option>
              <option value="water">Water</option>
              <option value="healthcare">Healthcare</option>
              <option value="pension">Pension</option>
              <option value="scholarship">Scholarship</option>
              <option value="ration">Ration</option>
              <option value="municipal">Municipal</option>
              <option value="flood relief">Flood Relief</option>
            </select>
          </div>

          {/* Sorting */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sort Order</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-700"
            >
              <option value="createdAt_desc">Newest First</option>
              <option value="createdAt_asc">Oldest First</option>
              <option value="priority_desc">Highest Priority</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} className="shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">Error:</span> {error}
          </div>
        </div>
      )}

      {/* Triage Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <span className="font-bold text-sm text-slate-800">
            Active Caseload ({complaints.length} cases matching filters)
          </span>
          <span className="text-xs text-slate-500">
            Demonstration Triage Registry
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500 flex flex-col items-center gap-3">
            <RefreshCw size={24} className="animate-spin text-blue-600" />
            <span>Loading cases...</span>
          </div>
        ) : complaints.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No complaints found matching the specified filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Reference No</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-6 py-3">Subject & Location</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Priority</th>
                  <th className="px-3 py-3">Handoffs</th>
                  <th className="px-4 py-3">SLA Alert</th>
                  <th className="px-4 py-3 text-right">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {complaints.map((item) => (
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
                        {item.locality ? `${item.locality}, ` : ''}{item.district}, {item.state}
                      </p>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <PriorityBadge priority={item.priority} />
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        (item.reassignments || 0) >= 2
                          ? 'bg-amber-100 text-amber-800 font-bold border border-amber-300'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {item.reassignments || 0} handoffs
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {item.slaMetrics?.isSlaBreached ? (
                        <span className="text-rose-600 font-bold">
                          Breached ({item.slaMetrics.ageDays}d)
                        </span>
                      ) : item.slaMetrics?.isStale ? (
                        <span className="text-amber-600 font-semibold">
                          Stale ({item.slaMetrics.daysSinceUpdate}d)
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-medium">
                          Normal ({item.slaMetrics?.ageDays || 0}d)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <Link
                        to={`/officer/complaints/${encodeURIComponent(item.id)}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-bold text-xs transition"
                      >
                        <span>Triage</span>
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
