import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyComplaints } from '../api/client';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import { useLanguage } from '../context/LanguageContext';
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
  const { t, lang, formatDate, tCategory, tStatus } = useLanguage();
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('myComplaintsPage.title')}</h1>
          <p className="text-sm text-slate-600 mt-1">
            {t('myComplaintsPage.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/citizen/submit"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <FilePlus size={15} />
            <span>{t('myComplaintsPage.lodgeNewBtn')}</span>
          </Link>
          <button
            onClick={() => loadData(currentPage)}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition disabled:opacity-50"
            title={t('common.refresh')}
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
              placeholder={t('myComplaintsPage.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition"
          >
            {t('common.search')}
          </button>
        </form>

        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-700"
          >
            <option value="ALL">{t('myComplaintsPage.categoryFilterAll')}</option>
            <option value="roads">{tCategory('roads')}</option>
            <option value="electricity">{tCategory('electricity')}</option>
            <option value="water">{tCategory('water')}</option>
            <option value="healthcare">{tCategory('healthcare')}</option>
            <option value="pension">{tCategory('pension')}</option>
            <option value="scholarship">{tCategory('scholarship')}</option>
            <option value="ration">{tCategory('ration')}</option>
            <option value="municipal">{tCategory('municipal')}</option>
            <option value="revenue">{tCategory('revenue')}</option>
            <option value="police">{tCategory('police')}</option>
            <option value="flood relief">{tCategory('flood relief')}</option>
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-700"
          >
            <option value="ALL">{t('myComplaintsPage.statusFilterAll')}</option>
            <option value="SUBMITTED">{tStatus('SUBMITTED')}</option>
            <option value="UNDER_REVIEW">{tStatus('UNDER_REVIEW')}</option>
            <option value="ASSIGNED">{tStatus('ASSIGNED')}</option>
            <option value="IN_PROGRESS">{tStatus('IN_PROGRESS')}</option>
            <option value="AWAITING_INFORMATION">{tStatus('AWAITING_INFORMATION')}</option>
            <option value="RESOLVED">{tStatus('RESOLVED')}</option>
            <option value="CLOSED">{tStatus('CLOSED')}</option>
          </select>
        </div>

        <div>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-700"
          >
            <option value="createdAt_desc">{t('myComplaintsPage.sortNewest')}</option>
            <option value="createdAt_asc">{t('myComplaintsPage.sortOldest')}</option>
            <option value="priority_desc">{t('myComplaintsPage.sortPriority')}</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="shrink-0" />
            <div className="text-sm">
              <span className="font-semibold">{t('common.error')}:</span> {error}
            </div>
          </div>
          <button
            onClick={() => loadData(currentPage)}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition"
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      {/* Complaints List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <span className="font-bold text-sm text-slate-800">
            {lang === 'hi'
              ? `शिकायत संग्रह (${pagination ? pagination.total : complaints.length} रिकॉर्ड)`
              : `Complaints Archive (${pagination ? pagination.total : complaints.length} records)`}
          </span>
          <span className="text-xs text-slate-500">
            {lang === 'hi' ? 'सत्यापित नागरिक फाइलिंग' : 'Live verified citizen filings'}
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500 flex flex-col items-center gap-3">
            <RefreshCw size={24} className="animate-spin text-blue-600" />
            <span>{t('common.loading')}</span>
          </div>
        ) : complaints.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
              <Inbox size={24} />
            </div>
            {isFiltered ? (
              <p>{t('myComplaintsPage.noComplaintsDesc')}</p>
            ) : (
              <div className="space-y-1">
                <p className="font-semibold text-slate-700">{t('myComplaintsPage.noComplaintsFound')}</p>
                <p className="text-xs text-slate-500">
                  {lang === 'hi' ? 'अपनी पहली नागरिक शिकायत दर्ज करने के लिए नीचे क्लिक करें।' : 'Click below to file your first civic complaint.'}
                </p>
              </div>
            )}
            <div className="pt-2">
              <Link
                to="/citizen/submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition"
              >
                <FilePlus size={14} />
                <span>{t('submitGrievance')}</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">{t('common.referenceNo')}</th>
                  <th className="px-4 py-3">{t('common.category')}</th>
                  <th className="px-6 py-3">{lang === 'hi' ? 'शिकायत विषय एवं स्थान' : 'Grievance Subject & Location'}</th>
                  <th className="px-4 py-3">{t('common.status')}</th>
                  <th className="px-4 py-3">{t('common.filedDate')}</th>
                  <th className="px-4 py-3">{t('common.lastUpdated')}</th>
                  <th className="px-4 py-3 text-right">{t('common.actions')}</th>
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
                        {tCategory(item.category)}
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
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-500">
                      {formatDate(item.updatedAt || item.lastUpdated || item.createdAt)}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-2">
                      <Link
                        to={`/citizen/track/${encodeURIComponent(item.referenceNumber || item.id)}`}
                        className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold"
                      >
                        <span>{lang === 'hi' ? 'समयरेखा' : 'Timeline'}</span>
                      </Link>
                      <Link
                        to={`/citizen/complaints/${encodeURIComponent(item.id)}`}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold"
                      >
                        <span>{t('common.details')}</span>
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
              {lang === 'hi'
                ? `पृष्ठ ${pagination.page} / ${pagination.totalPages} (कुल ${pagination.total})`
                : `Page ${pagination.page} of ${pagination.totalPages} (${pagination.total} total)`}
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
