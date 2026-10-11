import React, { useEffect, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchComplaintById,
  updateComplaintStatus,
  reassignComplaintDepartment,
  addOfficerNote,
  fetchDepartments,
  updateComplaintPriority,
  linkComplaintDuplicate,
  fetchComplaintDuplicates
} from '../api/client';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Shield,
  ShieldCheck,
  FileCheck,
  AlertTriangle,
  FileText,
  Paperclip,
  CheckCircle2,
  RefreshCw,
  Send,
  Building2,
  Lock,
  MessageSquare,
  AlertCircle,
  Sparkles,
  Link as LinkIcon,
  Copy
} from 'lucide-react';

export default function ComplaintDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const { user, isOfficer, isAdmin } = useAuth();

  // Check if accessed through officer route and user is authorized
  const isOfficerMode = location.pathname.startsWith('/officer') || isOfficer || isAdmin;

  const [complaint, setComplaint] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Officer action states
  const [newStatus, setNewStatus] = useState('');
  const [statusRemarks, setStatusRemarks] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const [reassignDeptId, setReassignDeptId] = useState('');
  const [reassignRemarks, setReassignRemarks] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [reassignMessage, setReassignMessage] = useState(null);

  const [officerNote, setOfficerNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteMessage, setNoteMessage] = useState(null);

  // Phase 6: AI intelligence triage action states
  const [newPriority, setNewPriority] = useState('');
  const [priorityRemarks, setPriorityRemarks] = useState('');
  const [priorityUpdating, setPriorityUpdating] = useState(false);
  const [priorityMessage, setPriorityMessage] = useState(null);

  const [duplicates, setDuplicates] = useState([]);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);
  const [selectedDuplicateId, setSelectedDuplicateId] = useState('');
  const [duplicateRemarks, setDuplicateRemarks] = useState('');
  const [linkingDuplicate, setLinkingDuplicate] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [compRes, deptsRes] = await Promise.all([
        fetchComplaintById(id),
        fetchDepartments()
      ]);
      const comp = compRes.data;
      setComplaint(comp);
      setDepartments(deptsRes.data || []);
      if (comp) {
        setReassignDeptId(comp.departmentId || comp.department || '');
        setNewPriority(comp.priority || 'MEDIUM');
        if (comp.intelligence?.duplicates) {
          setDuplicates(comp.intelligence.duplicates);
        }
      }

      // Fetch fresh candidate duplicates in officer mode
      if (isOfficerMode) {
        try {
          const dupRes = await fetchComplaintDuplicates(id);
          if (dupRes?.data?.duplicates) {
            setDuplicates(dupRes.data.duplicates);
          }
        } catch (dupErr) {
          console.info('Fresh duplicates lookup skipped:', dupErr.message);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle priority update / override
  const handlePriorityUpdate = async (e) => {
    e.preventDefault();
    if (!newPriority || newPriority === complaint.priority) return;
    try {
      setPriorityUpdating(true);
      setPriorityMessage(null);
      const res = await updateComplaintPriority(complaint.id, {
        priority: newPriority,
        remarks: priorityRemarks.trim(),
        actorType: 'OFFICER'
      });
      setComplaint(res.data);
      setPriorityMessage({ type: 'success', text: `Priority successfully updated to ${newPriority}` });
      setPriorityRemarks('');
    } catch (err) {
      setPriorityMessage({ type: 'error', text: err.message });
    } finally {
      setPriorityUpdating(false);
    }
  };

  // Handle linking duplicate
  const handleLinkDuplicate = async (targetId) => {
    if (!targetId) return;
    try {
      setLinkingDuplicate(true);
      setDuplicateMessage(null);
      const res = await linkComplaintDuplicate(complaint.id, {
        duplicateOfId: targetId,
        remarks: duplicateRemarks.trim() || 'Correlated duplicate complaint during officer triage'
      });
      setComplaint(res.data);
      setDuplicateMessage({ type: 'success', text: `Successfully linked grievance #${complaint.id} as duplicate of #${targetId}` });
      setSelectedDuplicateId('');
      setDuplicateRemarks('');
    } catch (err) {
      setDuplicateMessage({ type: 'error', text: err.message });
    } finally {
      setLinkingDuplicate(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // Handle status update
  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    if (!newStatus) return;
    try {
      setStatusUpdating(true);
      setStatusMessage(null);
      const res = await updateComplaintStatus(complaint.id, {
        status: newStatus,
        remarks: statusRemarks.trim(),
        actorType: 'OFFICER'
      });
      setComplaint(res.data);
      setStatusMessage({ type: 'success', text: `Status updated to ${newStatus}` });
      setStatusRemarks('');
      setNewStatus('');
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setStatusUpdating(false);
    }
  };

  // Handle department reassignment
  const handleDepartmentReassign = async (e) => {
    e.preventDefault();
    if (!reassignDeptId || reassignDeptId === complaint.departmentId) return;
    try {
      setReassigning(true);
      setReassignMessage(null);
      const res = await reassignComplaintDepartment(complaint.id, {
        departmentId: reassignDeptId,
        remarks: reassignRemarks.trim(),
        actorType: 'OFFICER'
      });
      setComplaint(res.data);
      setReassignMessage({ type: 'success', text: `Complaint reassigned to ${reassignDeptId}` });
      setReassignRemarks('');
    } catch (err) {
      setReassignMessage({ type: 'error', text: err.message });
    } finally {
      setReassigning(false);
    }
  };

  // Handle adding internal note
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!officerNote.trim()) return;
    try {
      setSavingNote(true);
      setNoteMessage(null);
      const res = await addOfficerNote(complaint.id, {
        note: officerNote.trim(),
        officerId: 'DEMO_OFFICER_ADMIN'
      });
      setComplaint(res.data);
      setNoteMessage({ type: 'success', text: 'Officer note logged.' });
      setOfficerNote('');
    } catch (err) {
      setNoteMessage({ type: 'error', text: err.message });
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
        <RefreshCw size={24} className="animate-spin text-blue-600 mx-auto" />
        <p className="text-slate-600 text-sm">Loading grievance details for {id}...</p>
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 space-y-4">
        <div className="text-rose-600 font-semibold flex items-center gap-2">
          <AlertCircle size={18} />
          <span>Error retrieving complaint</span>
        </div>
        <p className="text-slate-600 text-sm">{error || 'Complaint not found.'}</p>
        <Link
          to={isOfficerMode ? '/officer/complaints' : '/citizen/complaints'}
          className="inline-flex items-center gap-2 text-blue-600 text-sm font-semibold"
        >
          <ArrowLeft size={16} /> Back to Complaints
        </Link>
      </div>
    );
  }

  // Allowed transitions map for officer dropdown guidance
  const STATUS_OPTIONS = [
    'SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS',
    'AWAITING_INFORMATION', 'RESOLVED', 'CLOSED', 'REOPENED'
  ];

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Link
          to={isOfficerMode ? '/officer/complaints' : '/citizen/complaints'}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 text-xs font-semibold bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"
        >
          <ArrowLeft size={14} /> Back to Grievance List
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to={`/citizen/track/${encodeURIComponent(complaint.referenceNumber || complaint.id)}`}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
          >
            View Status Timeline &rarr;
          </Link>
        </div>
      </div>

      {/* Main Detail Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-extrabold text-2xl text-blue-700">
                {complaint.referenceNumber || complaint.id}
              </span>
              <StatusBadge status={complaint.status} />
              <PriorityBadge priority={complaint.priority} />
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-slate-200 text-slate-800 capitalize">
                {complaint.category}
              </span>
              {complaint.duplicateOf && (
                <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                  <LinkIcon size={12} />
                  Linked Duplicate of #{complaint.duplicateOf}
                </span>
              )}
              {complaint.intelligence?.priorityRecommendation?.publicSafetyHazard && (
                <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  Hazard Alert
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              {complaint.title || complaint.text}
            </h1>
            <p className="text-xs text-slate-500">
              Department Assigned:{' '}
              <span className="font-semibold text-slate-800">
                {complaint.departmentId || complaint.department}
              </span>
            </p>
            {complaint.statusDescription && (
              <div className="bg-blue-50/70 border border-blue-200 text-blue-900 text-xs p-2.5 rounded-xl">
                <span className="font-semibold">Status Meaning: </span>
                {complaint.statusDescription}
              </div>
            )}
          </div>

          <div className="text-left md:text-right self-start md:self-auto space-y-1">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-semibold">
              CPGRAMS Status Context
            </span>
            <span className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded-full">
              {complaint.officialStatus || complaint.status}
            </span>
          </div>
        </div>

        {/* Narrative & Location */}
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-2">
              Citizen Grievance Narrative
            </h2>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 text-sm leading-relaxed">
              {complaint.description || complaint.text}
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                <Calendar size={13} />
                <span>Date Lodged</span>
              </div>
              <span className="text-xs font-bold text-slate-800">
                {new Date(complaint.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                <Clock size={13} />
                <span>Last Updated</span>
              </div>
              <span className="text-xs font-bold text-slate-800">
                {new Date(complaint.updatedAt || complaint.lastUpdated).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                <Shield size={13} />
                <span>Department Handoffs</span>
              </div>
              <span className="text-xs font-bold text-slate-800">
                {complaint.reassignments || 0} reassignments
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                <AlertTriangle size={13} />
                <span>Citizen Reminders</span>
              </div>
              <span className="text-xs font-bold text-slate-800">
                {complaint.citizenReminders || 0} notifications
              </span>
            </div>
          </div>

          {/* Location & Language */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block">State:</span>
              <span className="font-semibold text-slate-800">{complaint.state || 'Not specified'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">District:</span>
              <span className="font-semibold text-slate-800">{complaint.district || 'Not specified'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Locality / Landmark:</span>
              <span className="font-semibold text-slate-800">{complaint.locality || 'General ward area'}</span>
            </div>
          </div>

          {/* Evidence Attachments */}
          <div>
            <h2 className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-2">
              Attached Evidence & Citations
            </h2>
            {complaint.evidence && complaint.evidence.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {complaint.evidence.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 text-xs font-medium"
                  >
                    <Paperclip size={13} className="text-blue-600" />
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No attachments lodged with this grievance.</p>
            )}
          </div>

          {/* SLA Diagnostic Box */}
          {complaint.slaMetrics && (
            <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2">
              <div className="flex items-center gap-2 text-blue-900 text-xs font-bold uppercase tracking-wider">
                <FileCheck size={15} className="text-blue-700" />
                <span>Configurable SLA Diagnostic</span>
              </div>
              <div className="text-xs text-slate-700 grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div>
                  <span className="text-slate-500">Case Age:</span>{' '}
                  <span className="font-semibold">{complaint.slaMetrics.ageDays} days</span> (SLA Target: {complaint.slaMetrics.slaDeadlineDays}d)
                </div>
                <div>
                  <span className="text-slate-500">Days Untouched:</span>{' '}
                  <span className="font-semibold">{complaint.slaMetrics.daysSinceUpdate} days</span>
                </div>
                <div>
                  <span className="text-slate-500">Compliance Health:</span>{' '}
                  {complaint.slaMetrics.isSlaBreached ? (
                    <span className="text-rose-700 font-bold">SLA Breached</span>
                  ) : complaint.slaMetrics.isStale ? (
                    <span className="text-amber-700 font-bold">Stalled / Stale</span>
                  ) : (
                    <span className="text-emerald-700 font-bold">Within Target SLA</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* OFFICER ACTION & REVIEW COCKPIT (Only rendered in Officer Mode or when reviewing) */}
      {isOfficerMode && (
        <div className="bg-white rounded-2xl border-2 border-blue-600 shadow-md p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={20} className="text-blue-700" />
              <h2 className="font-bold text-base text-slate-900">
                Officer Decision & Redressal Controls
              </h2>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
              Authorized Triage Desk
            </span>
          </div>

          {/* Phase 6: AI Complaint Intelligence & Decision Support Cockpit */}
          <div className="p-5 bg-gradient-to-br from-slate-50 to-blue-50/50 rounded-xl border border-blue-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  AI Complaint Intelligence & Decision Support
                </h3>
              </div>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold self-start sm:self-auto">
                Assistive Advisory (Deterministic v1)
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Card 1: Intelligent Classification */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2.5 text-xs">
                <span className="font-bold text-slate-700 uppercase tracking-wider block text-[11px]">
                  Classification & Routing
                </span>
                <div>
                  <span className="text-slate-500">Recommended Category:</span>
                  <div className="font-bold text-slate-900 capitalize text-sm">
                    {complaint.intelligence?.classification?.category || complaint.category}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Recommended Department:</span>
                  <div className="font-semibold text-slate-800">
                    {complaint.intelligence?.classification?.departmentName || complaint.departmentId || complaint.department}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Confidence:</span>
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                    {Math.round((complaint.intelligence?.classification?.confidence || 0.8) * 100)}%
                  </span>
                </div>
                {complaint.intelligence?.classification?.explanation && (
                  <p className="text-[11px] text-slate-600 italic pt-1 border-t border-slate-100">
                    Rationale: {complaint.intelligence.classification.explanation}
                  </p>
                )}
              </div>

              {/* Card 2: Explainable Priority Recommendation & Officer Action */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 uppercase tracking-wider block text-[11px]">
                    Priority Recommendation
                  </span>
                  <PriorityBadge priority={complaint.intelligence?.priorityRecommendation?.priority || 'MEDIUM'} />
                </div>

                {complaint.intelligence?.priorityRecommendation?.publicSafetyHazard && (
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] font-semibold flex items-center gap-1.5">
                    <AlertTriangle size={14} className="shrink-0 text-rose-600" />
                    <span>Public Safety Hazard Flagged in Complaint Narrative</span>
                  </div>
                )}

                <div>
                  <span className="text-slate-500 block mb-1">Reasoning Signals:</span>
                  <ul className="space-y-1 text-[11px] text-slate-700">
                    {(complaint.intelligence?.priorityRecommendation?.reasons || [
                      'Assigned standard category baseline priority.'
                    ]).map((r, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-blue-500 font-bold">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Priority Decision Form */}
                <form onSubmit={handlePriorityUpdate} className="pt-2 border-t border-slate-100 space-y-2">
                  {priorityMessage && (
                    <div className={`p-2 rounded-lg text-[11px] ${
                      priorityMessage.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {priorityMessage.text}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="CRITICAL">Set CRITICAL</option>
                      <option value="HIGH">Set HIGH</option>
                      <option value="MEDIUM">Set MEDIUM</option>
                      <option value="LOW">Set LOW</option>
                    </select>
                    <button
                      type="submit"
                      disabled={priorityUpdating || newPriority === complaint.priority}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow transition disabled:opacity-50"
                    >
                      {priorityUpdating ? 'Saving...' : 'Apply Priority'}
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Override rationale (e.g. verified on site)..."
                    value={priorityRemarks}
                    onChange={(e) => setPriorityRemarks(e.target.value)}
                    className="w-full px-2.5 py-1 text-[11px] bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </form>
              </div>

              {/* Card 3: Duplicate Complaint Detection & Review */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 uppercase tracking-wider block text-[11px]">
                    Duplicate Detection
                  </span>
                  {complaint.duplicateOf && (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold text-[10px]">
                      Linked to #{complaint.duplicateOf}
                    </span>
                  )}
                </div>

                {duplicateMessage && (
                  <div className={`p-2 rounded-lg text-[11px] ${
                    duplicateMessage.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {duplicateMessage.text}
                  </div>
                )}

                {duplicates && duplicates.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    <span className="text-[11px] text-slate-500">
                      Found {duplicates.length} similar complaints in this jurisdiction:
                    </span>
                    {duplicates.map((dup) => (
                      <div
                        key={dup.id}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-blue-700 text-[11px]">
                            #{dup.referenceNumber || dup.id}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px]">
                            {Math.round(dup.matchScore * 100)}% Match
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-800 line-clamp-1 font-medium">
                          {dup.title}
                        </p>
                        {dup.signals && (
                          <p className="text-[10px] text-slate-500">
                            Signals: {dup.signals.join(', ')}
                          </p>
                        )}
                        {complaint.duplicateOf !== dup.id && (
                          <div className="pt-1 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => handleLinkDuplicate(dup.id)}
                              disabled={linkingDuplicate}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-semibold transition disabled:opacity-50"
                            >
                              {linkingDuplicate ? 'Linking...' : 'Link as Duplicate'}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-lg text-slate-500 text-[11px] italic text-center">
                    No matching duplicate grievances detected in this jurisdiction and time window.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status Transition Control */}
            <form onSubmit={handleStatusUpdate} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block">
                Update Grievance Status
              </span>
              {statusMessage && (
                <div className={`p-2.5 rounded-lg text-xs ${statusMessage.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {statusMessage.text}
                </div>
              )}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Target Status *</label>
                <select
                  required
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">Select status transition...</option>
                  {STATUS_OPTIONS.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Action Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Field inspection completed, contractor engaged..."
                  value={statusRemarks}
                  onChange={(e) => setStatusRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <button
                type="submit"
                disabled={statusUpdating || !newStatus}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow transition disabled:opacity-50"
              >
                {statusUpdating ? 'Updating Status...' : 'Apply Status Transition'}
              </button>
            </form>

            {/* Department Reassignment Control */}
            <form onSubmit={handleDepartmentReassign} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block">
                Reassign Department
              </span>
              {reassignMessage && (
                <div className={`p-2.5 rounded-lg text-xs ${reassignMessage.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {reassignMessage.text}
                </div>
              )}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Target Department *</label>
                <select
                  required
                  value={reassignDeptId}
                  onChange={(e) => setReassignDeptId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Reassignment Rationale</label>
                <input
                  type="text"
                  placeholder="e.g. Jurisdiction falls under municipal drainage division..."
                  value={reassignRemarks}
                  onChange={(e) => setReassignRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <button
                type="submit"
                disabled={reassigning || reassignDeptId === complaint.departmentId}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow transition disabled:opacity-50"
              >
                {reassigning ? 'Reassigning...' : 'Reassign Grievance'}
              </button>
            </form>
          </div>

          {/* Internal Officer Notes Section */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <MessageSquare size={14} className="text-blue-600" />
                Internal Officer Review Notes ({complaint.officerNotes?.length || 0})
              </span>
              <span className="text-[11px] text-slate-400">Not visible to citizen view</span>
            </div>

            {noteMessage && (
              <div className="p-2.5 rounded-lg text-xs bg-emerald-100 text-emerald-800">
                {noteMessage.text}
              </div>
            )}

            <form onSubmit={handleAddNote} className="flex gap-2">
              <input
                type="text"
                required
                placeholder="Add confidential internal officer note (e.g. tender issued, equipment arriving on Monday)..."
                value={officerNote}
                onChange={(e) => setOfficerNote(e.target.value)}
                className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="submit"
                disabled={savingNote || !officerNote.trim()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow transition disabled:opacity-50"
              >
                {savingNote ? 'Adding...' : 'Log Note'}
              </button>
            </form>

            {/* List of existing notes */}
            {complaint.officerNotes && complaint.officerNotes.length > 0 ? (
              <div className="space-y-2 pt-2">
                {complaint.officerNotes.map((n, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-600">{n.officerId || 'OFFICER'}</span>
                      <span>{new Date(n.timestamp).toLocaleString('en-IN')}</span>
                    </div>
                    <p>{n.note}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No internal notes added yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
