import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyComplaints } from '../api/client';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import {
  Search,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  FilePlus,
  ArrowUpDown,
  Inbox,
  Clock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function MyComplaintsPage() {
  const [complaints, setComplaints] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('createdAt_desc');
  const [currentPage, setCurrentPage] = useState(1);

  const loadData = async (page = currentPage) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchMyComplaints({
        search: search.trim() || undefined,
        category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        sort: sortOrder,
        page: String(page),
        limit: '10'
      });

      if (res.pagination) {
        setComplaints(res.data || []);
        setPagination(res.pagination);
      } else {
        const list = Array.isArray(res.data) ? res.data : (res.data?.items || []);
        setComplaints(list);
        setPagination(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to load your complaints');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    loadData(1);
  }, [categoryFilter, statusFilter, sortOrder]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    loadData(1);
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    loadData(newPage);
  };

  const isFiltered = Boolean(search.trim() || categoryFilter !== 'ALL' || statusFilter !== 'ALL');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Registered Grievances</h1>
          <p className="text-sm text-slate-600 mt-1">
            Track and monitor civic complaints filed under your verified account.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/citizen/submit"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <FilePlus size={15} />
            <span>Lodge New Grievance</span>
          </Link>
          <button
            onClick={() => loadData(currentPage)}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition disabled:opacity-50"
            title="Refresh"
            aria-label="Refresh complaint list"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <form onSubmit={handleSearchSubmit} className="relative md:col-span-2 flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search reference no, title, location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition"
          >
            Search
          </button>
        </form>

        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-700"
          >
            <option value="ALL">All Categories</option>
            <option value="roads">Roads & Infrastructure</option>
            <option value="electricity">Electricity & Power</option>
            <option value="water">Drinking Water & Drainage</option>
            <option value="healthcare">Public Health</option>
            <option value="pension">Social Pensions</option>
            <option value="scholarship">Scholarships</option>
            <option value="ration">Ration & PDS</option>
            <option value="municipal">Municipal Sanitation</option>
            <option value="revenue">Revenue & Land</option>
            <option value="police">Police Liaison</option>
            <option value="flood relief">Flood Relief</option>
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-700"
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

        <div>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-700"
          >
            <option value="createdAt_desc">Newest First</option>
            <option value="createdAt_asc">Oldest First</option>
            <option value="priority_desc">Priority (Highest)</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="shrink-0" />
            <div className="text-sm">
              <span className="font-semibold">Error:</span> {error}
            </div>
          </div>
          <button
            onClick={() => loadData(currentPage)}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Complaints List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <span className="font-bold text-sm text-slate-800">
            Complaints Archive ({pagination ? pagination.total : complaints.length} records)
          </span>
          <span className="text-xs text-slate-500">Live verified citizen filings</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500 flex flex-col items-center gap-3">
            <RefreshCw size={24} className="animate-spin text-blue-600" />
            <span>Loading grievances...</span>
          </div>
        ) : complaints.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
              <Inbox size={24} />
            </div>
            {isFiltered ? (
              <p>No complaints match the specified search or filter criteria.</p>
            ) : (
              <div className="space-y-1">
                <p className="font-semibold text-slate-700">You have not submitted any grievances yet.</p>
                <p className="text-xs text-slate-500">Click below to file your first civic complaint.</p>
              </div>
            )}
            <div className="pt-2">
              <Link
                to="/citizen/submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition"
              >
                <FilePlus size={14} />
                <span>Submit Grievance</span>
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
                  <th className="px-6 py-3">Grievance Subject & Location</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date Lodged</th>
                  <th className="px-4 py-3">Last Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {complaints.map((item) => (
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
                        {item.locality ? `${item.locality}, ` : ''}{item.district}, {item.state}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div>
                        <StatusBadge status={item.status} />
                        {item.statusDescription && (
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
                        <span>Timeline</span>
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

        {/* Pagination Controls */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div>
              Page <span className="font-semibold">{pagination.page}</span> of{' '}
              <span className="font-semibold">{pagination.totalPages}</span> ({pagination.total} total)
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-50 transition"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-50 transition"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
