import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchReopeningRequests,
  recordReopeningDecision
} from '../api/client';
import {
  RotateCcw,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  AlertCircle,
  FileText,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';

const REOPENING_STATUS_BADGES = {
  PENDING_REVIEW: { label: 'Pending Review', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  APPROVED: { label: 'Approved (Reopened)', bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200' },
  REJECTED: { label: 'Rejected', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' }
};

export default function ReopeningManagementPage() {
  const { user, isOfficer, isAdmin } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Decision Modal State
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [decisionType, setDecisionType] = useState('APPROVED');
  const [decisionReason, setDecisionReason] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState(null);

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const res = await fetchReopeningRequests(params);
      setRequests(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [statusFilter]);

  const handleRecordDecision = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    try {
      setSubmittingDecision(true);
      setDecisionError(null);
      await recordReopeningDecision(selectedRequest.id, {
        decision: decisionType,
        decisionReason
      });
      setSelectedRequest(null);
      setDecisionReason('');
      await loadRequests();
    } catch (err) {
      setDecisionError(err.message);
    } finally {
      setSubmittingDecision(false);
    }
  };

  const filteredRequests = requests.filter(r => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      r.id?.toLowerCase().includes(q) ||
      r.complaintId?.toLowerCase().includes(q) ||
      r.complaintReference?.toLowerCase().includes(q) ||
      r.reasonCategory?.toLowerCase().includes(q) ||
      r.citizenExplanation?.toLowerCase().includes(q)
    );
  });

  const pendingCount = requests.filter(r => r.status === 'PENDING_REVIEW').length;
  const approvedCount = requests.filter(r => r.status === 'APPROVED').length;
  const rejectedCount = requests.filter(r => r.status === 'REJECTED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Controlled Grievance Reopening Desk
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-xs font-semibold">
              Supervisory Review Desk
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Supervisory desk for citizen reopening petitions. Approving a request resets the complaint status to REOPENED and enforces full resolution quality re-verification.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={loadRequests}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase block mb-1">Total Petitions</span>
          <div className="text-2xl font-black text-slate-900">{requests.length}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Assigned to department scope</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/30 shadow-sm">
          <span className="text-xs font-semibold text-amber-700 uppercase block mb-1">Pending Adjudication</span>
          <div className="text-2xl font-black text-amber-900">{pendingCount}</div>
          <p className="text-[11px] text-amber-700 mt-0.5">Awaiting supervisor review</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/30 shadow-sm">
          <span className="text-xs font-semibold text-rose-700 uppercase block mb-1">Approved & Reopened</span>
          <div className="text-2xl font-black text-rose-900">{approvedCount}</div>
          <p className="text-[11px] text-rose-700 mt-0.5">Sent back for remediation</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 bg-slate-50/30 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase block mb-1">Rejected</span>
          <div className="text-2xl font-black text-slate-700">{rejectedCount}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Resolution maintained</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by request ID, complaint reference, or reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={14} className="text-slate-500 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="APPROVED">Approved (Reopened)</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Reopening Requests Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <RefreshCw size={24} className="animate-spin mx-auto text-blue-600" />
            <p className="text-xs font-semibold">Loading reopening petitions...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 space-y-2">
            <AlertCircle size={24} className="mx-auto" />
            <p className="text-xs font-bold">{error}</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <RotateCcw size={32} className="mx-auto text-slate-300" />
            <h3 className="font-bold text-slate-700 text-sm">No Reopening Petitions Found</h3>
            <p className="text-xs text-slate-400">There are no reopening requests matching your filters within your department scope.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="p-3.5 pl-6">Petition ID</th>
                  <th className="p-3.5">Grievance Case</th>
                  <th className="p-3.5">Reason Category</th>
                  <th className="p-3.5">Citizen Explanation</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Submission Date</th>
                  <th className="p-3.5 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((req) => {
                  const badge = REOPENING_STATUS_BADGES[req.status] || REOPENING_STATUS_BADGES.PENDING_REVIEW;
                  const isPending = req.status === 'PENDING_REVIEW';

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3.5 pl-6 font-mono font-bold text-slate-800">
                        {req.id}
                      </td>
                      <td className="p-3.5">
                        <Link
                          to={`/officer/complaints/${req.complaintId || req.complaintReference}`}
                          className="font-mono font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1"
                        >
                          <span>{req.complaintReference || req.complaintId}</span>
                          <ExternalLink size={11} className="text-slate-400" />
                        </Link>
                        <span className="text-[10px] text-slate-400 block">Cycle #{req.resolutionMilestone || 1}</span>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                          {req.reasonCategory}
                        </span>
                      </td>
                      <td className="p-3.5 max-w-xs truncate text-slate-700" title={req.citizenExplanation}>
                        {req.citizenExplanation}
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-500 whitespace-nowrap">
                        {new Date(req.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="p-3.5 pr-6 text-right whitespace-nowrap">
                        {isPending ? (
                          <button
                            onClick={() => {
                              setSelectedRequest(req);
                              setDecisionType('APPROVED');
                              setDecisionReason('');
                              setDecisionError(null);
                            }}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-[11px] shadow-sm transition flex items-center gap-1 ml-auto"
                          >
                            <RotateCcw size={12} />
                            <span>Adjudicate</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Decided ({req.status})
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Decision Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <RotateCcw size={18} className="text-rose-600" />
                <h3 className="font-bold text-base text-slate-900">
                  Adjudicate Grievance Reopening Petition
                </h3>
              </div>
              <span className="font-mono text-xs text-slate-500 font-bold">
                #{selectedRequest.id}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Related Complaint:</span>
                <span className="font-mono font-bold text-slate-800">{selectedRequest.complaintReference || selectedRequest.complaintId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reason Category:</span>
                <span className="font-bold text-slate-800">{selectedRequest.reasonCategory}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Citizen Explanation:</span>
                <p className="p-2 bg-white rounded border border-slate-200 text-slate-700 italic">
                  "{selectedRequest.citizenExplanation}"
                </p>
              </div>
            </div>

            <form onSubmit={handleRecordDecision} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reopening Verdict *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDecisionType('APPROVED')}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition ${
                      decisionType === 'APPROVED'
                        ? 'bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-500'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    ✓ APPROVE (Reopen Case)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisionType('REJECTED')}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition ${
                      decisionType === 'REJECTED'
                        ? 'bg-slate-100 border-slate-400 text-slate-800 ring-2 ring-slate-400'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    ✗ REJECT (Keep Resolved)
                  </button>
                </div>
              </div>

              {decisionType === 'APPROVED' ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                    <span>Consequential Operational Action:</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-rose-800">
                    <li>Complaint status will transition from RESOLVED/CLOSED to <strong>REOPENED</strong>.</li>
                    <li>Reopening count increments and Neglect Radar signal E triggers.</li>
                    <li>The case <strong>cannot be re-resolved</strong> without satisfying all required resolution quality checks.</li>
                  </ul>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
                  <span>Rejecting this petition will leave the complaint in its current resolved state. A reasoned explanation is required.</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Adjudication Decision Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  placeholder="Record factual justification for approving or rejecting this reopening petition..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {decisionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                  {decisionError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  disabled={submittingDecision}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDecision || !decisionReason.trim()}
                  className={`px-5 py-2 text-white rounded-lg text-xs font-semibold shadow transition disabled:opacity-50 ${
                    decisionType === 'APPROVED' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-800 hover:bg-slate-900'
                  }`}
                >
                  {submittingDecision ? 'Processing...' : `Confirm ${decisionType}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
