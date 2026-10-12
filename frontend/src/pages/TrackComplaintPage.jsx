import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchComplaintTracking } from '../api/client';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import {
  Search,
  CheckCircle2,
  Clock,
  User,
  ShieldCheck,
  Building2,
  ArrowRight,
  AlertCircle,
  FileText,
  MapPin,
  Calendar,
  ExternalLink,
  Shield,
  Lock
} from 'lucide-react';
import {
  formatOutcomeType,
  formatVerificationMethod,
  formatExceptionReason
} from '../constants/resolutionQuality.constants';

export default function TrackComplaintPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [inputQuery, setInputQuery] = useState(id || '');
  const [complaint, setComplaint] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const performSearch = async (searchId) => {
    if (!searchId || !searchId.trim()) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetchComplaintTracking(searchId.trim());
      setComplaint(res.data);
      setHistory(res.data?.statusHistory || []);
    } catch (err) {
      setError(err.message || 'Grievance reference not found. Please verify the reference number.');
      setComplaint(null);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      setInputQuery(id);
      performSearch(id);
    }
  }, [id]);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (inputQuery.trim()) {
      navigate(`/citizen/track/${encodeURIComponent(inputQuery.trim())}`);
      performSearch(inputQuery.trim());
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Search Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Search size={24} className="text-blue-600" />
            Track Grievance Progression
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Enter your unique reference number (e.g. <span className="font-mono font-semibold">CS-2026-0001</span> or <span className="font-mono font-semibold">CPG-2026-00101</span>) to see the live status audit trail.
          </p>
        </div>

        <form onSubmit={handleFormSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <label htmlFor="track-search-input" className="sr-only">Reference Number</label>
            <Search size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
            <input
              id="track-search-input"
              type="text"
              required
              placeholder="Enter reference number (e.g. CS-2026-0001)..."
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono font-semibold"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm transition disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Track Status'}
          </button>
        </form>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-center gap-3 text-sm">
          <AlertCircle size={20} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results View */}
      {complaint && (
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-xl text-blue-700">
                    {complaint.referenceNumber || complaint.id}
                  </span>
                  <StatusBadge status={complaint.status} />
                  <PriorityBadge priority={complaint.priority} />
                </div>
                <h2 className="text-base font-bold text-slate-900 mt-1">
                  {complaint.title || complaint.text}
                </h2>
                {complaint.statusDescription && (
                  <p className="text-xs text-blue-800 bg-blue-50/80 p-2.5 rounded-lg border border-blue-200 mt-2">
                    <span className="font-semibold">Current Status Meaning: </span>
                    {complaint.statusDescription}
                  </p>
                )}
              </div>
              <Link
                to={`/citizen/complaints/${encodeURIComponent(complaint.id)}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold self-start sm:self-auto transition"
              >
                <span>Citizen View</span>
                <ExternalLink size={13} />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block mb-0.5">Assigned Department</span>
                <span className="font-bold text-slate-800">{complaint.departmentId || complaint.department}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block mb-0.5">Jurisdiction</span>
                <span className="font-bold text-slate-800">{complaint.district}, {complaint.state}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block mb-0.5">Registration Date</span>
                <span className="font-bold text-slate-800">
                  {new Date(complaint.createdAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block mb-0.5">Handoffs / Reassignments</span>
                <span className="font-bold text-slate-800">{complaint.reassignments || 0} times</span>
              </div>
            </div>

            {/* Privacy Notice */}
            <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <Lock size={13} className="text-slate-400 shrink-0" />
              <span>Public Tracking View: Private citizen contact information and internal officer review notes are strictly protected.</span>
            </div>
          </div>

          {/* Official Resolution Verification Record Card (Citizen Public Tracking View) */}
          {complaint.resolutionDetails && (
            <div className="bg-gradient-to-br from-emerald-50/50 to-white p-6 rounded-2xl border-2 border-emerald-500 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                  <div>
                    <h3 className="font-bold text-base text-slate-900">
                      Official Resolution Verification Record
                    </h3>
                    <p className="text-xs text-slate-500">
                      Procedural quality criteria verified under Phase 9 Resolution Standards
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Status: {complaint.status}
                  </span>
                  {typeof complaint.resolutionDetails.score === 'number' && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
                      {complaint.resolutionDetails.score}% Compliance Score
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-white rounded-xl border border-emerald-200/80">
                  <span className="text-slate-500 block mb-0.5">Remediation Outcome</span>
                  <span className="font-bold text-slate-900">
                    {formatOutcomeType(complaint.resolutionDetails.outcomeType)}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-emerald-200/80">
                  <span className="text-slate-500 block mb-0.5">Verification Method</span>
                  <span className="font-bold text-slate-900">
                    {formatVerificationMethod(complaint.resolutionDetails.verificationMethod)}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-emerald-200/80">
                  <span className="text-slate-500 block mb-0.5">Resolution Date</span>
                  <span className="font-bold text-slate-900">
                    {complaint.resolutionDetails.resolvedAt
                      ? new Date(complaint.resolutionDetails.resolvedAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'Recorded'}
                  </span>
                </div>
              </div>

              {complaint.resolutionDetails.closureRemarks && (
                <div className="p-3.5 bg-white rounded-xl border border-emerald-200/80 space-y-1">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Official Closure Summary
                  </span>
                  <p className="text-xs text-slate-800 leading-relaxed font-normal">
                    {complaint.resolutionDetails.closureRemarks}
                  </p>
                </div>
              )}

              {complaint.resolutionDetails.isException && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                  <ShieldCheck size={16} className="text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Supervisory Administrative Exception Applied: </span>
                    <span>
                      {formatExceptionReason(complaint.resolutionDetails.exceptionReason)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status Progression Timeline */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">
                Audit Trail & Status Progression Timeline
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {history.length} lifecycle events
              </span>
            </div>

            {history.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4">No status progression recorded yet.</p>
            ) : (
              <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {history.map((event, idx) => {
                  const isLatest = idx === history.length - 1;
                  return (
                    <div key={idx} className="relative group">
                      {/* Timeline dot */}
                      <div
                        className={`absolute -left-6 sm:-left-8 top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          isLatest
                            ? 'bg-blue-600 border-white text-white shadow-md ring-4 ring-blue-100'
                            : 'bg-white border-slate-400 text-slate-600'
                        }`}
                      >
                        <Clock size={12} />
                      </div>

                      <div className="space-y-1.5 bg-slate-50/60 p-4 rounded-xl border border-slate-200/80">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={event.status} />
                            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                              {event.actorType || 'OFFICER'}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 font-medium">
                            {new Date(event.timestamp).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>

                        {event.statusDescription && (
                          <p className="text-[11px] text-blue-700 italic font-medium">
                            {event.statusDescription}
                          </p>
                        )}

                        <p className="text-xs text-slate-700 leading-relaxed font-normal pt-0.5">
                          {event.remarks || 'Status updated in system.'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
