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
  fetchComplaintDuplicates,
  submitComplaintFeedback,
  getComplaintFeedback,
  submitComplaintAppeal,
  fetchAppeals,
  updateAppealStatus,
  addAppealNote,
  recordAppealDecision,
  submitReopeningRequest,
  fetchComplaintReopenings,
  recordReopeningDecision,
  submitComplaintClarification,
  fetchComplaintClarifications,
  respondToClarification,
  closeClarification,
  requestComplaintReminder,
  fetchComplaintReminderStatus,
  fetchComplaintReminders,
  fetchComplaintStatusExplanation
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
  Copy,
  X,
  Plus,
  Check,
  HelpCircle,
  Star,
  RotateCcw,
  ShieldAlert,
  ThumbsUp,
  ChevronDown,
  ChevronUp,
  Languages,
  Bell,
  Info
} from 'lucide-react';
import {
  RESOLUTION_OUTCOME_OPTIONS,
  VERIFICATION_METHOD_OPTIONS,
  RESOLUTION_EXCEPTION_REASONS,
  EVIDENCE_TYPE_OPTIONS,
  RESOLUTION_THRESHOLDS,
  CATEGORY_RESOLUTION_POLICIES,
  isSafeEvidenceReference,
  formatOutcomeType,
  formatVerificationMethod,
  formatExceptionReason
} from '../constants/resolutionQuality.constants';

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

  // Phase 10: Feedback, Appeals & Controlled Reopening State
  const [feedbackList, setFeedbackList] = useState([]);
  const [appealsList, setAppealsList] = useState([]);
  const [reopeningsList, setReopeningsList] = useState([]);

  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComments, setFeedbackComments] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealReasonCategory, setAppealReasonCategory] = useState('INCOMPLETE_WORK');
  const [appealExplanation, setAppealExplanation] = useState('');
  const [appealEvidence, setAppealEvidence] = useState('');
  const [submittingAppeal, setSubmittingAppeal] = useState(false);
  const [appealMessage, setAppealMessage] = useState(null);

  const [showReopeningForm, setShowReopeningForm] = useState(false);
  const [reopeningReasonCategory, setReopeningReasonCategory] = useState('ISSUE_PERSISTS');
  const [reopeningExplanation, setReopeningExplanation] = useState('');
  const [submittingReopening, setSubmittingReopening] = useState(false);
  const [reopeningMessage, setReopeningMessage] = useState(null);

  // Phase 12: Clarifications, Reminders & Status Translator State
  const [clarificationsList, setClarificationsList] = useState([]);
  const [showClarificationForm, setShowClarificationForm] = useState(false);
  const [clarificationType, setClarificationType] = useState('CLARIFICATION');
  const [clarificationContent, setClarificationContent] = useState('');
  const [submittingClarification, setSubmittingClarification] = useState(false);
  const [clarificationMessage, setClarificationMessage] = useState(null);
  const [officerResponses, setOfficerResponses] = useState({});
  const [respondingClarificationId, setRespondingClarificationId] = useState(null);

  const [reminderEligibility, setReminderEligibility] = useState(null);
  const [remindersList, setRemindersList] = useState([]);
  const [requestingReminder, setRequestingReminder] = useState(false);
  const [reminderMessage, setReminderMessage] = useState(null);

  const [statusExplanation, setStatusExplanation] = useState(null);
  const [translatorLang, setTranslatorLang] = useState('en');

  const loadExplanation = async (targetId, lang = translatorLang) => {
    try {
      const res = await fetchComplaintStatusExplanation(targetId, { lang });
      if (res?.data) {
        setStatusExplanation(res.data);
      }
    } catch (expErr) {
      console.info('Status explanation load notice:', expErr.message);
    }
  };

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

      // Phase 10: Fetch feedback, appeals, and reopening requests for this complaint
      try {
        const [fbRes, appRes, reopRes] = await Promise.allSettled([
          getComplaintFeedback(id),
          fetchAppeals({ complaintId: id }),
          fetchComplaintReopenings(id)
        ]);
        if (fbRes.status === 'fulfilled' && fbRes.value?.data) {
          setFeedbackList(fbRes.value.data);
        }
        if (appRes.status === 'fulfilled' && appRes.value?.data) {
          setAppealsList(appRes.value.data);
        }
        if (reopRes.status === 'fulfilled' && reopRes.value?.data) {
          setReopeningsList(reopRes.value.data);
        }
      } catch (p10Err) {
        console.warn('Phase 10 data load notice:', p10Err.message);
      }

      // Phase 12: Fetch clarifications, reminder eligibility & status explanation
      try {
        const [clrRes, remEligRes, remListRes] = await Promise.allSettled([
          fetchComplaintClarifications(id),
          fetchComplaintReminderStatus(id),
          fetchComplaintReminders(id)
        ]);
        if (clrRes.status === 'fulfilled' && clrRes.value?.data) {
          setClarificationsList(clrRes.value.data);
        }
        if (remEligRes.status === 'fulfilled' && remEligRes.value?.data) {
          setReminderEligibility(remEligRes.value.data);
        }
        if (remListRes.status === 'fulfilled' && remListRes.value?.data) {
          setRemindersList(remListRes.value.data);
        }
        await loadExplanation(id, translatorLang);
      } catch (p12Err) {
        console.warn('Phase 12 data load notice:', p12Err.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmittingFeedback(true);
      setFeedbackMessage(null);
      const res = await submitComplaintFeedback(complaint.id, {
        rating: Number(feedbackRating),
        comments: feedbackComments.trim()
      });
      setFeedbackMessage({ type: 'success', text: 'Thank you! Your resolution feedback has been recorded.' });
      setFeedbackList(prev => [...prev, res.data]);
    } catch (err) {
      setFeedbackMessage({ type: 'error', text: err.message });
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleAppealSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmittingAppeal(true);
      setAppealMessage(null);
      const res = await submitComplaintAppeal(complaint.id, {
        reasonCategory: appealReasonCategory,
        citizenExplanation: appealExplanation.trim(),
        supportingEvidence: appealEvidence.trim() ? [appealEvidence.trim()] : []
      });
      setAppealMessage({ type: 'success', text: `Appeal submitted successfully (Ref: ${res.data.referenceNumber || res.data.id}).` });
      setAppealsList(prev => [...prev, res.data]);
      setShowAppealForm(false);
      setAppealExplanation('');
      setAppealEvidence('');
    } catch (err) {
      setAppealMessage({ type: 'error', text: err.message });
    } finally {
      setSubmittingAppeal(false);
    }
  };

  const handleReopeningSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmittingReopening(true);
      setReopeningMessage(null);
      const res = await submitReopeningRequest(complaint.id, {
        reasonCategory: reopeningReasonCategory,
        citizenExplanation: reopeningExplanation.trim()
      });
      setReopeningMessage({ type: 'success', text: `Reopening request lodged successfully (ID: ${res.data.id}). Awaiting supervisor review.` });
      setReopeningsList(prev => [...prev, res.data]);
      setShowReopeningForm(false);
      setReopeningExplanation('');
    } catch (err) {
      setReopeningMessage({ type: 'error', text: err.message });
    } finally {
      setSubmittingReopening(false);
    }
  };

  // Phase 12: Action Handlers for Clarifications, Reminders & Vernacular Translation
  const handleClarificationSubmit = async (e) => {
    e.preventDefault();
    if (!clarificationContent.trim() || clarificationContent.trim().length < 5) return;
    try {
      setSubmittingClarification(true);
      setClarificationMessage(null);
      const res = await submitComplaintClarification(complaint.id, {
        requestType: clarificationType,
        content: clarificationContent.trim()
      });
      setClarificationMessage({ type: 'success', text: 'Clarification query submitted and routed to the assigned department.' });
      setClarificationsList(prev => [res.data, ...prev]);
      setClarificationContent('');
      setShowClarificationForm(false);
    } catch (err) {
      setClarificationMessage({ type: 'error', text: err.message });
    } finally {
      setSubmittingClarification(false);
    }
  };

  const handleOfficerClarificationRespond = async (clarificationId) => {
    const responseText = (officerResponses[clarificationId] || '').trim();
    if (!responseText || responseText.length < 5) return;
    try {
      setRespondingClarificationId(clarificationId);
      const res = await respondToClarification(clarificationId, { response: responseText });
      setClarificationsList(prev =>
        prev.map(c => (c.id === clarificationId ? res.data : c))
      );
      setOfficerResponses(prev => ({ ...prev, [clarificationId]: '' }));
    } catch (err) {
      alert(`Could not submit response: ${err.message}`);
    } finally {
      setRespondingClarificationId(null);
    }
  };

  const handleClarificationClose = async (clarificationId) => {
    try {
      const res = await closeClarification(clarificationId, { reason: 'Resolved by user' });
      setClarificationsList(prev =>
        prev.map(c => (c.id === clarificationId ? res.data : c))
      );
    } catch (err) {
      alert(`Could not close clarification: ${err.message}`);
    }
  };

  const handleReminderRequest = async () => {
    try {
      setRequestingReminder(true);
      setReminderMessage(null);
      const res = await requestComplaintReminder(complaint.id);
      setReminderMessage({
        type: 'success',
        text: res.message || 'Follow-up reminder recorded in-app for department inspection.'
      });
      if (res.data?.reminder) {
        setRemindersList(prev => [res.data.reminder, ...prev]);
      }
      try {
        const eligRes = await fetchComplaintReminderStatus(complaint.id);
        if (eligRes?.data) setReminderEligibility(eligRes.data);
      } catch {}
    } catch (err) {
      setReminderMessage({ type: 'error', text: err.message });
      if (err.response?.data?.details) {
        setReminderEligibility(err.response.data.details);
      }
    } finally {
      setRequestingReminder(false);
    }
  };

  const handleTranslatorLanguageChange = async (newLang) => {
    setTranslatorLang(newLang);
    await loadExplanation(complaint?.referenceNumber || complaint?.id, newLang);
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

  // Phase 9: Resolution Quality Checker states
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [resolutionTargetStatus, setResolutionTargetStatus] = useState('');
  const [outcomeType, setOutcomeType] = useState('REPAIR_COMPLETED');
  const [verificationMethod, setVerificationMethod] = useState('PHYSICAL_INSPECTION');
  const [closureRemarks, setClosureRemarks] = useState('');
  const [evidenceList, setEvidenceList] = useState([]);
  const [newEvidenceRef, setNewEvidenceRef] = useState('');
  const [isException, setIsException] = useState(false);
  const [exceptionReason, setExceptionReason] = useState('CITIZEN_UNRESPONSIVE');
  const [exceptionJustification, setExceptionJustification] = useState('');
  const [resolutionSubmitting, setResolutionSubmitting] = useState(false);
  const [resolutionBackendError, setResolutionBackendError] = useState(null);
  const [resolutionChecklist, setResolutionChecklist] = useState(null);
  const [resolutionMissingRequirements, setResolutionMissingRequirements] = useState(null);
  const [resolutionScore, setResolutionScore] = useState(null);
  const [resolutionScoreExplanation, setResolutionScoreExplanation] = useState(null);
  const [resolutionWarnings, setResolutionWarnings] = useState([]);

  // Handle status update
  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    if (!newStatus) return;

    // Phase 9: Intercept RESOLVED and CLOSED transitions to require Resolution Quality validation
    if (newStatus === 'RESOLVED' || newStatus === 'CLOSED') {
      setResolutionTargetStatus(newStatus);
      setClosureRemarks(statusRemarks || '');
      setResolutionBackendError(null);
      setResolutionChecklist(null);
      setResolutionMissingRequirements(null);
      setResolutionScore(null);
      setResolutionScoreExplanation(null);
      setResolutionWarnings([]);
      setShowResolutionModal(true);
      return;
    }

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

  // Phase 9: Submit resolution through Resolution Quality Checker
  const handleSubmitResolution = async (e) => {
    e.preventDefault();
    try {
      setResolutionSubmitting(true);
      setResolutionBackendError(null);
      setResolutionChecklist(null);
      setResolutionMissingRequirements(null);
      setResolutionWarnings([]);

      const payload = {
        status: resolutionTargetStatus,
        remarks: closureRemarks.trim() || statusRemarks.trim(),
        actorType: 'OFFICER',
        resolution: {
          actionCompleted: !isException,
          outcomeType: isException ? null : outcomeType,
          verificationMethod: isException ? null : verificationMethod,
          closureRemarks: closureRemarks.trim(),
          evidence: isException ? [] : evidenceList,
          isException: Boolean(isException),
          exceptionReason: isException ? exceptionReason : null,
          justification: isException ? exceptionJustification.trim() : null
        }
      };

      const res = await updateComplaintStatus(complaint.id, payload);
      setComplaint(res.data);
      setShowResolutionModal(false);
      setStatusMessage({
        type: 'success',
        text: `Status successfully updated to ${resolutionTargetStatus} (Compliance Score: ${res.data?.resolutionDetails?.score ?? 100}%)`
      });
      setNewStatus('');
      setStatusRemarks('');
      setClosureRemarks('');
      setEvidenceList([]);
      setExceptionJustification('');
      setIsException(false);
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === 'RESOLUTION_QUALITY_FAILED') {
        setResolutionBackendError(data.error || 'Resolution quality validation failed.');
        setResolutionScore(data.score ?? 0);
        setResolutionScoreExplanation(data.scoreExplanation || null);
        setResolutionChecklist(data.checklist || []);
        setResolutionMissingRequirements(data.missingRequirements || []);
        setResolutionWarnings(data.warnings || []);
      } else if (data?.code === 'FORBIDDEN_EXCEPTION_APPROVAL') {
        setResolutionBackendError(data.error || 'Access denied: supervisory administrative authorization is required to approve a resolution exception.');
        setResolutionChecklist(null);
        setResolutionMissingRequirements([
          {
            id: 'AUTH_FORBIDDEN',
            message: data.error || 'Supervisory administrative authorization is required to approve an exception.'
          }
        ]);
        setResolutionScore(0);
        setResolutionScoreExplanation(null);
      } else {
        setResolutionBackendError(err.message || 'Failed to submit resolution.');
      }
    } finally {
      setResolutionSubmitting(false);
    }
  };

  const handleAddEvidenceRef = () => {
    const trimmed = newEvidenceRef.trim();
    if (!trimmed) return;
    if (evidenceList.includes(trimmed)) return;
    setEvidenceList([...evidenceList, trimmed]);
    setNewEvidenceRef('');
  };

  const handleRemoveEvidenceRef = (index) => {
    setEvidenceList(evidenceList.filter((_, i) => i !== index));
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

      {/* Official Resolution & Quality Verification Record Card */}
      {complaint.resolutionDetails && (
        <div className="p-6 bg-gradient-to-br from-slate-50 to-emerald-50/40 rounded-2xl border-2 border-emerald-600 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
              <div>
                <h2 className="font-bold text-base text-slate-900">
                  Official Resolution & Quality Verification Record
                </h2>
                <p className="text-xs text-slate-500">
                  Validated under CivicSarthi Phase 9 Resolution Standards
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                {complaint.status}
              </span>
              {typeof complaint.resolutionDetails.score === 'number' && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
                  Score: {complaint.resolutionDetails.score}/100
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-0.5">Remediation Outcome</span>
              <span className="font-bold text-slate-900">
                {formatOutcomeType(complaint.resolutionDetails.outcomeType)}
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-0.5">Verification Method</span>
              <span className="font-bold text-slate-900">
                {formatVerificationMethod(complaint.resolutionDetails.verificationMethod)}
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-0.5">Resolution Timestamp</span>
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
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-1">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                Official Closure Remarks
              </span>
              <p className="text-xs text-slate-800 leading-relaxed font-normal">
                {complaint.resolutionDetails.closureRemarks}
              </p>
            </div>
          )}

          {/* Supervisory Exception Indicator */}
          {complaint.resolutionDetails.isException && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Shield size={14} className="text-amber-700 shrink-0" />
                <span>Supervisory Procedural Exception Granted: {formatExceptionReason(complaint.resolutionDetails.exceptionReason)}</span>
              </div>
              {/* Only exposed in officer mode; never in citizen mode */}
              {isOfficerMode && complaint.resolutionDetails.exceptionJustification && (
                <p className="text-[11px] text-amber-800 italic pt-1 border-t border-amber-200">
                  Justification: {complaint.resolutionDetails.exceptionJustification}
                </p>
              )}
            </div>
          )}

          {/* Evidence references: only in officer mode */}
          {isOfficerMode && Array.isArray(complaint.resolutionDetails.evidence) && complaint.resolutionDetails.evidence.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                Referenced Supporting Evidence
              </span>
              <div className="flex flex-wrap gap-2">
                {complaint.resolutionDetails.evidence.map((ev, idx) => (
                  <span key={idx} className="px-2.5 py-1 bg-white rounded-lg border border-slate-200 text-xs text-slate-800 font-mono">
                    {typeof ev === 'object' ? (ev.referenceId || ev.ref || JSON.stringify(ev)) : String(ev)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Resolved by: only in officer mode */}
          {isOfficerMode && complaint.resolutionDetails.resolvedBy && (
            <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200 flex justify-between">
              <span>Verified by Officer Role: <strong className="text-slate-700 capitalize">{complaint.resolutionDetails.resolvedBy.role || 'Officer'}</strong></span>
              {complaint.resolutionDetails.resolvedBy.userId && (
                <span>Officer ID: <strong className="text-slate-700">{complaint.resolutionDetails.resolvedBy.userId}</strong></span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reopened Case Banner (Phase 10) */}
      {(complaint.status === 'REOPENED' || complaint.isReopened) && (
        <div className="p-5 bg-amber-50/90 rounded-2xl border-2 border-amber-500 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <RotateCcw size={18} className="text-amber-600 shrink-0" />
            <span>Grievance Reopened (Investigation Cycle #{complaint.reopenedCount || 1})</span>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            This grievance was reopened following an approved citizen review petition. The assigned department is actively re-investigating the reported civic issue.
            Under CivicSarthi Phase 9 standards, a subsequent closure will require a complete re-verification pass.
          </p>
          {complaint.previousResolutionDetails && (
            <div className="pt-2 border-t border-amber-200/80 text-[11px] text-amber-900">
              <span className="font-semibold">Previous Milestone #{complaint.reopenedCount || 1} Outcome: </span>
              <span>
                {formatOutcomeType(complaint.previousResolutionDetails.outcomeType)} ({formatVerificationMethod(complaint.previousResolutionDetails.verificationMethod)})
              </span>
            </div>
          )}
        </div>
      )}

      {/* PHASE 12: CITIZEN STATUS TRANSLATOR */}
      {statusExplanation && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                <Languages size={18} />
              </div>
              <div>
                <h2 className="font-bold text-base text-slate-900">
                  Citizen-Friendly Status Breakdown
                </h2>
                <p className="text-xs text-slate-500">
                  Plain-language translation of official administrative progress
                </p>
              </div>
            </div>

            {/* Language Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => handleTranslatorLanguageChange('en')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                  translatorLang === 'en'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => handleTranslatorLanguageChange('hi')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                  translatorLang === 'hi'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                हिंदी (Hindi)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-700 block flex items-center gap-1.5">
                <Info size={14} className="text-blue-600" />
                {translatorLang === 'hi' ? 'इस स्थिति का क्या अर्थ है?' : 'What this status means'}
              </span>
              <p className="text-slate-800 leading-relaxed font-medium">
                {statusExplanation.meaning}
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-700 block flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600" />
                {translatorLang === 'hi' ? 'अब तक क्या हुआ है?' : 'What has actually happened'}
              </span>
              <p className="text-slate-800 leading-relaxed font-medium">
                {statusExplanation.whatHappened}
              </p>
            </div>

            <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200 space-y-1">
              <span className="font-bold text-amber-900 block flex items-center gap-1.5">
                <ArrowRight size={14} className="text-amber-600" />
                {translatorLang === 'hi' ? 'आप आगे क्या कर सकते हैं?' : 'What you can do next'}
              </span>
              <p className="text-amber-950 leading-relaxed font-medium">
                {statusExplanation.nextSteps}
              </p>
            </div>

            <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200 space-y-1">
              <span className="font-bold text-blue-900 block flex items-center gap-1.5">
                <Clock size={14} className="text-blue-600" />
                {translatorLang === 'hi' ? 'समय-सीमा व प्रगति' : 'SLA & Expected Timelines'}
              </span>
              <p className="text-blue-950 leading-relaxed font-medium">
                {statusExplanation.slaGuidance}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 12: CITIZEN FOLLOW-UP REMINDERS */}
      {(!isOfficerMode || (user && user.id === complaint.citizenId)) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                <Bell size={18} />
              </div>
              <div>
                <h2 className="font-bold text-base text-slate-900">
                  Citizen Follow-Up Reminder
                </h2>
                <p className="text-xs text-slate-500">
                  Request an in-app follow-up for departmental review when progress has stalled
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleReminderRequest}
              disabled={
                requestingReminder ||
                complaint.status === 'RESOLVED' ||
                complaint.status === 'CLOSED' ||
                reminderEligibility?.throttled
              }
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50 flex items-center gap-2 self-start sm:self-auto"
            >
              {requestingReminder ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Submitting Reminder...</span>
                </>
              ) : reminderEligibility?.throttled ? (
                <>
                  <Clock size={14} />
                  <span>Throttled ({reminderEligibility.timeRemainingMinutes || 0}m left)</span>
                </>
              ) : (
                <>
                  <Bell size={14} />
                  <span>Send Follow-Up Reminder</span>
                </>
              )}
            </button>
          </div>

          {reminderMessage && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              reminderMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}>
              <Info size={16} className="shrink-0" />
              <span>{reminderMessage.text}</span>
            </div>
          )}

          {/* Transparent delivery disclaimer */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between flex-wrap gap-2">
            <span>
              <strong>Delivery Mode:</strong> In-app audit log (reminders are permanently logged for inspecting officers; external SMS/Email is unconfigured).
            </span>
            <span className="font-mono text-[11px] text-slate-500">
              Cooldown window: 24 hours
            </span>
          </div>

          {/* Past Reminders List */}
          {remindersList.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Reminder Audit Trail ({remindersList.length})
              </span>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {remindersList.map((rem) => (
                  <div key={rem.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-blue-700">#{rem.id}</span>
                      <span className="text-slate-600 ml-2">{rem.message}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {new Date(rem.requestedAt || rem.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PHASE 12: CITIZEN CLARIFICATIONS & ADDITIONAL INFORMATION */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <MessageSquare size={18} />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-900">
                Citizen Clarification & Information Threads
              </h2>
              <p className="text-xs text-slate-500">
                Ask clarifying questions or supply additional details without altering official complaint status
              </p>
            </div>
          </div>

          {(!isOfficerMode || (user && user.id === complaint.citizenId)) && (
            <button
              type="button"
              onClick={() => setShowClarificationForm(!showClarificationForm)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus size={14} />
              <span>{showClarificationForm ? 'Cancel' : 'New Clarification Query'}</span>
            </button>
          )}
        </div>

        {clarificationMessage && (
          <div className={`p-3 rounded-xl text-xs ${
            clarificationMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {clarificationMessage.text}
          </div>
        )}

        {/* Submit Form */}
        {showClarificationForm && (
          <form onSubmit={handleClarificationSubmit} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="clrType"
                  value="CLARIFICATION"
                  checked={clarificationType === 'CLARIFICATION'}
                  onChange={() => setClarificationType('CLARIFICATION')}
                />
                <span>Clarification Question</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="clrType"
                  value="ADDITIONAL_INFO"
                  checked={clarificationType === 'ADDITIONAL_INFO'}
                  onChange={() => setClarificationType('ADDITIONAL_INFO')}
                />
                <span>Additional Information / Landmark Details</span>
              </label>
            </div>

            <div>
              <textarea
                required
                rows={3}
                value={clarificationContent}
                onChange={(e) => setClarificationContent(e.target.value)}
                placeholder="Type your clarification question or supplementary info (min 5 characters, max 2000)..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>Min 5 chars</span>
                <span>{clarificationContent.length} / 2000</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowClarificationForm(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingClarification || clarificationContent.trim().length < 5}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {submittingClarification && <RefreshCw size={12} className="animate-spin" />}
                <span>Submit to Department</span>
              </button>
            </div>
          </form>
        )}

        {/* Existing Clarifications List */}
        {clarificationsList.length > 0 ? (
          <div className="space-y-4">
            {clarificationsList.map((clr) => (
              <div key={clr.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-indigo-700">#{clr.id}</span>
                    <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                      {clr.requestType === 'ADDITIONAL_INFO' ? 'Additional Information' : 'Clarification Request'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      clr.status === 'RESPONDED'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : clr.status === 'CLOSED'
                        ? 'bg-slate-200 text-slate-700 border-slate-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}>
                      {clr.status}
                    </span>
                    {clr.status !== 'CLOSED' && (
                      <button
                        type="button"
                        onClick={() => handleClarificationClose(clr.id)}
                        className="px-2 py-0.5 text-[10px] text-slate-600 hover:text-slate-900 border border-slate-300 rounded hover:bg-slate-100 transition"
                      >
                        Close Thread
                      </button>
                    )}
                  </div>
                </div>

                {/* Citizen Question / Context */}
                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Citizen Request ({new Date(clr.createdAt).toLocaleString()}):
                  </span>
                  <p className="text-slate-800 font-medium leading-relaxed">
                    {clr.content}
                  </p>
                </div>

                {/* Officer Responses */}
                {clr.responses && clr.responses.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 block">
                      Official Department Responses ({clr.responses.length}):
                    </span>
                    {clr.responses.map((resp, rIdx) => (
                      <div key={rIdx} className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-900">
                          <span>{resp.responderName} ({resp.responderRole})</span>
                          <span>{new Date(resp.respondedAt).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-800 leading-relaxed font-medium">
                          {resp.response}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Officer Reply Form (only in officer mode and if open) */}
                {isOfficerMode && clr.status !== 'CLOSED' && (
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <span className="text-[11px] font-bold text-slate-700 block">
                      Post Citizen-Visible Department Response:
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Type citizen-visible response (min 5 characters)..."
                        value={officerResponses[clr.id] || ''}
                        onChange={(e) => setOfficerResponses({ ...officerResponses, [clr.id]: e.target.value })}
                        className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                      <button
                        type="button"
                        onClick={() => handleOfficerClarificationRespond(clr.id)}
                        disabled={respondingClarificationId === clr.id || !officerResponses[clr.id] || officerResponses[clr.id].trim().length < 5}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                      >
                        {respondingClarificationId === clr.id ? 'Sending...' : 'Send Response'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">No clarification requests initiated for this grievance.</p>
        )}
      </div>

      {/* PHASE 10: CITIZEN RESOLUTION FEEDBACK & RATINGS */}
      {(complaint.status === 'RESOLVED' || complaint.status === 'CLOSED' || feedbackList.length > 0) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Star size={20} className="text-amber-500 fill-amber-400" />
              <h2 className="font-bold text-base text-slate-900">
                Citizen Resolution Satisfaction & Ratings
              </h2>
            </div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
              Phase 10 Feedback
            </span>
          </div>

          {/* List existing feedback */}
          {feedbackList.length > 0 ? (
            <div className="space-y-3">
              {feedbackList.map((fb, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="flex text-amber-400">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={16}
                            className={star <= fb.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
                          />
                        ))}
                      </div>
                      <span className="font-bold text-slate-800 ml-1">
                        {fb.rating} / 5 Stars
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Milestone #{fb.resolutionMilestone || 1} • {new Date(fb.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  {fb.comments && (
                    <p className="text-slate-700 italic bg-white p-2.5 rounded-lg border border-slate-100">
                      "{fb.comments}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No citizen satisfaction ratings recorded yet for this resolution milestone.</p>
          )}

          {/* Citizen Feedback Submission Form (Only shown if owner or citizen and no feedback for current milestone) */}
          {(!isOfficerMode || (user && user.id === complaint.citizenId)) &&
            (complaint.status === 'RESOLVED' || complaint.status === 'CLOSED') &&
            !feedbackList.some(f => f.resolutionMilestone === (complaint.resolutionMilestone || '1')) && (
              <form onSubmit={handleFeedbackSubmit} className="pt-3 border-t border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-800 block">
                  Rate Your Experience with this Resolution (Milestone #{complaint.resolutionMilestone || '1'})
                </span>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">Rating:</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRating(star)}
                        className="p-1 text-amber-400 hover:scale-110 transition"
                      >
                        <Star
                          size={22}
                          className={star <= feedbackRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
                        />
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-bold text-slate-700 font-mono">
                    ({feedbackRating} / 5)
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Citizen Comments (Optional, max 1000 characters)
                  </label>
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={feedbackComments}
                    onChange={(e) => setFeedbackComments(e.target.value)}
                    placeholder="Share whether the work was completed adequately, timeliness, officer conduct..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {feedbackMessage && (
                  <div className={`p-3 rounded-lg text-xs ${
                    feedbackMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}>
                    {feedbackMessage.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submittingFeedback}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  {submittingFeedback ? 'Recording Rating...' : 'Submit Resolution Rating'}
                </button>
              </form>
            )}
        </div>
      )}

      {/* PHASE 10: FORMAL RESOLUTION APPEALS & DISPUTES */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert size={20} className="text-purple-600" />
            <h2 className="font-bold text-base text-slate-900">
              Formal Resolution Appeals Desk
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800">
              Dispute Escalation
            </span>
            {(!isOfficerMode || (user && user.id === complaint.citizenId)) &&
              (complaint.status === 'RESOLVED' || complaint.status === 'CLOSED') && (
                <button
                  type="button"
                  onClick={() => setShowAppealForm(!showAppealForm)}
                  className="text-xs px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition"
                >
                  {showAppealForm ? 'Cancel Appeal' : 'File Appeal'}
                </button>
              )}
          </div>
        </div>

        {/* Existing Appeals List */}
        {appealsList.length > 0 ? (
          <div className="space-y-3">
            {appealsList.map((appeal) => (
              <div key={appeal.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-purple-700">
                      {appeal.referenceNumber || appeal.id}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">
                      {appeal.reasonCategory}
                    </span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    appeal.status === 'UPHELD' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                    appeal.status === 'REJECTED' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                    'bg-amber-100 text-amber-800 border-amber-300'
                  }`}>
                    {appeal.status}
                  </span>
                </div>

                <p className="text-slate-800 italic bg-white p-2.5 rounded-lg border border-slate-100">
                  "{appeal.citizenExplanation}"
                </p>

                {appeal.decision && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-[11px] space-y-1">
                    <div className="flex items-center justify-between font-bold text-blue-900">
                      <span>Adjudication Verdict: {appeal.decision}</span>
                      <span>Decided: {new Date(appeal.decidedAt).toLocaleDateString('en-IN')}</span>
                    </div>
                    {appeal.citizenExplanationDecision && (
                      <p className="text-blue-800">
                        {appeal.citizenExplanationDecision}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">No formal appeals lodged against this grievance.</p>
        )}

        {/* Appeal Filing Form */}
        {showAppealForm && (
          <form onSubmit={handleAppealSubmit} className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-3 text-xs">
            <h3 className="font-bold text-purple-900 text-xs">
              Lodge Formal Resolution Appeal
            </h3>
            <p className="text-[11px] text-purple-800">
              Submit a formal dispute if the remediation is incomplete, the evidence does not support the claimed outcome, or procedural rules were violated.
            </p>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Dispute Reason Category *
              </label>
              <select
                value={appealReasonCategory}
                onChange={(e) => setAppealReasonCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="INCOMPLETE_WORK">Incomplete Work</option>
                <option value="POOR_QUALITY">Poor Remediation Quality</option>
                <option value="RECURRING_DEFECT">Recurring Defect</option>
                <option value="EVIDENCE_DISPUTED">Evidence Disputed / Inaccurate</option>
                <option value="PROCEDURAL_VIOLATION">Procedural Violation</option>
                <option value="UNSATISFACTORY_EXPLANATION">Unsatisfactory Officer Explanation</option>
                <option value="OTHER">Other Reason</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Detailed Explanation * (Min 10 characters)
              </label>
              <textarea
                required
                rows={3}
                value={appealExplanation}
                onChange={(e) => setAppealExplanation(e.target.value)}
                placeholder="Explain why the resolution is disputed and what corrective action is expected..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Supporting Evidence Reference (Optional URL or File ID)
              </label>
              <input
                type="text"
                value={appealEvidence}
                onChange={(e) => setAppealEvidence(e.target.value)}
                placeholder="e.g. https://... or photo verification ID"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {appealMessage && (
              <div className={`p-3 rounded-lg text-xs ${
                appealMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {appealMessage.text}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAppealForm(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingAppeal || appealExplanation.trim().length < 10}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-sm transition disabled:opacity-50"
              >
                {submittingAppeal ? 'Submitting Appeal...' : 'Submit Appeal'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* PHASE 10: CONTROLLED GRIEVANCE REOPENING */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <RotateCcw size={20} className="text-rose-600" />
            <h2 className="font-bold text-base text-slate-900">
              Controlled Grievance Reopening Desk
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800">
              Re-Investigation Petitions
            </span>
            {(!isOfficerMode || (user && user.id === complaint.citizenId)) &&
              (complaint.status === 'RESOLVED' || complaint.status === 'CLOSED') &&
              complaint.status !== 'REOPENED' && (
                <button
                  type="button"
                  onClick={() => setShowReopeningForm(!showReopeningForm)}
                  className="text-xs px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold transition"
                >
                  {showReopeningForm ? 'Cancel Request' : 'Request Reopening'}
                </button>
              )}
          </div>
        </div>

        {/* Existing Reopening Requests */}
        {reopeningsList.length > 0 ? (
          <div className="space-y-3">
            {reopeningsList.map((req) => (
              <div key={req.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-rose-700">
                      #{req.id}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">
                      {req.reasonCategory}
                    </span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    req.status === 'APPROVED' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                    req.status === 'REJECTED' ? 'bg-slate-200 text-slate-700 border-slate-300' :
                    'bg-amber-100 text-amber-800 border-amber-300'
                  }`}>
                    {req.status}
                  </span>
                </div>

                <p className="text-slate-800 italic bg-white p-2.5 rounded-lg border border-slate-100">
                  "{req.citizenExplanation}"
                </p>

                {req.decision && (
                  <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-[11px] space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>Supervisor Verdict: {req.decision}</span>
                      <span>Decided: {new Date(req.decidedAt).toLocaleDateString('en-IN')}</span>
                    </div>
                    {req.decisionReason && (
                      <p className="text-slate-700">
                        Reason: {req.decisionReason}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">No reopening petitions filed for this grievance.</p>
        )}

        {/* Reopening Petition Form */}
        {showReopeningForm && (
          <form onSubmit={handleReopeningSubmit} className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl space-y-3 text-xs">
            <h3 className="font-bold text-rose-900 text-xs">
              Lodge Grievance Reopening Petition
            </h3>
            <p className="text-[11px] text-rose-800">
              Petition for official case reopening if the issue persists on the ground or physical repair failed.
              An approved request resets the case status to REOPENED and requires departmental remediation.
            </p>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Reopening Reason Category *
              </label>
              <select
                value={reopeningReasonCategory}
                onChange={(e) => setReopeningReasonCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="ISSUE_PERSISTS">Issue Still Persists On Ground</option>
                <option value="RECURRING_FAILURE">Recurring Defect / Failure</option>
                <option value="INCOMPLETE_REMEDIATION">Incomplete Remediation</option>
                <option value="EVIDENCE_UNVERIFIABLE">Evidence Unverifiable / False</option>
                <option value="SAFETY_HAZARD_REMAINS">Public Safety Hazard Remains</option>
                <option value="OTHER">Other Reason</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Citizen Explanation * (Min 10 characters)
              </label>
              <textarea
                required
                rows={3}
                value={reopeningExplanation}
                onChange={(e) => setReopeningExplanation(e.target.value)}
                placeholder="State clearly why the grievance must be reopened and what remains unresolved..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {reopeningMessage && (
              <div className={`p-3 rounded-lg text-xs ${
                reopeningMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {reopeningMessage.text}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReopeningForm(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingReopening || reopeningExplanation.trim().length < 10}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-sm transition disabled:opacity-50"
              >
                {submittingReopening ? 'Lodging Petition...' : 'Submit Reopening Petition'}
              </button>
            </div>
          </form>
        )}
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

              {(newStatus === 'RESOLVED' || newStatus === 'CLOSED') && (
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldCheck size={14} className="text-blue-700" />
                    <span>Phase 9 Resolution Quality Verification Required</span>
                  </div>
                  <p className="text-[11px] text-blue-800 leading-snug">
                    Transitioning to <strong>{newStatus}</strong> enforces verifiable checklist criteria: verified outcome type, inspection method, remediation remarks (&ge;25 chars), and supporting evidence or supervisory exception.
                  </p>
                </div>
              )}

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
                className={`w-full py-2 text-white rounded-lg text-xs font-semibold shadow transition disabled:opacity-50 ${
                  newStatus === 'RESOLVED' || newStatus === 'CLOSED'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {statusUpdating
                  ? 'Updating Status...'
                  : newStatus === 'RESOLVED' || newStatus === 'CLOSED'
                  ? `Verify & Resolve Grievance (${newStatus}) →`
                  : 'Apply Status Transition'}
              </button>
            </form>

            {/* Department Reassignment Control (Admin Gated) */}
            {isAdmin ? (
              <form onSubmit={handleDepartmentReassign} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block">
                    Reassign Department
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                    Admin Privilege
                  </span>
                </div>
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
            ) : (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <span className="font-bold text-slate-800 flex items-center gap-1.5 text-[11px]">
                  <Lock size={12} className="text-slate-500" />
                  Department Reassignment
                </span>
                <p className="text-[11px] text-slate-500">
                  Cross-department reassignment requires System Administrator privileges to prevent departmental loop bounces.
                </p>
              </div>
            )}
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

      {/* Resolution Quality Modal (Phase 9) */}
      {showResolutionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto border border-slate-200 p-6 space-y-5 my-auto animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={20} className="text-blue-600" />
                  <h2 className="font-bold text-base text-slate-900">
                    Resolution Quality Verification Desk
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800">
                    Target: {resolutionTargetStatus}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Objective, verifiable resolution standards required before grievance closure (Phase 9)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowResolutionModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Case Context Strip */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px]">Case ID</span>
                <span className="font-mono font-bold text-slate-800">#{complaint.referenceNumber || complaint.id}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Category</span>
                <span className="font-bold text-slate-800 capitalize">{complaint.category}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Department</span>
                <span className="font-bold text-slate-800">{complaint.departmentId || complaint.department}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Role Authorized</span>
                <span className="font-bold text-slate-800 capitalize">{user?.role || 'Officer'}</span>
              </div>
            </div>

            {/* Category Policy Guidance Notice */}
            {(() => {
              const catPolicy = CATEGORY_RESOLUTION_POLICIES[String(complaint.category || '').toLowerCase()] || {
                requiresEvidence: false,
                guidance: 'Standard procedural resolution verification applies.'
              };
              return (
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between text-blue-900 font-bold">
                    <span>Department Resolution Policy: {complaint.category}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] ${catPolicy.requiresEvidence ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-200 text-slate-700'}`}>
                      {catPolicy.requiresEvidence ? 'Evidence Mandatory for Repair' : 'Evidence Optional'}
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    {catPolicy.guidance}
                  </p>
                </div>
              );
            })()}

            {/* Workflow Tabs: Standard Resolution vs Supervisory Exception */}
            <div className="flex border-b border-slate-200 gap-2">
              <button
                type="button"
                onClick={() => setIsException(false)}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                  !isException
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <CheckCircle2 size={14} />
                <span>Standard Verified Resolution</span>
              </button>
              <button
                type="button"
                onClick={() => setIsException(true)}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                  isException
                    ? 'border-amber-600 text-amber-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Shield size={14} />
                <span>Supervisory Procedural Exception</span>
              </button>
            </div>

            <form onSubmit={handleSubmitResolution} className="space-y-4">
              {!isException ? (
                <>
                  {/* Field 1: Outcome Type */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Remediation Outcome Type *
                    </label>
                    <select
                      value={outcomeType}
                      onChange={(e) => setOutcomeType(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {RESOLUTION_OUTCOME_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1 italic">
                      {RESOLUTION_OUTCOME_OPTIONS.find((o) => o.value === outcomeType)?.description}
                    </p>
                    {(outcomeType === 'NO_DEFECT_FOUND' || outcomeType === 'REFERRED_EXTERNAL') && (
                      <p className="text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200 mt-1.5 font-medium">
                        ✓ Supporting physical evidence is waived for this non-repair outcome ({outcomeType}).
                      </p>
                    )}
                  </div>

                  {/* Field 2: Verification Method */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Outcome Verification Method *
                    </label>
                    <select
                      value={verificationMethod}
                      onChange={(e) => setVerificationMethod(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {VERIFICATION_METHOD_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1 italic">
                      {VERIFICATION_METHOD_OPTIONS.find((m) => m.value === verificationMethod)?.description}
                    </p>
                  </div>

                  {/* Field 3: Closure Remarks */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Meaningful Closure Remarks * (Min 25 chars)
                      </label>
                      <span className={`text-[11px] font-mono font-semibold ${closureRemarks.trim().length >= 25 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {closureRemarks.trim().length} / 25 min
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      required
                      value={closureRemarks}
                      onChange={(e) => setClosureRemarks(e.target.value)}
                      placeholder="Explain specific remediation steps executed, repairs completed, or inspection findings (minimum 25 characters)..."
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <div className="flex items-center justify-between text-[11px] mt-1">
                      <span className={closureRemarks.trim().length >= 25 ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                        {closureRemarks.trim().length >= 25
                          ? '✓ Minimum character requirement met'
                          : `⚠️ Need at least ${Math.max(0, 25 - closureRemarks.trim().length)} more characters`}
                      </span>
                    </div>
                  </div>

                  {/* Field 4: Evidence References */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700">
                        Supporting Evidence References
                      </label>
                      <span className="text-[11px] text-slate-500">
                        {evidenceList.length} attached
                      </span>
                    </div>

                    {/* Added evidence list */}
                    {evidenceList.length > 0 ? (
                      <div className="flex flex-wrap gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                        {evidenceList.map((ev, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white text-slate-800 rounded-lg border border-slate-300 text-xs font-mono"
                          >
                            <Paperclip size={12} className="text-blue-600" />
                            <span>{ev}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveEvidenceRef(idx)}
                              className="text-slate-400 hover:text-rose-600 ml-1"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">No evidence references added yet.</p>
                    )}

                    {/* Add reference input */}
                    <div className="space-y-1.5">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newEvidenceRef}
                          onChange={(e) => setNewEvidenceRef(e.target.value)}
                          placeholder="Reference tracking string (e.g. PHOTO-2026-001, WO-98214)..."
                          className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleAddEvidenceRef}
                          disabled={!newEvidenceRef.trim()}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1"
                        >
                          <Plus size={13} />
                          <span>Attach</span>
                        </button>
                      </div>

                      {/* Quick suggestions */}
                      <div className="flex flex-wrap gap-1.5 text-[10px]">
                        <span className="text-slate-500 self-center">Prefix presets:</span>
                        <button
                          type="button"
                          onClick={() => setNewEvidenceRef('PHOTO-SITE-CLEARED-')}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 text-slate-700"
                        >
                          + Photo Ref
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewEvidenceRef('WO-REPAIR-')}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 text-slate-700"
                        >
                          + Work Order
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewEvidenceRef('INSP-REP-')}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 text-slate-700"
                        >
                          + Inspection Report
                        </button>
                      </div>

                      {/* Unsafe path alert */}
                      {newEvidenceRef.trim().length > 0 && !isSafeEvidenceReference(newEvidenceRef.trim()) && (
                        <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                          <AlertCircle size={12} />
                          <span>Unsafe reference syntax detected! Local filesystem paths and traversals are strictly prohibited.</span>
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* Supervisory Procedural Exception flow */
                <div className="space-y-4">
                  {/* Role Warning / Authorization indicator */}
                  {isAdmin ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs flex items-start gap-2">
                      <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Supervisory Administrator Privilege Active: </span>
                        <span>You have administrative credentials to evaluate and approve supervisory procedural exceptions.</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-start gap-2">
                      <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Role-Based Authorization Notice: </span>
                        <span>
                          You are logged in as Officer (non-admin). General procedural exceptions require Administrator authorization.
                          The backend will reject unauthorized exceptions with <strong>403 Forbidden</strong> unless this complaint is an incident duplicate cascade.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Exception Reason */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Exception Reason Code *
                    </label>
                    <select
                      value={exceptionReason}
                      onChange={(e) => setExceptionReason(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
                    >
                      {Object.values(RESOLUTION_EXCEPTION_REASONS).map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.label} ({r.code})
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-600 mt-1 italic">
                      {RESOLUTION_EXCEPTION_REASONS[exceptionReason]?.description}
                    </p>
                  </div>

                  {/* Exception Justification */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Exception Justification * (Min 25 chars)
                      </label>
                      <span className={`text-[11px] font-mono font-semibold ${exceptionJustification.trim().length >= 25 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {exceptionJustification.trim().length} / 25 min
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      required
                      value={exceptionJustification}
                      onChange={(e) => setExceptionJustification(e.target.value)}
                      placeholder="Explain why standard remediation could not be completed and why an administrative exception is legally or operationally justified..."
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                    <div className="flex items-center justify-between text-[11px] mt-1">
                      <span className={exceptionJustification.trim().length >= 25 ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                        {exceptionJustification.trim().length >= 25
                          ? '✓ Minimum character requirement met'
                          : `⚠️ Need at least ${Math.max(0, 25 - exceptionJustification.trim().length)} more characters`}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Backend Validation Feedback Area */}
              {resolutionBackendError && (
                <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-xs space-y-3">
                  <div className="flex items-center justify-between text-rose-800 font-bold">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle size={16} className="text-rose-600 shrink-0" />
                      <span>{resolutionBackendError}</span>
                    </div>
                    {typeof resolutionScore === 'number' && (
                      <span className="px-2 py-0.5 rounded bg-rose-200 text-rose-900 font-mono text-[11px]">
                        Score: {resolutionScore}/100
                      </span>
                    )}
                  </div>

                  {resolutionScoreExplanation && (
                    <p className="text-slate-600 text-[11px] italic">
                      {resolutionScoreExplanation}
                    </p>
                  )}

                  {resolutionMissingRequirements && resolutionMissingRequirements.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-rose-200">
                      <span className="font-bold text-rose-900 uppercase text-[10px] tracking-wider block">
                        Missing Requirements Identified:
                      </span>
                      <ul className="list-disc pl-4 space-y-1 text-rose-800">
                        {resolutionMissingRequirements.map((req, idx) => (
                          <li key={idx}>{req.message || req.id}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {resolutionChecklist && resolutionChecklist.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-rose-200">
                      <span className="font-bold text-slate-800 uppercase text-[10px] tracking-wider block">
                        Procedural Checklist Breakdown:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {resolutionChecklist.map((item, idx) => (
                          <div
                            key={idx}
                            className={`p-2 rounded-lg border text-[11px] ${
                              item.status === 'PASSED'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                : 'bg-rose-50/80 border-rose-200 text-rose-900'
                            }`}
                          >
                            <div className="flex items-center justify-between font-bold">
                              <span>{item.label}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                item.status === 'PASSED' ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-200 text-rose-800'
                              }`}>
                                {item.status} ({item.points}/{item.maxPoints})
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-600 mt-1">{item.details}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {resolutionWarnings && resolutionWarnings.length > 0 && (
                    <div className="p-2 bg-amber-50 rounded border border-amber-200 text-amber-800 text-[11px]">
                      {resolutionWarnings.map((w, idx) => (
                        <p key={idx}>⚠️ {w}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowResolutionModal(false)}
                  disabled={resolutionSubmitting}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolutionSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow transition disabled:opacity-50 flex items-center gap-2"
                >
                  {resolutionSubmitting && <RefreshCw size={13} className="animate-spin" />}
                  <span>{resolutionSubmitting ? 'Validating Resolution...' : `Validate & Confirm ${resolutionTargetStatus}`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
