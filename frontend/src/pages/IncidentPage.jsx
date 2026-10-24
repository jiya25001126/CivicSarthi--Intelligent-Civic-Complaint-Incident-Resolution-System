import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchIncidents,
  fetchIncidentById,
  fetchDepartments,
  createIncident,
  createSubtask,
  updateSubtaskStatus,
  updateIncidentStatus,
  linkComplaintToIncident,
  unlinkComplaintFromIncident,
  transferComplaintBetweenIncidents,
  fetchComplaints
} from '../api/client';
import {
  IncidentStatusBadge,
  SubtaskStatusBadge,
  StatusBadge,
  PriorityBadge
} from '../components/StatusBadge';
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Building2,
  AlertTriangle,
  Plus,
  MapPin,
  Calendar,
  FileText,
  Users,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  Eye,
  Info,
  ArrowLeft,
  Check,
  X,
  Lock,
  Clock,
  RotateCw,
  XCircle,
  Shield,
  Layers,
  ArrowRight,
  Link2,
  Unlink,
  ArrowRightLeft,
  Archive
} from 'lucide-react';

export default function IncidentPage() {
  const { user, isAuthenticated, isOfficer, isAdmin, isCitizen } = useAuth();

  // Directory State
  const [incidents, setIncidents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  // Filters state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [leadDeptFilter, setLeadDeptFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // Declare Incident Modal State (Problem F)
  const [isDeclareModalOpen, setIsDeclareModalOpen] = useState(false);
  const [declareForm, setDeclareForm] = useState({
    title: '',
    category: 'roads',
    leadDepartment: '',
    description: '',
    priority: 'MEDIUM',
    locality: '',
    district: '',
    state: 'Maharashtra',
    participatingDepartments: []
  });
  const [declareLoading, setDeclareLoading] = useState(false);
  const [declareError, setDeclareError] = useState(null);

  // Selected Incident Workspace State (Step 3.3)
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState(null);

  // Subtask Action State
  const [subtaskActionLoading, setSubtaskActionLoading] = useState(null);
  const [subtaskError, setSubtaskError] = useState(null);

  // Create Subtask Modal State
  const [isCreateSubtaskOpen, setIsCreateSubtaskOpen] = useState(false);
  const [createSubtaskForm, setCreateSubtaskForm] = useState({
    title: '',
    department: '',
    dueDate: '',
    remarks: ''
  });
  const [createSubtaskLoading, setCreateSubtaskLoading] = useState(false);
  const [createSubtaskError, setCreateSubtaskError] = useState(null);

  // Linked Complaint Coordination State (Step 3.4)
  const [complaintActionLoading, setComplaintActionLoading] = useState(null);
  const [complaintActionError, setComplaintActionError] = useState(null);
  const [complaintActionNotice, setComplaintActionNotice] = useState(null);

  // Link Complaint Modal State
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkComplaintInput, setLinkComplaintInput] = useState('');
  const [linkRemarksInput, setLinkRemarksInput] = useState('');
  const [linkComplaintSearchQuery, setLinkComplaintSearchQuery] = useState('');
  const [linkSearchResults, setLinkSearchResults] = useState([]);
  const [linkSearchLoading, setLinkSearchLoading] = useState(false);
  const [linkSubmitLoading, setLinkSubmitLoading] = useState(false);
  const [linkModalError, setLinkModalError] = useState(null);

  // Unlink Complaint Modal State
  const [unlinkingComplaint, setUnlinkingComplaint] = useState(null);
  const [unlinkRemarks, setUnlinkRemarks] = useState('');
  const [unlinkSubmitLoading, setUnlinkSubmitLoading] = useState(false);
  const [unlinkModalError, setUnlinkModalError] = useState(null);

  // Transfer Complaint Modal State
  const [transferringComplaint, setTransferringComplaint] = useState(null);
  const [transferTargetIncidentId, setTransferTargetIncidentId] = useState('');
  const [transferJustification, setTransferJustification] = useState('');
  const [transferSubmitLoading, setTransferSubmitLoading] = useState(false);
  const [transferModalError, setTransferModalError] = useState(null);

  // Incident Resolution Governance State (Step 3.5)
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [resolutionSummaryInput, setResolutionSummaryInput] = useState('');
  const [overrideIncompleteSubtasks, setOverrideIncompleteSubtasks] = useState(false);
  const [overrideJustificationInput, setOverrideJustificationInput] = useState('');
  const [propagateToComplaints, setPropagateToComplaints] = useState(false);
  const [complaintResolutionRemarksInput, setComplaintResolutionRemarksInput] = useState('');
  const [resolveSubmitLoading, setResolveSubmitLoading] = useState(false);
  const [resolveModalError, setResolveModalError] = useState(null);
  const [propagationResultReport, setPropagationResultReport] = useState(null);

  // Close Incident State
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [closeSubmitLoading, setCloseSubmitLoading] = useState(false);
  const [closeModalError, setCloseModalError] = useState(null);

  const canManageIncidents = isAuthenticated && (isOfficer || isAdmin);

  // Load Incident Directory
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {};
      if (search && search.trim() !== '') params.search = search.trim();
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (leadDeptFilter !== 'ALL') params.leadDepartment = leadDeptFilter;
      if (priorityFilter !== 'ALL') params.priority = priorityFilter;

      const [incidentsRes, deptsRes] = await Promise.all([
        fetchIncidents(params),
        fetchDepartments().catch(() => ({ data: [] }))
      ]);

      setIncidents(Array.isArray(incidentsRes?.data) ? incidentsRes.data : []);
      if (Array.isArray(deptsRes?.data)) {
        setDepartments(deptsRes.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to communicate with CivicSarthi incidents API.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, leadDeptFilter, priorityFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load Single Incident Detail for Workspace
  const loadIncidentDetail = useCallback(async (id) => {
    if (!id) return;
    try {
      setLoadingWorkspace(true);
      setWorkspaceError(null);
      setSubtaskError(null);
      const res = await fetchIncidentById(id);
      setSelectedIncident(res.data || null);
    } catch (err) {
      setWorkspaceError(err.message || `Failed to load details for incident '${id}'.`);
    } finally {
      setLoadingWorkspace(false);
    }
  }, []);

  const handleOpenWorkspace = (id) => {
    setSelectedIncidentId(id);
    loadIncidentDetail(id);
  };

  const handleCloseWorkspace = () => {
    setSelectedIncidentId(null);
    setSelectedIncident(null);
    setWorkspaceError(null);
    setSubtaskError(null);
    setComplaintActionError(null);
    setComplaintActionNotice(null);
    setIsLinkModalOpen(false);
    setUnlinkingComplaint(null);
    setTransferringComplaint(null);
    setIsResolveModalOpen(false);
    setIsCloseModalOpen(false);
    setResolveModalError(null);
    setCloseModalError(null);
    setPropagationResultReport(null);
    loadData(); // Sync directory counts
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setLeadDeptFilter('ALL');
    setPriorityFilter('ALL');
  };

  const handleDeclareIncidentSubmit = async (e) => {
    e.preventDefault();
    if (declareLoading) return;
    setDeclareError(null);

    const trimmedTitle = declareForm.title.trim();
    if (!trimmedTitle || trimmedTitle.length < 3) {
      setDeclareError('Incident title must be at least 3 characters.');
      return;
    }
    const leadDept = declareForm.leadDepartment || departments[0]?.id;
    if (!leadDept) {
      setDeclareError('Please select a Lead Department responsible for coordinating this incident.');
      return;
    }

    try {
      setDeclareLoading(true);
      const payload = {
        title: trimmedTitle,
        category: declareForm.category,
        leadDepartment: leadDept,
        description: declareForm.description?.trim() || undefined,
        priority: declareForm.priority,
        location: {
          locality: declareForm.locality?.trim() || undefined,
          district: declareForm.district?.trim() || undefined,
          state: declareForm.state?.trim() || 'Maharashtra'
        },
        participatingDepartments: declareForm.participatingDepartments.length > 0
          ? declareForm.participatingDepartments
          : undefined
      };

      const res = await createIncident(payload);
      setIsDeclareModalOpen(false);
      setNotice(`Parent Incident declared successfully: ${res.data?.referenceNumber || res.data?.id}`);
      setDeclareForm({
        title: '',
        category: 'roads',
        leadDepartment: departments[0]?.id || '',
        description: '',
        priority: 'MEDIUM',
        locality: '',
        district: '',
        state: 'Maharashtra',
        participatingDepartments: []
      });
      await loadData();
    } catch (err) {
      setDeclareError(err.message || 'Failed to declare parent incident.');
    } finally {
      setDeclareLoading(false);
    }
  };

  const hasActiveFilters = search.trim() !== '' || statusFilter !== 'ALL' || leadDeptFilter !== 'ALL' || priorityFilter !== 'ALL';

  // Accurate counts derived strictly from currently loaded result view
  const activeCount = incidents.filter(i => i.status === 'ACTIVE').length;
  const containedCount = incidents.filter(i => i.status === 'CONTAINED').length;
  const resolvedOrClosedCount = incidents.filter(i => i.status === 'RESOLVED' || i.status === 'CLOSED').length;

  // Authority check for modifying a subtask status
  const canModifySubtask = (subtask) => {
    if (!canManageIncidents || !selectedIncident) return false;
    if (isAdmin) return true;
    const actorDept = (user?.departmentId || '').trim().toLowerCase();
    const subtaskDept = (subtask.department || '').trim().toLowerCase();
    const leadDept = (selectedIncident.leadDepartment || '').trim().toLowerCase();
    return actorDept === subtaskDept || actorDept === leadDept;
  };

  // Authority check for delegating new subtask
  const canDelegateSubtask = () => {
    if (!canManageIncidents || !selectedIncident) return false;
    if (selectedIncident.status === 'CLOSED') return false;
    if (isAdmin) return true;
    const actorDept = (user?.departmentId || '').trim().toLowerCase();
    const leadDept = (selectedIncident.leadDepartment || '').trim().toLowerCase();
    return actorDept === leadDept;
  };

  // Handle Subtask Status Progression
  const handleUpdateSubtaskStatusAction = async (subtaskId, targetStatus) => {
    try {
      setSubtaskActionLoading(subtaskId);
      setSubtaskError(null);
      await updateSubtaskStatus(subtaskId, {
        status: targetStatus,
        remarks: `Status updated to ${targetStatus} by ${user?.name || 'officer'}`
      });
      // Refresh incident details to update counts and subtask status
      await loadIncidentDetail(selectedIncidentId);
    } catch (err) {
      setSubtaskError(err.message || `Failed to transition subtask to ${targetStatus}.`);
    } finally {
      setSubtaskActionLoading(null);
    }
  };

  // Open Create Subtask Modal
  const handleOpenCreateSubtaskModal = () => {
    setCreateSubtaskForm({
      title: '',
      department: departments[0]?.id || departments[0]?.code || selectedIncident?.leadDepartment || '',
      dueDate: '',
      remarks: ''
    });
    setCreateSubtaskError(null);
    setIsCreateSubtaskOpen(true);
  };

  // Submit Create Subtask Modal
  const handleCreateSubtaskSubmit = async (e) => {
    e.preventDefault();
    if (!createSubtaskForm.title || createSubtaskForm.title.trim().length < 3) {
      setCreateSubtaskError('Subtask title must be at least 3 characters.');
      return;
    }
    if (!createSubtaskForm.department) {
      setCreateSubtaskError('Please assign a department for this subtask.');
      return;
    }

    try {
      setCreateSubtaskLoading(true);
      setCreateSubtaskError(null);
      await createSubtask({
        incidentId: selectedIncidentId,
        title: createSubtaskForm.title.trim(),
        department: createSubtaskForm.department,
        dueDate: createSubtaskForm.dueDate ? new Date(createSubtaskForm.dueDate).toISOString() : null,
        remarks: createSubtaskForm.remarks.trim() || undefined
      });
      setIsCreateSubtaskOpen(false);
      await loadIncidentDetail(selectedIncidentId);
    } catch (err) {
      setCreateSubtaskError(err.message || 'Failed to create subtask.');
    } finally {
      setCreateSubtaskLoading(false);
    }
  };

  // Authority check for linking / unlinking complaints (Step 3.4)
  const canManageComplaintLinkage = () => {
    if (!canManageIncidents || !selectedIncident) return false;
    if (selectedIncident.status === 'CLOSED') return false;
    if (isAdmin) return true;
    const actorDept = (user?.departmentId || '').trim().toLowerCase();
    const leadDept = (selectedIncident.leadDepartment || '').trim().toLowerCase();
    const participating = Array.isArray(selectedIncident.participatingDepartments)
      ? selectedIncident.participatingDepartments.map(d => String(d).trim().toLowerCase())
      : [];
    return actorDept === leadDept || participating.includes(actorDept);
  };

  // Authority check for transferring a complaint (Step 3.4)
  const canTransferComplaint = () => {
    if (!canManageIncidents || !selectedIncident) return false;
    if (selectedIncident.status === 'CLOSED') return false;
    if (isAdmin) return true;
    const actorDept = (user?.departmentId || '').trim().toLowerCase();
    const leadDept = (selectedIncident.leadDepartment || '').trim().toLowerCase();
    return actorDept === leadDept;
  };

  // Open Link Modal
  const handleOpenLinkModal = () => {
    setLinkComplaintInput('');
    setLinkRemarksInput('');
    setLinkComplaintSearchQuery('');
    setLinkSearchResults([]);
    setLinkModalError(null);
    setIsLinkModalOpen(true);
  };

  // Search available complaints for linking
  const handleSearchAvailableComplaints = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!linkComplaintSearchQuery || linkComplaintSearchQuery.trim().length < 2) {
      setLinkModalError('Enter at least 2 characters to search grievances.');
      return;
    }
    try {
      setLinkSearchLoading(true);
      setLinkModalError(null);
      const res = await fetchComplaints({ search: linkComplaintSearchQuery.trim(), limit: 6 });
      const items = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      const currentLinked = Array.isArray(selectedIncident?.linkedComplaints) ? selectedIncident.linkedComplaints : [];
      const filtered = items.filter(c => !currentLinked.includes(c.id) && !currentLinked.includes(c.referenceNumber));
      setLinkSearchResults(filtered);
      if (filtered.length === 0) {
        setLinkModalError('No matching active grievances found available for linking.');
      }
    } catch (err) {
      setLinkModalError(err.message || 'Failed to query complaints.');
    } finally {
      setLinkSearchLoading(false);
    }
  };

  // Submit Link Complaint
  const handleLinkComplaintSubmit = async (e) => {
    e.preventDefault();
    const targetRef = linkComplaintInput.trim();
    if (!targetRef) {
      setLinkModalError('Please provide a complaint reference ID (e.g. CS-2026-0001).');
      return;
    }

    try {
      setLinkSubmitLoading(true);
      setLinkModalError(null);
      setComplaintActionError(null);
      const res = await linkComplaintToIncident(selectedIncidentId, {
        complaintId: targetRef,
        remarks: linkRemarksInput.trim() || undefined
      });
      setIsLinkModalOpen(false);
      setComplaintActionNotice(
        res.data?.alreadyLinked
          ? `Grievance ${targetRef} is already linked to this incident.`
          : `Grievance ${targetRef} successfully linked to incident.`
      );
      await loadIncidentDetail(selectedIncidentId);
      loadData();
    } catch (err) {
      setLinkModalError(err.message || 'Failed to link complaint to incident.');
    } finally {
      setLinkSubmitLoading(false);
    }
  };

  // Open Unlink Confirmation Modal
  const handleOpenUnlinkModal = (complaint) => {
    setUnlinkingComplaint(complaint);
    setUnlinkRemarks('');
    setUnlinkModalError(null);
  };

  // Confirm Unlink Complaint
  const handleConfirmUnlinkSubmit = async (e) => {
    e.preventDefault();
    if (!unlinkingComplaint) return;
    const cid = unlinkingComplaint.id || unlinkingComplaint.referenceNumber;

    try {
      setUnlinkSubmitLoading(true);
      setUnlinkModalError(null);
      setComplaintActionError(null);
      await unlinkComplaintFromIncident(selectedIncidentId, cid, {
        remarks: unlinkRemarks.trim() || undefined
      });
      setUnlinkingComplaint(null);
      setComplaintActionNotice(`Grievance ${cid} detached from incident successfully.`);
      await loadIncidentDetail(selectedIncidentId);
      loadData();
    } catch (err) {
      setUnlinkModalError(err.message || 'Failed to unlink complaint.');
    } finally {
      setUnlinkSubmitLoading(false);
    }
  };

  // Open Transfer Modal
  const handleOpenTransferModal = (complaint) => {
    setTransferringComplaint(complaint);
    const availableTargets = incidents.filter(i => i.id !== selectedIncidentId && i.status !== 'CLOSED');
    setTransferTargetIncidentId(availableTargets[0]?.id || '');
    setTransferJustification('');
    setTransferModalError(null);
  };

  // Submit Transfer Complaint
  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!transferringComplaint || !transferTargetIncidentId) {
      setTransferModalError('Target incident is required.');
      return;
    }

    if (transferJustification.trim().length < 10) {
      setTransferModalError('An explicit transfer justification of at least 10 characters is required.');
      return;
    }

    const cid = transferringComplaint.id || transferringComplaint.referenceNumber;

    try {
      setTransferSubmitLoading(true);
      setTransferModalError(null);
      setComplaintActionError(null);
      await transferComplaintBetweenIncidents({
        fromIncidentId: selectedIncidentId,
        toIncidentId: transferTargetIncidentId,
        complaintId: cid,
        justification: transferJustification.trim()
      });
      setTransferringComplaint(null);
      setComplaintActionNotice(`Grievance ${cid} transferred to ${transferTargetIncidentId} successfully.`);
      await loadIncidentDetail(selectedIncidentId);
      loadData();
    } catch (err) {
      setTransferModalError(err.message || 'Failed to transfer complaint.');
    } finally {
      setTransferSubmitLoading(false);
    }
  };

  // Authority check for resolving incident (Step 3.5)
  const canResolveIncident = () => {
    if (!canManageIncidents || !selectedIncident) return false;
    if (selectedIncident.status === 'RESOLVED' || selectedIncident.status === 'CLOSED') return false;
    if (isAdmin) return true;
    const actorDept = (user?.departmentId || '').trim().toLowerCase();
    const leadDept = (selectedIncident.leadDepartment || '').trim().toLowerCase();
    return actorDept === leadDept;
  };

  // Authority check for closing incident (Step 3.5)
  const canCloseIncident = () => {
    if (!canManageIncidents || !selectedIncident) return false;
    if (selectedIncident.status !== 'RESOLVED') return false;
    if (isAdmin) return true;
    const actorDept = (user?.departmentId || '').trim().toLowerCase();
    const leadDept = (selectedIncident.leadDepartment || '').trim().toLowerCase();
    return actorDept === leadDept;
  };

  // Open Resolve Modal
  const handleOpenResolveModal = () => {
    setResolutionSummaryInput(selectedIncident?.resolutionSummary || '');
    setOverrideIncompleteSubtasks(false);
    setOverrideJustificationInput('');
    setPropagateToComplaints(false);
    setComplaintResolutionRemarksInput('');
    setResolveModalError(null);
    setIsResolveModalOpen(true);
  };

  // Submit Incident Resolution
  const handleResolveIncidentSubmit = async (e) => {
    e.preventDefault();
    const summary = resolutionSummaryInput.trim();
    if (summary.length < 5) {
      setResolveModalError("Resolution summary is required and must contain at least 5 characters.");
      return;
    }

    const incomplete = Array.isArray(selectedIncident?.subtasks)
      ? selectedIncident.subtasks.filter(s => s.status === 'PENDING' || s.status === 'IN_PROGRESS')
      : [];

    if (incomplete.length > 0) {
      if (!overrideIncompleteSubtasks) {
        setResolveModalError(
          `Cannot mark incident as RESOLVED while ${incomplete.length} required subtask(s) remain incomplete. Rule 6 blocks resolution until all subtasks are finished or an administrator authorizes an emergency override.`
        );
        return;
      }
      if (!isAdmin) {
        setResolveModalError("Only administrators are authorized to override incomplete subtasks.");
        return;
      }
      if (overrideJustificationInput.trim().length < 10) {
        setResolveModalError("Administrative override requires an explicit justification of at least 10 characters.");
        return;
      }
    }

    try {
      setResolveSubmitLoading(true);
      setResolveModalError(null);
      setComplaintActionError(null);

      const payload = {
        status: 'RESOLVED',
        resolutionSummary: summary,
        overrideIncompleteSubtasks: incomplete.length > 0 ? overrideIncompleteSubtasks : false,
        overrideJustification: incomplete.length > 0 ? overrideJustificationInput.trim() : undefined,
        propagateToComplaints,
        complaintResolutionRemarks: complaintResolutionRemarksInput.trim() || undefined
      };

      const res = await updateIncidentStatus(selectedIncidentId, payload);
      setIsResolveModalOpen(false);

      if (res.data?.propagationReport) {
        setPropagationResultReport(res.data.propagationReport);
      }

      setComplaintActionNotice(
        res.message || `Incident ${selectedIncidentId} has been successfully marked RESOLVED.`
      );

      await loadIncidentDetail(selectedIncidentId);
      loadData();
    } catch (err) {
      setResolveModalError(err.message || 'Failed to update incident resolution status.');
    } finally {
      setResolveSubmitLoading(false);
    }
  };

  // Open Close Incident Modal
  const handleOpenCloseModal = () => {
    setCloseModalError(null);
    setIsCloseModalOpen(true);
  };

  // Submit Close Incident
  const handleCloseIncidentSubmit = async (e) => {
    e.preventDefault();
    try {
      setCloseSubmitLoading(true);
      setCloseModalError(null);
      setComplaintActionError(null);
      await updateIncidentStatus(selectedIncidentId, {
        status: 'CLOSED'
      });
      setIsCloseModalOpen(false);
      setComplaintActionNotice(`Incident ${selectedIncidentId} has been formally closed and archived.`);
      await loadIncidentDetail(selectedIncidentId);
      loadData();
    } catch (err) {
      setCloseModalError(err.message || 'Failed to close incident.');
    } finally {
      setCloseSubmitLoading(false);
    }
  };

  // =========================================================================
  // VIEW A: Incident Detail Workspace (Step 3.3)
  // =========================================================================
  if (selectedIncidentId) {
    const inc = selectedIncident;
    const subtasks = inc?.subtasks || [];
    const subSummary = inc?.subtasksSummary || {
      total: subtasks.length,
      pending: subtasks.filter(s => s.status === 'PENDING').length,
      inProgress: subtasks.filter(s => s.status === 'IN_PROGRESS').length,
      completed: subtasks.filter(s => s.status === 'COMPLETED').length,
      cancelled: subtasks.filter(s => s.status === 'CANCELLED').length
    };

    const linkedCount = Array.isArray(inc?.linkedComplaints)
      ? inc.linkedComplaints.length
      : (inc?.linkedComplaintsCount ?? 0);

    const linkedList = Array.isArray(inc?.linkedComplaintsDetails) && inc.linkedComplaintsDetails.length > 0
      ? inc.linkedComplaintsDetails
      : (Array.isArray(inc?.linkedComplaints)
          ? inc.linkedComplaints.map(id => ({ id, referenceNumber: id, title: `Grievance ${id}`, status: 'LINKED' }))
          : []);

    const completionRate = subSummary.total > 0
      ? Math.round((subSummary.completed / (subSummary.total - subSummary.cancelled || 1)) * 100)
      : 0;

    return (
      <div className="space-y-6">
        {/* Workspace Top Navigation Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleCloseWorkspace}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            <ArrowLeft size={15} />
            <span>Back to Incident Directory</span>
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
              {selectedIncidentId}
            </span>
            {inc && <IncidentStatusBadge status={inc.status} />}
            {inc && <PriorityBadge priority={inc.priority} />}

            {canManageIncidents && inc && (inc.status === 'ACTIVE' || inc.status === 'CONTAINED') && (
              <button
                type="button"
                onClick={handleOpenResolveModal}
                disabled={!canResolveIncident()}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition ${
                  canResolveIncident()
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                }`}
                title={
                  canResolveIncident()
                    ? 'Mark incident as RESOLVED with Rule 6 subtask verification'
                    : `Resolution restricted to Lead Department (${inc.leadDepartment}) or Administrator`
                }
              >
                <CheckCircle2 size={13} />
                <span>Resolve Incident</span>
              </button>
            )}

            {canManageIncidents && inc && inc.status === 'RESOLVED' && (
              <button
                type="button"
                onClick={handleOpenCloseModal}
                disabled={!canCloseIncident()}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition ${
                  canCloseIncident()
                    ? 'bg-slate-900 hover:bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                }`}
                title={
                  canCloseIncident()
                    ? 'Archive and formally close incident'
                    : `Closure restricted to Lead Department (${inc.leadDepartment}) or Administrator`
                }
              >
                <Archive size={13} />
                <span>Close Incident</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => loadIncidentDetail(selectedIncidentId)}
              disabled={loadingWorkspace}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 border border-slate-200 transition disabled:opacity-50"
              title="Refresh workspace"
            >
              <RefreshCw size={14} className={loadingWorkspace ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Workspace Loading State */}
        {loadingWorkspace && !inc && (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center space-y-3">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-semibold text-slate-600">Loading incident coordination workspace...</p>
          </div>
        )}

        {/* Workspace Error State */}
        {workspaceError && (
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-start gap-3">
            <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <h3 className="font-bold text-rose-900">Workspace Error</h3>
              <p className="text-rose-700 mt-0.5">{workspaceError}</p>
              <button
                type="button"
                onClick={() => loadIncidentDetail(selectedIncidentId)}
                className="mt-2.5 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-sm"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Workspace Content */}
        {inc && (
          <>
            {/* Incident Summary Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <span className="capitalize">{inc.category} Incident</span>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1 font-semibold text-slate-700">
                    <Building2 size={13} className="text-blue-600" />
                    <span>Lead: {inc.leadDepartment}</span>
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {inc.title}
                </h1>
              </div>

              {inc.description && (
                <p className="text-xs text-slate-600 leading-relaxed max-w-4xl">
                  {inc.description}
                </p>
              )}

              {/* Resolution Summary Banner if resolved */}
              {inc.resolutionSummary && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    <CheckCircle2 size={14} className="text-emerald-700" />
                    <span>Official Resolution Summary</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    {inc.resolutionSummary}
                  </p>
                </div>
              )}

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Location</span>
                  <div className="flex items-center gap-1 text-slate-700 font-medium mt-0.5">
                    <MapPin size={13} className="text-slate-400 shrink-0" />
                    <span className="truncate">
                      {inc.location?.locality
                        ? `${inc.location.locality}, ${inc.location.district || 'Pune'}`
                        : (inc.location?.district || 'Pune')}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Created Date</span>
                  <div className="flex items-center gap-1 text-slate-700 font-medium mt-0.5">
                    <Calendar size={13} className="text-slate-400 shrink-0" />
                    <span>
                      {inc.createdAt ? new Date(inc.createdAt).toLocaleDateString('en-IN') : 'N/A'}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Linked Complaints</span>
                  <div className="flex items-center gap-1 text-slate-700 font-medium mt-0.5">
                    <FileText size={13} className="text-slate-400 shrink-0" />
                    <span>{linkedCount} Grievance{linkedCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Participating Depts</span>
                  <div className="flex items-center gap-1 text-slate-700 font-medium mt-0.5">
                    <Users size={13} className="text-slate-400 shrink-0" />
                    <span>{inc.participatingDepartments?.length || 1} Departments</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Subtask KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Subtasks</span>
                <div className="text-xl font-black text-slate-900 mt-0.5">{subSummary.total}</div>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold text-amber-700 uppercase">Pending</span>
                <div className="text-xl font-black text-amber-600 mt-0.5">{subSummary.pending}</div>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold text-sky-700 uppercase">In Progress</span>
                <div className="text-xl font-black text-sky-600 mt-0.5">{subSummary.inProgress}</div>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold text-emerald-700 uppercase">Completed</span>
                <div className="text-xl font-black text-emerald-600 mt-0.5">{subSummary.completed}</div>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Completion Rate</span>
                <div className="text-xl font-black text-blue-700 mt-0.5">{completionRate}%</div>
              </div>
            </div>

            {/* Subtask Mutation Error Alert */}
            {subtaskError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                  <span>{subtaskError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSubtaskError(null)}
                  className="text-rose-600 hover:text-rose-900 font-semibold"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Multi-Agency Subtask Board */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <Layers size={18} className="text-blue-600" />
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">
                      Multi-Agency Coordination Subtasks
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Department-specific remedial actions delegated across participating civic bodies.
                  </p>
                </div>

                {canManageIncidents && (
                  <button
                    type="button"
                    onClick={handleOpenCreateSubtaskModal}
                    disabled={!canDelegateSubtask()}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition ${
                      canDelegateSubtask()
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    }`}
                    title={
                      canDelegateSubtask()
                        ? 'Delegate new subtask to a department'
                        : `Delegation restricted to Lead Department (${inc.leadDepartment}) or Administrator`
                    }
                  >
                    <Plus size={14} />
                    <span>Delegate Subtask</span>
                  </button>
                )}
              </div>

              {/* Subtask List / Cards */}
              {subtasks.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl space-y-2">
                  <Clock size={24} className="text-slate-400 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">No Subtasks Delegated Yet</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    {canDelegateSubtask()
                      ? 'Click "Delegate Subtask" above to assign an actionable remediation task to a participating department.'
                      : 'Participating departments have not yet registered delegated subtasks for this incident.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {subtasks.map((task) => {
                    const isModifiable = canModifySubtask(task);
                    const isActionBusy = subtaskActionLoading === task.id;

                    return (
                      <div
                        key={task.id}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">
                                {task.department}
                              </span>
                              <SubtaskStatusBadge status={task.status} />
                              {task.assignedOfficerId && (
                                <span className="text-[10px] text-slate-500 font-medium">
                                  Officer: {task.assignedOfficerId}
                                </span>
                              )}
                            </div>
                            <h3 className="text-sm font-bold text-slate-900 leading-snug">
                              {task.title}
                            </h3>
                          </div>

                          {/* Subtask Metadata: Due Date */}
                          {task.dueDate && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                              <Clock size={12} className="text-slate-400" />
                              <span>Due: {new Date(task.dueDate).toLocaleDateString('en-IN')}</span>
                            </div>
                          )}
                        </div>

                        {task.remarks && (
                          <p className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100">
                            {task.remarks}
                          </p>
                        )}

                        {/* Action Control Strip */}
                        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-3 text-xs">
                          <span className="text-[10px] text-slate-400 font-mono">
                            ID: {task.id}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {/* PENDING ACTIONS */}
                            {task.status === 'PENDING' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateSubtaskStatusAction(task.id, 'IN_PROGRESS')}
                                  disabled={!isModifiable || isActionBusy}
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                                    isModifiable
                                      ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm'
                                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                  }`}
                                  title={isModifiable ? 'Start work on this subtask' : `Restricted to ${task.department} or Lead Dept`}
                                >
                                  {isActionBusy ? <RefreshCw size={12} className="animate-spin" /> : <RotateCw size={12} />}
                                  <span>Start Work</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleUpdateSubtaskStatusAction(task.id, 'CANCELLED')}
                                  disabled={!isModifiable || isActionBusy}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition ${
                                    isModifiable
                                      ? 'bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-700'
                                      : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                  }`}
                                  title={isModifiable ? 'Cancel this subtask' : `Restricted to ${task.department} or Lead Dept`}
                                >
                                  <XCircle size={12} />
                                  <span>Cancel</span>
                                </button>
                              </>
                            )}

                            {/* IN_PROGRESS ACTIONS */}
                            {task.status === 'IN_PROGRESS' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateSubtaskStatusAction(task.id, 'COMPLETED')}
                                  disabled={!isModifiable || isActionBusy}
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                                    isModifiable
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                  }`}
                                  title={isModifiable ? 'Mark subtask complete' : `Restricted to ${task.department} or Lead Dept`}
                                >
                                  {isActionBusy ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                                  <span>Complete</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleUpdateSubtaskStatusAction(task.id, 'PENDING')}
                                  disabled={!isModifiable || isActionBusy}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition ${
                                    isModifiable
                                      ? 'bg-slate-200 hover:bg-amber-100 hover:text-amber-800 text-slate-700'
                                      : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                  }`}
                                  title={isModifiable ? 'Revert to Pending' : `Restricted to ${task.department} or Lead Dept`}
                                >
                                  <Clock size={12} />
                                  <span>Hold</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleUpdateSubtaskStatusAction(task.id, 'CANCELLED')}
                                  disabled={!isModifiable || isActionBusy}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition ${
                                    isModifiable
                                      ? 'bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-700'
                                      : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                  }`}
                                  title={isModifiable ? 'Cancel this subtask' : `Restricted to ${task.department} or Lead Dept`}
                                >
                                  <XCircle size={12} />
                                  <span>Cancel</span>
                                </button>
                              </>
                            )}

                            {/* COMPLETED TERMINAL */}
                            {task.status === 'COMPLETED' && (
                              <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 size={13} />
                                <span>Completed</span>
                              </span>
                            )}

                            {/* CANCELLED TERMINAL */}
                            {task.status === 'CANCELLED' && (
                              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                                <XCircle size={13} />
                                <span>Cancelled</span>
                              </span>
                            )}

                            {!isModifiable && task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
                              <span
                                className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded"
                                title={`Authority restricted to ${task.department} or Lead Dept (${inc.leadDepartment})`}
                              >
                                <Lock size={10} />
                                <span>Locked</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 3.4 Complaint Action Alerts */}
            {complaintActionNotice && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{complaintActionNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setComplaintActionNotice(null)}
                  className="text-emerald-700 hover:text-emerald-900 font-semibold"
                >
                  Dismiss
                </button>
              </div>
            )}

            {complaintActionError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                  <span>{complaintActionError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setComplaintActionError(null)}
                  className="text-rose-700 hover:text-rose-900 font-semibold"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Linked Grievances Coordination Panel (Step 3.4) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-blue-600" />
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">
                      Linked Citizen Grievances ({linkedCount})
                    </h2>
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      Coordinated Resolution
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Field complaints attached to this composite incident for cross-agency resolution and tracking.
                  </p>
                </div>

                {canManageIncidents && (
                  <button
                    type="button"
                    onClick={handleOpenLinkModal}
                    disabled={!canManageComplaintLinkage()}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition ${
                      canManageComplaintLinkage()
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    }`}
                    title={
                      canManageComplaintLinkage()
                        ? 'Link an existing civic complaint to this incident'
                        : `Linking restricted to Lead Department (${inc.leadDepartment}) or Participating Agencies`
                    }
                  >
                    <Link2 size={14} />
                    <span>Link Grievance</span>
                  </button>
                )}
              </div>

              {/* Linked Complaints List */}
              {linkedList.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl space-y-2">
                  <FileText size={24} className="text-slate-400 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">No Grievances Linked to this Incident</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    {canManageComplaintLinkage()
                      ? 'Cluster relevant civic tickets into this incident to execute coordinated multi-agency mitigation.'
                      : 'No citizen complaints have been attached to this incident yet.'}
                  </p>
                  {canManageComplaintLinkage() && (
                    <button
                      type="button"
                      onClick={handleOpenLinkModal}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200 transition"
                    >
                      <Plus size={13} />
                      <span>Link Existing Complaint</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {linkedList.map((complaint) => {
                    const cRef = complaint.referenceNumber || complaint.id;
                    const canUnlink = canManageComplaintLinkage();
                    const canTransfer = canTransferComplaint();

                    return (
                      <div
                        key={cRef}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                {cRef}
                              </span>
                              <span className="text-[10px] font-semibold uppercase text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                {complaint.category || 'civic'}
                              </span>
                              {complaint.departmentId && (
                                <span className="text-[10px] font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded uppercase">
                                  {complaint.departmentId}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {complaint.status && <StatusBadge status={complaint.status} />}
                              {complaint.priority && <PriorityBadge priority={complaint.priority} />}
                            </div>
                          </div>

                          <div>
                            <h4 className="text-xs font-bold text-slate-900 leading-snug">
                              {complaint.title || `Citizen Grievance ${cRef}`}
                            </h4>
                            {complaint.description && (
                              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                {complaint.description}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 pt-1">
                            <span className="flex items-center gap-1">
                              <MapPin size={11} />
                              <span>
                                {complaint.locality
                                  ? `${complaint.locality}, ${complaint.district || 'Pune'}`
                                  : (complaint.district || 'Pune')}
                              </span>
                            </span>
                            {complaint.createdAt && (
                              <span className="flex items-center gap-1">
                                <Calendar size={11} />
                                <span>{new Date(complaint.createdAt).toLocaleDateString('en-IN')}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {canManageIncidents && (
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                            <span className="text-[10px] text-slate-400 font-medium">
                              Linked Action
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenTransferModal(complaint)}
                                disabled={!canTransfer || inc.status === 'CLOSED'}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                                  canTransfer && inc.status !== 'CLOSED'
                                    ? 'bg-slate-200 hover:bg-blue-100 hover:text-blue-700 text-slate-700'
                                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                }`}
                                title={
                                  canTransfer
                                    ? 'Transfer this grievance to another parent incident'
                                    : `Transfer requires Lead Department (${inc.leadDepartment}) authority`
                                }
                              >
                                <ArrowRightLeft size={12} />
                                <span>Transfer</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenUnlinkModal(complaint)}
                                disabled={!canUnlink || inc.status === 'CLOSED'}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                                  canUnlink && inc.status !== 'CLOSED'
                                    ? 'bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-700'
                                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                }`}
                                title={
                                  canUnlink
                                    ? 'Detach this grievance from this incident'
                                    : 'Detachment requires Lead or Assigned Department authority'
                                }
                              >
                                <Unlink size={12} />
                                <span>Detach</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Incident Resolution & Multi-Agency Governance Panel (Step 3.5) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      Incident Resolution Governance
                    </h3>
                    <p className="text-xs text-slate-500">
                      Multi-agency completion verification, Rule 6 subtask guards & complaint resolution propagation.
                    </p>
                  </div>
                </div>

                {canManageIncidents && (
                  <div className="flex items-center gap-2">
                    {(inc.status === 'ACTIVE' || inc.status === 'CONTAINED') && (
                      <button
                        type="button"
                        onClick={handleOpenResolveModal}
                        disabled={!canResolveIncident()}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition ${
                          canResolveIncident()
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                        }`}
                        title={
                          canResolveIncident()
                            ? 'Declare incident RESOLVED and trigger multi-agency governance review'
                            : `Resolution restricted to Lead Department (${inc.leadDepartment}) or Administrator`
                        }
                      >
                        <CheckCircle2 size={14} />
                        <span>Resolve Incident</span>
                      </button>
                    )}

                    {inc.status === 'RESOLVED' && (
                      <button
                        type="button"
                        onClick={handleOpenCloseModal}
                        disabled={!canCloseIncident()}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition ${
                          canCloseIncident()
                            ? 'bg-slate-900 hover:bg-slate-800 text-white'
                            : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                        }`}
                        title={
                          canCloseIncident()
                            ? 'Archive and formally close incident'
                            : `Closure restricted to Lead Department (${inc.leadDepartment}) or Administrator`
                        }
                      >
                        <Archive size={14} />
                        <span>Archive & Close Incident</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Status & Rule 6 Subtask Readiness Evaluation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Rule 6 Subtask Readiness Card */}
                <div className={`p-4 rounded-xl border ${
                  subSummary.pending === 0 && subSummary.inProgress === 0
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50/60 border-amber-200 text-amber-900'
                } space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                      {subSummary.pending === 0 && subSummary.inProgress === 0 ? (
                        <>
                          <CheckCircle2 size={14} className="text-emerald-600" />
                          <span className="text-emerald-800">Rule 6 Subtask Guard: Clear</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={14} className="text-amber-600" />
                          <span className="text-amber-800">Rule 6 Subtask Guard: Incomplete</span>
                        </>
                      )}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      subSummary.pending === 0 && subSummary.inProgress === 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {subSummary.completed} of {subSummary.total} Completed
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed">
                    {subSummary.pending === 0 && subSummary.inProgress === 0
                      ? 'All delegated remediation subtasks have reached completion. Incident is eligible for standard operational resolution.'
                      : `Rule 6 enforces that an incident cannot be marked RESOLVED while required subtasks remain incomplete (${subSummary.pending + subSummary.inProgress} active tasks). An administrator override is required to bypass.`}
                  </p>

                  {subSummary.pending + subSummary.inProgress > 0 && (
                    <div className="pt-1 flex flex-wrap gap-1.5">
                      {subtasks
                        .filter(s => s.status === 'PENDING' || s.status === 'IN_PROGRESS')
                        .map(s => (
                          <span
                            key={s.id}
                            className="text-[10px] bg-white border border-amber-300 text-amber-900 px-2 py-0.5 rounded font-mono font-medium"
                          >
                            {s.id} ({s.department}) &bull; {s.status}
                          </span>
                        ))}
                    </div>
                  )}
                </div>

                {/* Complaint Resolution Propagation Readiness Card */}
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 text-blue-900 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <FileText size={14} className="text-blue-600" />
                      <span className="text-blue-800">Complaint Propagation</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      {linkedCount} Linked Grievance{linkedCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed">
                    When resolving with propagation enabled, eligible linked complaints will transition to RESOLVED and citizen tracking portals will display the official resolution summary.
                  </p>

                  <div className="text-[11px] text-blue-700 bg-white/70 p-2 rounded-lg border border-blue-100">
                    <span className="font-semibold">Lifecycle Protection:</span> Complaints that cannot legally move to RESOLVED (e.g. SUBMITTED) or already RESOLVED will be safely skipped without breaking consistency.
                  </div>
                </div>
              </div>

              {/* Official Resolution Summary (if resolved or closed) */}
              {inc.resolutionSummary && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={15} className="text-emerald-700" />
                      <span>Official Resolution Statement</span>
                    </div>
                    {inc.resolvedAt && (
                      <span className="text-[11px] font-normal text-emerald-700">
                        Resolved on {new Date(inc.resolvedAt).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                    {inc.resolutionSummary}
                  </p>
                </div>
              )}

              {/* Subtask Override Record Banner (if administrative override was applied) */}
              {inc.subtaskOverride?.overridden && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2 text-xs text-amber-900">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle size={15} className="text-amber-700" />
                    <span>Emergency Administrative Override Record</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Resolved by administrative authorization while {inc.subtaskOverride.incompleteCount} subtask(s) were pending.
                  </p>
                  <div className="p-2.5 bg-white rounded-lg border border-amber-200 text-[11px]">
                    <span className="font-semibold text-slate-700">Override Justification: </span>
                    <span className="text-slate-600 font-mono">{inc.subtaskOverride.justification}</span>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Authorized by {inc.subtaskOverride.authorizedRole || 'Administrator'} &bull; {new Date(inc.subtaskOverride.timestamp).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              )}

              {/* Latest Propagation Result Report (Displayed after resolution mutation) */}
              {propagationResultReport && (
                <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-blue-600" />
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Complaint Propagation Execution Report
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPropagationResultReport(null)}
                      className="text-xs text-slate-400 hover:text-slate-700 font-semibold"
                    >
                      Dismiss Report
                    </button>
                  </div>

                  {/* Summary Metric Pills */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1">
                      <Check size={12} />
                      <span>{propagationResultReport.resolvedCount} Resolved</span>
                    </span>

                    <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 font-bold flex items-center gap-1">
                      <Info size={12} />
                      <span>{propagationResultReport.skippedCount} Skipped</span>
                    </span>

                    {propagationResultReport.failedCount > 0 && (
                      <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 font-bold flex items-center gap-1">
                        <AlertTriangle size={12} />
                        <span>{propagationResultReport.failedCount} Failed</span>
                      </span>
                    )}
                  </div>

                  {propagationResultReport.consistencyNote && (
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {propagationResultReport.consistencyNote}
                    </p>
                  )}

                  {propagationResultReport.requiresReconciliation && (
                    <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-xs text-rose-900 font-medium">
                      ⚠ Reconciliation Warning: One or more complaint updates failed during resolution propagation. Manual reconciliation of complaints is recommended.
                    </div>
                  )}

                  {/* Skipped Complaints Detail */}
                  {Array.isArray(propagationResultReport.skippedComplaints) && propagationResultReport.skippedComplaints.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                        Skipped Complaints Detail:
                      </span>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {propagationResultReport.skippedComplaints.map((sk) => (
                          <div key={sk.complaintId} className="p-2 bg-white rounded border border-slate-200 text-[11px] flex items-center justify-between gap-2">
                            <span className="font-mono font-bold text-blue-700">{sk.complaintId}</span>
                            <span className="text-slate-500 truncate">{sk.reason}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                              {sk.currentStatus}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Create Subtask Modal */}
        {isCreateSubtaskOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <Plus size={18} className="text-blue-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    Delegate New Department Subtask
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateSubtaskOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateSubtaskSubmit} className="p-5 space-y-4">
                {createSubtaskError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                    <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                    <span>{createSubtaskError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Subtask Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Inspect power feeder and isolate storm damage line..."
                    value={createSubtaskForm.title}
                    onChange={(e) => setCreateSubtaskForm({ ...createSubtaskForm, title: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Minimum 3 characters</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assigned Department <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={createSubtaskForm.department}
                    onChange={(e) => setCreateSubtaskForm({ ...createSubtaskForm, department: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {departments.map((d) => (
                      <option key={d.id || d.code} value={d.id || d.code}>
                        {d.name || d.id || d.code}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Due Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={createSubtaskForm.dueDate}
                    onChange={(e) => setCreateSubtaskForm({ ...createSubtaskForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Operational Remarks (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Provide context, required equipment, safety warnings, or field coordination directives..."
                    value={createSubtaskForm.remarks}
                    onChange={(e) => setCreateSubtaskForm({ ...createSubtaskForm, remarks: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateSubtaskOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createSubtaskLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {createSubtaskLoading && <RefreshCw size={13} className="animate-spin" />}
                    <span>Delegate Subtask</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Step 3.4: Link Complaint Modal */}
        {isLinkModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <Link2 size={18} className="text-blue-600" />
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Link Grievance to Incident
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Attach civic complaint to {selectedIncidentId} for multi-agency coordination.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                {linkModalError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                    <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                    <span>{linkModalError}</span>
                  </div>
                )}

                {/* Grievance Quick Search */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Quick Search Available Grievances
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Search title, category, locality..."
                      value={linkComplaintSearchQuery}
                      onChange={(e) => setLinkComplaintSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSearchAvailableComplaints();
                        }
                      }}
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button
                      type="button"
                      onClick={handleSearchAvailableComplaints}
                      disabled={linkSearchLoading}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 flex items-center gap-1"
                    >
                      {linkSearchLoading ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : (
                        <Search size={12} />
                      )}
                      <span>Search</span>
                    </button>
                  </div>

                  {/* Search Results list */}
                  {linkSearchResults.length > 0 && (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pt-1">
                      {linkSearchResults.map((comp) => {
                        const ref = comp.referenceNumber || comp.id;
                        return (
                          <div
                            key={ref}
                            className="p-2 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-2 hover:border-blue-400 transition"
                          >
                            <div className="truncate">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                  {ref}
                                </span>
                                <span className="text-[10px] uppercase font-semibold text-slate-500">
                                  {comp.category || 'civic'}
                                </span>
                              </div>
                              <p className="text-xs font-medium text-slate-800 truncate mt-0.5">
                                {comp.title}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setLinkComplaintInput(ref)}
                              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold rounded border border-blue-200 shrink-0"
                            >
                              Select
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <form onSubmit={handleLinkComplaintSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Complaint Reference ID <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CS-2026-0001"
                      value={linkComplaintInput}
                      onChange={(e) => setLinkComplaintInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Enter the formal complaint ID or select from quick search above.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Operational Context / Remarks (Optional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Context for linking (e.g. Shared root cause at intersection)..."
                      value={linkRemarksInput}
                      onChange={(e) => setLinkRemarksInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsLinkModalOpen(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={linkSubmitLoading || !linkComplaintInput.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {linkSubmitLoading && <RefreshCw size={13} className="animate-spin" />}
                      <span>Link to Incident</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Step 3.4: Unlink / Detach Complaint Modal */}
        {unlinkingComplaint && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
                    <Unlink size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Detach Grievance
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Decouple from {selectedIncidentId}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUnlinkingComplaint(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleConfirmUnlinkSubmit} className="p-5 space-y-4">
                {unlinkModalError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                    <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                    <span>{unlinkModalError}</span>
                  </div>
                )}

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="font-mono text-xs font-bold text-blue-700">
                    {unlinkingComplaint.referenceNumber || unlinkingComplaint.id}
                  </div>
                  <div className="text-xs font-semibold text-slate-900">
                    {unlinkingComplaint.title || 'Civic Complaint'}
                  </div>
                  <p className="text-[11px] text-slate-500 pt-1 leading-relaxed">
                    Detaching will return this grievance to standalone department management.
                    It will no longer track resolution progress through this composite incident.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Operational Reason (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Provide reason for detachment (e.g. Unrelated incident area, erroneously clustered)..."
                    value={unlinkRemarks}
                    onChange={(e) => setUnlinkRemarks(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-600"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setUnlinkingComplaint(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={unlinkSubmitLoading}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {unlinkSubmitLoading && <RefreshCw size={13} className="animate-spin" />}
                    <span>Confirm Detach</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Step 3.4: Transfer Complaint Modal */}
        {transferringComplaint && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-blue-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                    <ArrowRightLeft size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Transfer Grievance Between Incidents
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Reassign grievance {transferringComplaint.referenceNumber || transferringComplaint.id} to a new parent incident.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTransferringComplaint(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleTransferSubmit} className="p-5 space-y-4">
                {transferModalError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                    <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                    <span>{transferModalError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Current Incident</span>
                    <div className="font-mono font-bold text-slate-800 mt-0.5">{selectedIncidentId}</div>
                    <div className="text-[11px] text-slate-500 truncate">{selectedIncident?.title}</div>
                  </div>

                  <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-blue-700">Moving Grievance</span>
                    <div className="font-mono font-bold text-blue-800 mt-0.5">
                      {transferringComplaint.referenceNumber || transferringComplaint.id}
                    </div>
                    <div className="text-[11px] text-slate-600 truncate">{transferringComplaint.title}</div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Parent Incident <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={transferTargetIncidentId}
                    onChange={(e) => setTransferTargetIncidentId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {incidents
                      .filter(i => i.id !== selectedIncidentId && i.status !== 'CLOSED')
                      .map((incTarget) => (
                        <option key={incTarget.id} value={incTarget.id}>
                          {incTarget.id} &bull; {incTarget.title} ({incTarget.leadDepartment})
                        </option>
                      ))}
                  </select>
                  {incidents.filter(i => i.id !== selectedIncidentId && i.status !== 'CLOSED').length === 0 && (
                    <span className="text-[11px] text-rose-600 mt-1 block">
                      No other open parent incidents are currently available to receive this transfer.
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      Transfer Justification <span className="text-rose-500">*</span>
                    </label>
                    <span
                      className={`text-[10px] font-semibold ${
                        transferJustification.trim().length >= 10 ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {transferJustification.trim().length}/10 chars min
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    required
                    placeholder="Provide detailed administrative justification for transferring this grievance to the target incident..."
                    value={transferJustification}
                    onChange={(e) => setTransferJustification(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Statutory requirement: Must contain at least 10 characters for audit compliance.
                  </span>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setTransferringComplaint(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      transferSubmitLoading ||
                      !transferTargetIncidentId ||
                      transferJustification.trim().length < 10
                    }
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {transferSubmitLoading && <RefreshCw size={13} className="animate-spin" />}
                    <span>Execute Transfer</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Step 3.5: Incident Resolution Modal */}
        {isResolveModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Resolve Multi-Agency Incident
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {selectedIncidentId} &bull; {selectedIncident?.title}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsResolveModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleResolveIncidentSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
                {resolveModalError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                    <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                    <span>{resolveModalError}</span>
                  </div>
                )}

                {/* Subtask Readiness Status & Rule 6 Guard */}
                {(() => {
                  const incomplete = Array.isArray(selectedIncident?.subtasks)
                    ? selectedIncident.subtasks.filter(s => s.status === 'PENDING' || s.status === 'IN_PROGRESS')
                    : [];
                  const hasIncomplete = incomplete.length > 0;

                  return (
                    <div className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${
                      hasIncomplete
                        ? 'bg-amber-50/70 border-amber-300 text-amber-900'
                        : 'bg-emerald-50/70 border-emerald-300 text-emerald-900'
                    }`}>
                      <div className="flex items-center justify-between font-bold">
                        <div className="flex items-center gap-1.5">
                          {hasIncomplete ? (
                            <AlertTriangle size={15} className="text-amber-600" />
                          ) : (
                            <CheckCircle2 size={15} className="text-emerald-600" />
                          )}
                          <span>
                            {hasIncomplete
                              ? `Rule 6 Guard: ${incomplete.length} Subtask(s) Incomplete`
                              : 'Rule 6 Guard: All Subtasks Completed'}
                          </span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white font-mono">
                          {selectedIncident?.subtasks?.length || 0} Total Subtasks
                        </span>
                      </div>

                      {hasIncomplete ? (
                        <>
                          <p className="text-[11px] leading-relaxed">
                            Under Rule 6, an incident cannot be marked RESOLVED while required remediation subtasks remain incomplete.
                          </p>

                          <div className="space-y-1 max-h-28 overflow-y-auto bg-white/80 p-2 rounded-lg border border-amber-200">
                            {incomplete.map((s) => (
                              <div key={s.id} className="text-[11px] flex items-center justify-between gap-2">
                                <span className="font-mono font-bold text-amber-800">{s.id}</span>
                                <span className="text-slate-600 truncate">{s.title}</span>
                                <span className="text-[10px] uppercase font-bold text-slate-500 bg-amber-100 px-1.5 py-0.5 rounded">
                                  {s.status}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Admin Override Section */}
                          {isAdmin ? (
                            <div className="pt-2 border-t border-amber-200 space-y-2">
                              <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={overrideIncompleteSubtasks}
                                  onChange={(e) => setOverrideIncompleteSubtasks(e.target.checked)}
                                  className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                                />
                                <span className="font-bold text-[11px] text-amber-900">
                                  Authorize Emergency Administrator Override (Rule 6)
                                </span>
                              </label>

                              {overrideIncompleteSubtasks && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase text-amber-800">
                                      Override Justification <span className="text-rose-500">*</span>
                                    </span>
                                    <span
                                      className={`text-[10px] font-semibold ${
                                        overrideJustificationInput.trim().length >= 10
                                          ? 'text-emerald-700'
                                          : 'text-amber-700'
                                      }`}
                                    >
                                      {overrideJustificationInput.trim().length}/10 chars min
                                    </span>
                                  </div>
                                  <textarea
                                    rows={2}
                                    required
                                    placeholder="Provide explicit operational justification for early resolution..."
                                    value={overrideJustificationInput}
                                    onChange={(e) => setOverrideJustificationInput(e.target.value)}
                                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                  />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-[11px] text-amber-800 italic bg-amber-100/50 p-2 rounded-lg">
                              Notice: Only system administrators may authorize an override for incomplete subtasks. Resolution is locked until all participating departments mark their subtasks COMPLETED.
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-[11px] leading-relaxed">
                          All delegated civic remediation work has been completed by participating departments. Incident is ready for formal resolution.
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* Resolution Summary Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      Official Resolution Summary <span className="text-rose-500">*</span>
                    </label>
                    <span
                      className={`text-[10px] font-semibold ${
                        resolutionSummaryInput.trim().length >= 5
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                      }`}
                    >
                      {resolutionSummaryInput.trim().length}/5 chars min
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    required
                    placeholder="Provide a comprehensive operational summary of the actions taken, repairs completed, and verification results..."
                    value={resolutionSummaryInput}
                    onChange={(e) => setResolutionSummaryInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Public Transparency: This summary will be displayed on citizen tracking portals.
                  </span>
                </div>

                {/* Complaint Resolution Propagation Section */}
                <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={propagateToComplaints}
                      onChange={(e) => setPropagateToComplaints(e.target.checked)}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold text-xs text-blue-900 block">
                        Propagate Resolution to Linked Citizen Grievances
                      </span>
                      <span className="text-[11px] text-blue-700 block leading-relaxed mt-0.5">
                        Automatically transitions eligible linked complaints to RESOLVED. Complaints with invalid lifecycle states (such as SUBMITTED) or already RESOLVED will be safely skipped.
                      </span>
                    </div>
                  </label>

                  {propagateToComplaints && (
                    <div className="pt-2 border-t border-blue-200 space-y-1">
                      <label className="block text-[11px] font-bold text-blue-900">
                        Complaint Resolution Remarks (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Resolved via multi-agency composite incident restoration"
                        value={complaintResolutionRemarksInput}
                        onChange={(e) => setComplaintResolutionRemarksInput(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsResolveModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      resolveSubmitLoading ||
                      resolutionSummaryInput.trim().length < 5 ||
                      ((selectedIncident?.subtasks?.some(s => s.status === 'PENDING' || s.status === 'IN_PROGRESS')) &&
                        (!isAdmin || !overrideIncompleteSubtasks || overrideJustificationInput.trim().length < 10))
                    }
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {resolveSubmitLoading && <RefreshCw size={13} className="animate-spin" />}
                    <span>Confirm Resolution</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Step 3.5: Close Incident Modal */}
        {isCloseModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-slate-200 text-slate-700 rounded-lg">
                    <Archive size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Close & Archive Incident
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Final lifecycle transition for {selectedIncidentId}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCloseModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCloseIncidentSubmit} className="p-5 space-y-4">
                {closeModalError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                    <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                    <span>{closeModalError}</span>
                  </div>
                )}

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="font-mono text-xs font-bold text-blue-700">
                    {selectedIncidentId}
                  </div>
                  <div className="text-xs font-semibold text-slate-900">
                    {selectedIncident?.title}
                  </div>
                  <p className="text-[11px] text-slate-500 pt-1 leading-relaxed">
                    Once CLOSED, this composite incident reaches a terminal governance state.
                    No further subtasks, complaint attachments, or status modifications may be applied.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCloseModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={closeSubmitLoading}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {closeSubmitLoading && <RefreshCw size={13} className="animate-spin" />}
                    <span>Confirm Incident Closure</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW B: Incident Directory & Caseload View (Step 3.2)
  // =========================================================================
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shadow-sm">
              <ShieldAlert size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Multi-Agency Incident Directory
                </h1>
                {canManageIncidents ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
                    Official Cockpit Mode
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                    Public Transparency View
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600">
                Clustered civic emergencies & cross-departmental coordination incidents.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          {canManageIncidents && (
            <button
              type="button"
              onClick={() => {
                setDeclareError(null);
                setDeclareForm(prev => ({
                  ...prev,
                  leadDepartment: prev.leadDepartment || departments[0]?.id || ''
                }));
                setIsDeclareModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
              title="Declare new parent incident"
            >
              <Plus size={15} />
              <span>Declare Incident</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 border border-slate-200 transition disabled:opacity-50"
            title="Refresh directory"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* User Info / Notice Banner */}
      {notice && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-blue-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-blue-600 hover:text-blue-900 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Verified View Caseload Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            In Current View
          </div>
          <div className="text-2xl font-black text-slate-900">{incidents.length}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Matching active filters</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider mb-1">
            Active in View
          </div>
          <div className="text-2xl font-black text-rose-600">{activeCount}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Under live multi-agency action</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider mb-1">
            Contained in View
          </div>
          <div className="text-2xl font-black text-amber-600">{containedCount}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Stabilized / restoration underway</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mb-1">
            Resolved / Closed in View
          </div>
          <div className="text-2xl font-black text-emerald-600">{resolvedOrClosedCount}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Restoration complete or archived</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by incident reference (e.g. INC-2026), title, category, department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2.5 pt-1 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold mr-1">
            <Filter size={14} />
            <span>Filters:</span>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="CONTAINED">CONTAINED</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="CLOSED">CLOSED</option>
          </select>

          {/* Lead Department Filter */}
          <select
            value={leadDeptFilter}
            onChange={(e) => setLeadDeptFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">All Lead Departments</option>
            {departments.map((dept) => (
              <option key={dept.id || dept.code} value={dept.id || dept.code}>
                {dept.name || dept.id || dept.code}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition font-medium"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* API Error / Auth Required State with Retry or Login Action */}
      {error && (
        <div className={`p-4 rounded-2xl flex items-start gap-3 border ${
          error.toLowerCase().includes('authentication')
            ? 'bg-amber-50 border-amber-200'
            : 'bg-rose-50 border-rose-200'
        }`}>
          <AlertTriangle
            size={18}
            className={`shrink-0 mt-0.5 ${
              error.toLowerCase().includes('authentication') ? 'text-amber-600' : 'text-rose-600'
            }`}
          />
          <div className="flex-1 text-xs">
            <h3 className={`font-bold ${
              error.toLowerCase().includes('authentication') ? 'text-amber-900' : 'text-rose-900'
            }`}>
              {error.toLowerCase().includes('authentication')
                ? 'Sign In Required to Access Incident Records'
                : 'Incident Directory Unavailable'}
            </h3>
            <p className={`mt-0.5 ${
              error.toLowerCase().includes('authentication') ? 'text-amber-800' : 'text-rose-700'
            }`}>
              {error.toLowerCase().includes('authentication')
                ? 'The Multi-Agency Incident Directory requires an authenticated session. Please sign in with an authorized officer, administrator, or citizen account to view live incident records.'
                : error}
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              {error.toLowerCase().includes('authentication') ? (
                <Link
                  to="/login"
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition"
                >
                  Sign In to CivicSarthi
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={loadData}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-sm transition"
                >
                  Retry Connection
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm animate-pulse space-y-3"
            >
              <div className="flex justify-between items-center">
                <div className="h-4 w-24 bg-slate-200 rounded"></div>
                <div className="h-5 w-20 bg-slate-200 rounded-full"></div>
              </div>
              <div className="h-5 w-3/4 bg-slate-200 rounded"></div>
              <div className="h-3 w-full bg-slate-100 rounded"></div>
              <div className="h-8 w-full bg-slate-50 rounded"></div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && incidents.length === 0 && (
        <div className="bg-white p-10 rounded-2xl border border-dashed border-slate-300 text-center space-y-3">
          <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert size={24} />
          </div>
          <h2 className="text-base font-bold text-slate-800">
            No Parent Incidents Found
          </h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {hasActiveFilters
              ? 'No incidents match the active search query or filter selection. Try adjusting your filters.'
              : 'There are currently no active multi-agency incidents registered in the system.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
            >
              <RotateCcw size={14} />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>
      )}

      {/* Incident Directory Cards Grid */}
      {!loading && !error && incidents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {incidents.map((incident) => {
            // Count linked complaints safely based on actual API payload
            const linkedCount = Array.isArray(incident.linkedComplaints)
              ? incident.linkedComplaints.length
              : (incident.linkedComplaintsCount ?? 0);

            const hasSubtaskSummary = incident.subtasksSummary && typeof incident.subtasksSummary.total === 'number';

            return (
              <div
                key={incident.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  {/* Card Header: Reference ID + Badges */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {incident.id}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <IncidentStatusBadge status={incident.status} />
                      <PriorityBadge priority={incident.priority} />
                    </div>
                  </div>

                  {/* Incident Title & Category */}
                  <div>
                    <h2 className="text-base font-bold text-slate-900 tracking-tight leading-snug">
                      {incident.title}
                    </h2>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-medium">
                      <span className="capitalize">{incident.category}</span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <Building2 size={12} className="text-slate-400" />
                        <span className="font-semibold text-slate-700">{incident.leadDepartment}</span>
                      </span>
                    </div>
                  </div>

                  {/* Incident Description */}
                  {incident.description && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {incident.description}
                    </p>
                  )}

                  {/* Resolution Summary (If resolved/closed) */}
                  {incident.resolutionSummary && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                      <div className="font-bold flex items-center gap-1 mb-0.5">
                        <CheckCircle2 size={13} className="text-emerald-700" />
                        <span>Resolution Summary</span>
                      </div>
                      <p className="text-[11px] text-emerald-800 leading-normal">
                        {incident.resolutionSummary}
                      </p>
                    </div>
                  )}

                  {/* Metadata Chips: Location & Date */}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                    <div className="flex items-center gap-1">
                      <MapPin size={12} className="text-slate-400" />
                      <span>
                        {incident.location?.locality
                          ? `${incident.location.locality}, ${incident.location.district || 'Pune'}`
                          : (incident.location?.district || 'Pune, Maharashtra')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Calendar size={12} className="text-slate-400" />
                      <span>
                        {incident.createdAt
                          ? new Date(incident.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })
                          : 'Recorded'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Coordination Counts & Action Entry */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-3 text-slate-600">
                    <span
                      className="flex items-center gap-1 text-[11px] font-medium"
                      title="Complaints linked to this incident"
                    >
                      <FileText size={13} className="text-slate-400" />
                      <span>{linkedCount} linked grievance{linkedCount !== 1 ? 's' : ''}</span>
                    </span>

                    {Array.isArray(incident.participatingDepartments) && incident.participatingDepartments.length > 0 && (
                      <span
                        className="flex items-center gap-1 text-[11px] font-medium hidden sm:inline-flex"
                        title="Departments participating in resolution"
                      >
                        <Users size={13} className="text-slate-400" />
                        <span>{incident.participatingDepartments.length} depts</span>
                      </span>
                    )}

                    {hasSubtaskSummary && (
                      <span className="text-[11px] font-semibold text-blue-700">
                        {incident.subtasksSummary.completed}/{incident.subtasksSummary.total} tasks
                      </span>
                    )}
                  </div>

                  {canManageIncidents ? (
                    <button
                      type="button"
                      onClick={() => handleOpenWorkspace(incident.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[11px] shadow-sm transition"
                    >
                      <span>Open Workspace</span>
                      <ArrowRight size={12} />
                    </button>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                      Public View
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* DECLARE PARENT INCIDENT MODAL (Problem F) */}
      {isDeclareModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Declare Multi-Agency Incident
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cluster civic emergencies across municipal departments
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeclareModalOpen(false)}
                disabled={declareLoading}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDeclareIncidentSubmit} className="p-6 space-y-4 text-xs">
              {declareError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                  <span>{declareError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Incident Title * (Min 3 characters)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Major Water Pipeline Burst & Road Cavity on MG Road"
                  value={declareForm.title}
                  onChange={(e) => setDeclareForm({ ...declareForm, title: e.target.value })}
                  disabled={declareLoading}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={declareForm.category}
                    onChange={(e) => setDeclareForm({ ...declareForm, category: e.target.value })}
                    disabled={declareLoading}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="roads">Roads & Infrastructure</option>
                    <option value="water">Drinking Water Supply</option>
                    <option value="electricity">Electricity & Power</option>
                    <option value="municipal">Municipal Sanitation</option>
                    <option value="healthcare">Public Health</option>
                    <option value="flood relief">Flood Relief & Disaster</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Lead Department *
                  </label>
                  <select
                    value={declareForm.leadDepartment}
                    onChange={(e) => setDeclareForm({ ...declareForm, leadDepartment: e.target.value })}
                    disabled={declareLoading}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name || d.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Priority Level *
                  </label>
                  <select
                    value={declareForm.priority}
                    onChange={(e) => setDeclareForm({ ...declareForm, priority: e.target.value })}
                    disabled={declareLoading}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-semibold"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Incident Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Detailed multi-agency summary, severity assessment, and emergency context..."
                  value={declareForm.description}
                  onChange={(e) => setDeclareForm({ ...declareForm, description: e.target.value })}
                  disabled={declareLoading}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Locality / Landmark</label>
                  <input
                    type="text"
                    placeholder="e.g. Sector 4 Junction"
                    value={declareForm.locality}
                    onChange={(e) => setDeclareForm({ ...declareForm, locality: e.target.value })}
                    disabled={declareLoading}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">District</label>
                  <input
                    type="text"
                    placeholder="e.g. Pune"
                    value={declareForm.district}
                    onChange={(e) => setDeclareForm({ ...declareForm, district: e.target.value })}
                    disabled={declareLoading}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    placeholder="e.g. Maharashtra"
                    value={declareForm.state}
                    onChange={(e) => setDeclareForm({ ...declareForm, state: e.target.value })}
                    disabled={declareLoading}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Participating Departments
                </label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {departments
                    .filter(d => d.id !== declareForm.leadDepartment)
                    .map((dept) => {
                      const isSelected = declareForm.participatingDepartments.includes(dept.id);
                      return (
                        <button
                          key={dept.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setDeclareForm({
                                ...declareForm,
                                participatingDepartments: declareForm.participatingDepartments.filter(id => id !== dept.id)
                              });
                            } else {
                              setDeclareForm({
                                ...declareForm,
                                participatingDepartments: [...declareForm.participatingDepartments, dept.id]
                              });
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition ${
                            isSelected
                              ? 'bg-blue-100 text-blue-800 border-blue-300'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {dept.name || dept.id}
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsDeclareModalOpen(false)}
                  disabled={declareLoading}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={declareLoading || declareForm.title.trim().length < 3}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow transition disabled:opacity-50 flex items-center gap-2"
                >
                  {declareLoading && <RefreshCw size={13} className="animate-spin" />}
                  <span>{declareLoading ? 'Declaring Incident...' : 'Declare Incident'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
