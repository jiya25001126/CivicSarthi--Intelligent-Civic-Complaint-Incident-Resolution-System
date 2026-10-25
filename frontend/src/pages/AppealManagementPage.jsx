import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchAppeals,
  updateAppealStatus,
  addAppealNote,
  recordAppealDecision
} from '../api/client';
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  MessageSquare,
  Shield,
  ChevronRight
} from 'lucide-react';

const APPEAL_STATUS_BADGES = {
  SUBMITTED: { label: 'Submitted', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  UNDER_REVIEW: { label: 'Under Review', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  NEED_MORE_INFORMATION: { label: 'Need Info', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
  UPHELD: { label: 'Upheld (In Citizen Favor)', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
  REJECTED: { label: 'Rejected', bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200' },
  WITHDRAWN: { label: 'Withdrawn', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' }
};

export default function AppealManagementPage() {
  const { user, isOfficer, isAdmin } = useAuth();
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Decision Modal State
  const [selectedAppeal, setSelectedAppeal] = useState(null);
  const [decisionType, setDecisionType] = useState('UPHELD');
  const [decisionReason, setDecisionReason] = useState('');
  const [citizenExplanation, setCitizenExplanation] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState(null);

  // Status Change State
  const [statusModalAppeal, setStatusModalAppeal] = useState(null);
  const [targetStatus, setTargetStatus] = useState('UNDER_REVIEW');
  const [statusRemarks, setStatusRemarks] = useState('');
  const [submittingStatus, setSubmittingStatus] = useState(false);

  // Note Modal State
  const [noteModalAppeal, setNoteModalAppeal] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  const loadAppeals = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const res = await fetchAppeals(params);
      setAppeals(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppeals();
  }, [statusFilter]);

  const handleRecordDecision = async (e) => {
    e.preventDefault();
    if (!selectedAppeal) return;
    try {
      setSubmittingDecision(true);
      setDecisionError(null);
      await recordAppealDecision(selectedAppeal.id, {
        decision: decisionType,
        decisionReason,
        citizenExplanation: citizenExplanation || decisionReason
      });
      setSelectedAppeal(null);
      setDecisionReason('');
      setCitizenExplanation('');
      await loadAppeals();
    } catch (err) {
      setDecisionError(err.message);
    } finally {
      setSubmittingDecision(false);
    }
  };

  const handleStatusChange = async (e) => {
    e.preventDefault();
    if (!statusModalAppeal) return;
    try {
      setSubmittingStatus(true);
      await updateAppealStatus(statusModalAppeal.id, {
        status: targetStatus,
        remarks: statusRemarks
      });
      setStatusModalAppeal(null);
      setStatusRemarks('');
      await loadAppeals();
    } catch (err) {
      alert(`Error updating status: ${err.message}`);
    } finally {
      setSubmittingStatus(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteModalAppeal || !noteText.trim()) return;
    try {
      setSubmittingNote(true);
      await addAppealNote(noteModalAppeal.id, { note: noteText });
      setNoteModalAppeal(null);
      setNoteText('');
      await loadAppeals();
    } catch (err) {
      alert(`Error saving note: ${err.message}`);
    } finally {
      setSubmittingNote(false);
    }
  };

  const filteredAppeals = appeals.filter(a => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      a.id?.toLowerCase().includes(q) ||
      a.referenceNumber?.toLowerCase().includes(q) ||
      a.complaintReference?.toLowerCase().includes(q) ||
      a.reasonCategory?.toLowerCase().includes(q) ||
      a.citizenExplanation?.toLowerCase().includes(q)
    );
  });

  const pendingCount = appeals.filter(a => ['SUBMITTED', 'UNDER_REVIEW', 'NEED_MORE_INFORMATION'].includes(a.status)).length;
  const upheldCount = appeals.filter(a => a.status === 'UPHELD').length;
  const rejectedCount = appeals.filter(a => a.status === 'REJECTED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Resolution Appeals Desk
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
              Appeals Review Desk
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Formal citizen disputes against completed grievance resolutions. Review evidence, record findings, and issue binding decisions.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={loadAppeals}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Stats KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase block mb-1">Total Caseload</span>
          <div className="text-2xl font-black text-slate-900">{appeals.length}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Assigned to authorized scope</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/30 shadow-sm">
          <span className="text-xs font-semibold text-amber-700 uppercase block mb-1">Active Review</span>
          <div className="text-2xl font-black text-amber-900">{pendingCount}</div>
          <p className="text-[11px] text-amber-700 mt-0.5">Pending official adjudication</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-sm">
          <span className="text-xs font-semibold text-emerald-700 uppercase block mb-1">Upheld</span>
          <div className="text-2xl font-black text-emerald-900">{upheldCount}</div>
          <p className="text-[11px] text-emerald-700 mt-0.5">Citizen dispute sustained</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/30 shadow-sm">
          <span className="text-xs font-semibold text-rose-700 uppercase block mb-1">Rejected</span>
          <div className="text-2xl font-black text-rose-900">{rejectedCount}</div>
          <p className="text-[11px] text-rose-700 mt-0.5">Resolution upheld as valid</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by appeal ID, complaint reference, or reason..."
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
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="NEED_MORE_INFORMATION">Need More Info</option>
            <option value="UPHELD">Upheld</option>
            <option value="REJECTED">Rejected</option>
            <option value="WITHDRAWN">Withdrawn</option>
          </select>
        </div>
      </div>

      {/* Appeals List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <RefreshCw size={24} className="animate-spin mx-auto text-blue-600" />
            <p className="text-xs font-semibold">Loading appeals queue...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 space-y-2">
            <AlertCircle size={24} className="mx-auto" />
            <p className="text-xs font-bold">{error}</p>
          </div>
        ) : filteredAppeals.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <ShieldAlert size={32} className="mx-auto text-slate-300" />
            <h3 className="font-bold text-slate-700 text-sm">No Appeals Found</h3>
            <p className="text-xs text-slate-400">There are no appeals matching your current filters in your authorized department scope.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="p-3.5 pl-6">Appeal Ref</th>
                  <th className="p-3.5">Grievance Case</th>
                  <th className="p-3.5">Reason Category</th>
                  <th className="p-3.5">Citizen Explanation</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Submission Date</th>
                  <th className="p-3.5 pr-6 text-right">Desk Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAppeals.map((appeal) => {
                  const badge = APPEAL_STATUS_BADGES[appeal.status] || APPEAL_STATUS_BADGES.SUBMITTED;
                  const isPending = ['SUBMITTED', 'UNDER_REVIEW', 'NEED_MORE_INFORMATION'].includes(appeal.status);

                  return (
                    <tr key={appeal.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3.5 pl-6 font-mono font-bold text-blue-700">
                        {appeal.referenceNumber || appeal.id}
                      </td>
                      <td className="p-3.5">
                        <Link
                          to={`/officer/complaints/${appeal.complaintId || appeal.complaintReference}`}
                          className="font-mono font-bold text-slate-800 hover:text-blue-600 flex items-center gap-1"
                        >
                          <span>{appeal.complaintReference || appeal.complaintId}</span>
                          <ExternalLink size={11} className="text-slate-400" />
                        </Link>
                        <span className="text-[10px] text-slate-400 block">Cycle #{appeal.resolutionMilestone || 1}</span>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                          {appeal.reasonCategory}
                        </span>
                      </td>
                      <td className="p-3.5 max-w-xs truncate text-slate-700" title={appeal.citizenExplanation}>
                        {appeal.citizenExplanation}
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-500 whitespace-nowrap">
                        {new Date(appeal.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="p-3.5 pr-6 text-right whitespace-nowrap space-x-1.5">
                        <button
                          onClick={() => {
                            setNoteModalAppeal(appeal);
                            setNoteText('');
                          }}
                          className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-300 font-semibold text-[11px] transition"
                          title="Add internal note"
                        >
                          Note
                        </button>
                        {isPending && (
                          <>
                            <button
                              onClick={() => {
                                setStatusModalAppeal(appeal);
                                setTargetStatus(appeal.status === 'SUBMITTED' ? 'UNDER_REVIEW' : 'NEED_MORE_INFORMATION');
                                setStatusRemarks('');
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg border border-slate-300 font-semibold text-[11px] transition"
                            >
                              Transition
                            </button>
                            <button
                              onClick={() => {
                                setSelectedAppeal(appeal);
                                setDecisionType('UPHELD');
                                setDecisionReason('');
                                setCitizenExplanation('');
                                setDecisionError(null);
                              }}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-[11px] shadow-sm transition"
                            >
                              Decide
                            </button>
                          </>
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

      {/* Formal Decision Modal */}
      {selectedAppeal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-blue-600" />
                <h3 className="font-bold text-base text-slate-900">
                  Adjudicate Resolution Appeal
                </h3>
              </div>
              <span className="font-mono text-xs text-slate-500 font-bold">
                {selectedAppeal.referenceNumber || selectedAppeal.id}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Related Complaint:</span>
                <span className="font-mono font-bold text-slate-800">{selectedAppeal.complaintReference || selectedAppeal.complaintId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reason Category:</span>
                <span className="font-bold text-slate-800">{selectedAppeal.reasonCategory}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Citizen Explanation:</span>
                <p className="p-2 bg-white rounded border border-slate-200 text-slate-700 italic">
                  "{selectedAppeal.citizenExplanation}"
                </p>
              </div>
            </div>

            <form onSubmit={handleRecordDecision} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Binding Decision Verdict *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDecisionType('UPHELD')}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition ${
                      decisionType === 'UPHELD'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    ✓ UPHELD (Citizen Favor)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisionType('REJECTED')}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition ${
                      decisionType === 'REJECTED'
                        ? 'bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-500'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    ✗ REJECTED (Resolution Sustained)
                  </button>
                </div>
                {decisionType === 'UPHELD' && (
                  <p className="text-[11px] text-amber-700 mt-2 bg-amber-50 p-2 rounded border border-amber-200">
                    ℹ️ Note: Upholding an appeal officially validates the citizen's dispute. Note that actual grievance reopening requires the approved Reopening workflow.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Official Decision Reason (Mandatory, internal audit) *
                </label>
                <textarea
                  required
                  rows={2}
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  placeholder="Record factual basis, evidence review findings, or standard remediation policies applied..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Citizen-Visible Explanation *
                </label>
                <textarea
                  required
                  rows={2}
                  value={citizenExplanation}
                  onChange={(e) => setCitizenExplanation(e.target.value)}
                  placeholder="Official citizen response explaining the appeal outcome..."
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
                  onClick={() => setSelectedAppeal(null)}
                  disabled={submittingDecision}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDecision || !decisionReason.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow transition disabled:opacity-50"
                >
                  {submittingDecision ? 'Submitting Verdict...' : 'Confirm Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Internal Note Modal */}
      {noteModalAppeal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 p-5 space-y-3">
            <h3 className="font-bold text-sm text-slate-900">
              Add Internal Appeal Note
            </h3>
            <p className="text-xs text-slate-500">
              Internal notes are confidential to officers and supervisors and are never exposed via public tracking.
            </p>
            <form onSubmit={handleAddNote} className="space-y-3">
              <textarea
                required
                rows={3}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Enter confidential case notes, consultation findings, or supervisory instructions..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNoteModalAppeal(null)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingNote || !noteText.trim()}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                >
                  {submittingNote ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Transition Modal */}
      {statusModalAppeal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 p-5 space-y-3">
            <h3 className="font-bold text-sm text-slate-900">
              Transition Appeal Status
            </h3>
            <form onSubmit={handleStatusChange} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Target Status
                </label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                >
                  <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                  <option value="NEED_MORE_INFORMATION">NEED_MORE_INFORMATION</option>
                  <option value="WITHDRAWN">WITHDRAWN</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Remarks / Reason
                </label>
                <input
                  type="text"
                  value={statusRemarks}
                  onChange={(e) => setStatusRemarks(e.target.value)}
                  placeholder="Reason for lifecycle transition..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStatusModalAppeal(null)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingStatus}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                >
                  {submittingStatus ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
