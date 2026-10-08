import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchComplaints } from '../api/client';
import {
  AlertTriangle,
  Clock,
  Repeat,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Flame
} from 'lucide-react';

export default function OfficerDashboard() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [search, setSearch] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchComplaints();
      setComplaints(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalCases = complaints.length;
  const criticalCases = complaints.filter(c => c.priority === 'CRITICAL').length;
  const reassignLoops = complaints.filter(c => (c.reassignments || 0) >= 2).length;
  const staleCases = complaints.filter(c => c.slaMetrics?.isStale).length;

  const filtered = complaints.filter(item => {
    const matchesPriority = filterPriority === 'ALL' || item.priority === filterPriority;
    const matchesSearch = !search ||
      item.id.toLowerCase().includes(search.toLowerCase()) ||
      item.text.toLowerCase().includes(search.toLowerCase()) ||
      item.department.toLowerCase().includes(search.toLowerCase());
    return matchesPriority && matchesSearch;
  });

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-red-600 text-white font-bold';
      case 'HIGH':
        return 'bg-amber-500 text-white font-bold';
      case 'MEDIUM':
        return 'bg-blue-600 text-white';
      default:
        return 'bg-slate-200 text-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Controls */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Officer Triage & Decision Cockpit
            </h1>
            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-semibold">
              Officer View
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Departmental grievance intake, reassignment monitoring, and resolution progress.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow transition disabled:opacity-50 self-start md:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Sync Grievance Queue
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Total Active Queue</span>
            <ShieldCheck size={18} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalCases}</div>
          <p className="text-[11px] text-slate-500 mt-1">Managed grievances</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Critical Priority</span>
            <Flame size={18} className="text-red-600" />
          </div>
          <div className="text-2xl font-black text-red-600">{criticalCases}</div>
          <p className="text-[11px] text-slate-500 mt-1">Requiring immediate action</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Reassignment Loops</span>
            <Repeat size={18} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600">{reassignLoops}</div>
          <p className="text-[11px] text-slate-500 mt-1">&ge; 2 department handoffs</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Stale Cases</span>
            <Clock size={18} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-600">{staleCases}</div>
          <p className="text-[11px] text-slate-500 mt-1">&gt; 7 days without update</p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative md:col-span-2">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ID, summary, or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="relative">
          <Filter size={16} className="absolute left-3 top-3 text-slate-400" />
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Triage Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <span className="font-semibold text-sm text-slate-800">
            Assigned Caseload ({filtered.length} entries)
          </span>
          <span className="text-xs text-slate-500">Live SLA monitoring active</span>
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
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-6 py-3">Grievance Issue</th>
                  <th className="px-3 py-3">Priority</th>
                  <th className="px-3 py-3">Handoffs</th>
                  <th className="px-4 py-3">SLA Alert</th>
                  <th className="px-4 py-3 text-right">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                      {item.id}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-700 whitespace-nowrap">
                      {item.department}
                    </td>
                    <td className="px-6 py-3.5 max-w-sm">
                      <p className="line-clamp-2 text-slate-800">
                        {item.text}
                      </p>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${getPriorityBadge(item.priority)}`}>
                        {item.priority}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        item.reassignments >= 2
                          ? 'bg-amber-100 text-amber-800 font-bold border border-amber-300'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {item.reassignments} handoffs
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {item.slaMetrics?.isSlaBreached ? (
                        <span className="inline-flex items-center gap-1 text-red-600 font-bold">
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
                          Within SLA ({item.slaMetrics?.ageDays || 0}d)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <Link
                        to={`/complaints/${item.id}`}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold"
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
