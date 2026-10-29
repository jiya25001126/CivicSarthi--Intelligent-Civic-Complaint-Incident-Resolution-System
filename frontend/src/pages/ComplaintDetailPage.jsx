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
  fetchComplaintAppeals,
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
  fetchComplaintStatusExplanation,
  flagComplaintForReview,
  API_BASE_URL
} from '../api/client';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import HistoricalResolutionSuggestions from '../components/HistoricalResolutionSuggestions';
import {
  ArrowLeft,
  ArrowRight,
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
  Info,
  Flag,
  ExternalLink,
  Image as ImageIcon
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
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
  const { t, lang, formatDate, tStatus, tPriority, tCategory, tDepartment } = useLanguage();

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

  // Manual Spam / Abuse Review Flagging State (Problem C)
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagReasonCode, setFlagReasonCode] = useState('SUSPICIOUS_CONTENT');
  const [flagNotes, setFlagNotes] = useState('');
  const [flagging, setFlagging] = useState(false);
  const [flagMessage, setFlagMessage] = useState(null);

  // Phase 10: Feedback, Appeals & Controlled Reopening State
  const [feedbackList, setFeedbackList] = useState([]);
  const [appealsList, setAppealsList] = useState([]);
  const [reopeningsList, setReopeningsList] = useState([]);
  const [appealsLoading, setAppealsLoading] = useState(false);
  const [appealLoadError, setAppealLoadError] = useState(null);
  const [reopeningsLoading, setReopeningsLoading] = useState(false);
  const [reopeningLoadError, setReopeningLoadError] = useState(null);

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
  const [translatorLang, setTranslatorLang] = useState(lang || 'en');

  useEffect(() => {
    setTranslatorLang(lang);
    if (complaint) {
      loadExplanation(complaint.id, lang);
    }
  }, [lang]);

  const loadExplanation = async (targetId, l = lang) => {
    try {
      const res = await fetchComplaintStatusExplanation(targetId, { lang: l });
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
      const [compRes, deptsRes] = await Promise.allSettled([
        fetchComplaintById(id),
        fetchDepartments()
      ]);

      if (compRes.status === 'rejected') {
        throw new Error(compRes.reason?.message || 'Failed to load grievance details');
      }

      const comp = compRes.value?.data || compRes.value;
      setComplaint(comp);

      const depts = deptsRes.status === 'fulfilled' ? (deptsRes.value?.data || deptsRes.value || []) : [];
      setDepartments(Array.isArray(depts) ? depts : []);

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

      // Phase 10: Fetch feedback, appeals, and reopening requests independently
      setAppealsLoading(true);
      setAppealLoadError(null);
      setReopeningsLoading(true);
      setReopeningLoadError(null);

      const [fbRes, appRes, reopRes] = await Promise.allSettled([
        getComplaintFeedback(id),
        fetchComplaintAppeals(id),
        fetchComplaintReopenings(id)
      ]);

      if (fbRes.status === 'fulfilled') {
        const val = fbRes.value?.data ?? fbRes.value;
        setFeedbackList(Array.isArray(val) ? val : (val ? [val] : []));
      }

      if (appRes.status === 'fulfilled') {
        const val = appRes.value?.data ?? appRes.value;
        setAppealsList(Array.isArray(val) ? val : []);
        setAppealLoadError(null);
      } else {
        const errMsg = appRes.reason?.response?.data?.error || appRes.reason?.message || 'Failed to load appeals';
        console.warn('Appeals load failed:', errMsg);
        setAppealLoadError(errMsg);
      }
      setAppealsLoading(false);

      if (reopRes.status === 'fulfilled') {
        const val = reopRes.value?.data ?? reopRes.value;
        setReopeningsList(Array.isArray(val) ? val : []);
        setReopeningLoadError(null);
      } else {
        const errMsg = reopRes.reason?.response?.data?.error || reopRes.reason?.message || 'Failed to load reopening requests';
        console.warn('Reopenings load failed:', errMsg);
        setReopeningLoadError(errMsg);
      }
      setReopeningsLoading(false);

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
        console.warn('Clarification and reminder data load notice:', p12Err.message);
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
      if (res && res.success && res.data) {
        setFeedbackMessage({
          type: 'success',
          text: lang === 'hi'
            ? 'धन्यवाद! आपकी निवारण संतुष्टि प्रतिक्रिया दर्ज कर ली गई है।'
            : 'Thank you! Your resolution feedback has been recorded.'
        });
        setFeedbackList(prev => [...prev, res.data]);
        setFeedbackComments('');
      } else {
        throw new Error(res?.message || 'Failed to record resolution feedback.');
      }
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
      setAppealLoadError(null);
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
      setReopeningLoadError(null);
      setShowReopeningForm(false);
      setReopeningExplanation('');
    } catch (err) {
      setReopeningMessage({ type: 'error', text: err.message });
    } finally {
      setSubmittingReopening(false);
    }
  };

  const handleFlagComplaint = async (e) => {
    e.preventDefault();
    if (flagging || !complaint) return;
    setFlagMessage(null);

    const trimmedNotes = flagNotes.trim();
    if (!trimmedNotes || trimmedNotes.length < 10) {
      setFlagMessage({
        type: 'error',
        text: 'Please provide at least 10 characters explaining why this complaint is being flagged for review.'
      });
      return;
    }

    try {
      setFlagging(true);
      const res = await flagComplaintForReview(complaint.id, {
        reasonCode: flagReasonCode,
        notes: trimmedNotes
      });
      setFlagMessage({
        type: 'success',
        text: `Complaint successfully flagged for review (Ref: ${res.data?.referenceNumber || res.data?.id || 'Created'}). It is now visible in the Spam Review Desk.`
      });
      setComplaint(prev => ({ ...prev, isFlaggedSpam: true }));
      setTimeout(() => {
        setShowFlagModal(false);
        setFlagNotes('');
        setFlagMessage(null);
      }, 3000);
    } catch (err) {
      setFlagMessage({
        type: 'error',
        text: err.message || 'Failed to flag complaint for review.'
      });
    } finally {
      setFlagging(false);
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
          <ArrowLeft size={14} /> {t('complaintDetail.backToComplaints')}
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to={`/citizen/track/${encodeURIComponent(complaint.referenceNumber || complaint.id)}`}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
          >
            {lang === 'hi' ? 'स्थिति समयरेखा देखें →' : 'View Status Timeline →'}
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
                {tCategory(complaint.category)}
              </span>
              {complaint.duplicateOf && (
                <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                  <LinkIcon size={12} />
                  {lang === 'hi' ? `लिंक्ड डुप्लिकेट #${complaint.duplicateOf}` : `Linked Duplicate of #${complaint.duplicateOf}`}
                </span>
              )}
              {complaint.intelligence?.priorityRecommendation?.publicSafetyHazard && (
                <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  {lang === 'hi' ? 'खतरा चेतावनी' : 'Hazard Alert'}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              {complaint.title || complaint.text}
            </h1>
            <p className="text-xs text-slate-500">
              {t('common.department')}:{' '}
              <span className="font-semibold text-slate-800">
                {tDepartment(complaint.departmentId || complaint.department)}
              </span>
            </p>
            {complaint.statusDescription && (
              <div className="bg-blue-50/70 border border-blue-200 text-blue-900 text-xs p-2.5 rounded-xl">
                <span className="font-semibold">{lang === 'hi' ? 'स्थिति का अर्थ: ' : 'Status Meaning: '}</span>
                {complaint.statusDescription}
              </div>
            )}
          </div>

          <div className="text-left md:text-right self-start md:self-auto space-y-1">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-semibold">
              {lang === 'hi' ? 'आधिकारिक स्थिति संदर्भ' : 'CPGRAMS Status Context'}
            </span>
            <span className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded-full">
              {tStatus(complaint.officialStatus || complaint.status)}
            </span>
          </div>
        </div>

        {/* Narrative & Location */}
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-2">
              {t('complaintDetail.subjectHeading')}
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
                <span>{t('common.filedDate')}</span>
              </div>
              <span className="text-xs font-bold text-slate-800">
                {formatDate(complaint.createdAt)}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                <Clock size={13} />
                <span>{t('common.lastUpdated')}</span>
              </div>
              <span className="text-xs font-bold text-slate-800">
                {formatDate(complaint.updatedAt || complaint.lastUpdated)}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                <Shield size={13} />
                <span>{t('complaintDetail.reassignmentsHeading')}</span>
              </div>
              <span className="text-xs font-bold text-slate-800">
                {complaint.reassignments || 0} {lang === 'hi' ? 'बार' : 'reassignments'}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                <AlertTriangle size={13} />
                <span>{lang === 'hi' ? 'नागरिक अनुस्मारक' : 'Citizen Reminders'}</span>
              </div>
              <span className="text-xs font-bold text-slate-800">
                {complaint.citizenReminders || 0} {lang === 'hi' ? 'सूचनाएं' : 'notifications'}
              </span>
            </div>
          </div>

          {/* Location & Language */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block">{t('submitComplaint.stateLabel')}:</span>
              <span className="font-semibold text-slate-800">{complaint.state || (lang === 'hi' ? 'निर्दिष्ट नहीं' : 'Not specified')}</span>
            </div>
            <div>
              <span className="text-slate-500 block">{t('submitComplaint.districtLabel')}:</span>
              <span className="font-semibold text-slate-800">{complaint.district || (lang === 'hi' ? 'निर्दिष्ट नहीं' : 'Not specified')}</span>
            </div>
            <div>
              <span className="text-slate-500 block">{t('submitComplaint.localityLabel')}:</span>
              <span className="font-semibold text-slate-800">{complaint.locality || (lang === 'hi' ? 'सामान्य वार्ड क्षेत्र' : 'General ward area')}</span>
            </div>
          </div>

          {/* Evidence Attachments */}
          <div>
            <h2 className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-2">
              {t('complaintDetail.evidenceHeading')}
            </h2>
            {complaint.evidence && complaint.evidence.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {complaint.evidence.map((item, idx) => {
                  const isImage = typeof item === 'string' && (
                    item.startsWith('ATTACH-') ||
                    /\.(jpe?g|png|webp)$/i.test(item)
                  );
                  const attachmentUrl = isImage ? `${API_BASE_URL}/api/v1/complaints/attachments/${encodeURIComponent(item)}` : null;

                  if (isImage) {
                    return (
                      <div
                        key={idx}
                        className="group bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition flex flex-col"
                      >
                        <div className="relative h-32 bg-slate-100 overflow-hidden flex items-center justify-center">
                          <img
                            src={attachmentUrl}
                            alt={`Evidence ${item}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.style.display = 'none';
                              if (e.target.nextSibling) {
                                e.target.nextSibling.style.display = 'flex';
                              }
                            }}
                          />
                          <div style={{ display: 'none' }} className="p-3 text-center text-slate-400 flex flex-col items-center justify-center">
                            <ImageIcon size={24} className="text-slate-300 mb-1" />
                            <span className="text-[10px]">Photo Attachment</span>
                          </div>
                        </div>
                        <div className="p-2.5 flex items-center justify-between gap-2 bg-white">
                          <div className="min-w-0 flex-1">
                            <span className="text-[11px] font-semibold text-slate-800 block truncate" title={item}>
                              {item}
                            </span>
                            <span className="text-[10px] text-slate-400">Attached Photo</span>
                          </div>
                          <a
                            href={attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                            title="View full size in new tab"
                          >
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 text-blue-900 border border-blue-200 text-xs font-medium"
                    >
                      <Paperclip size={14} className="text-blue-600 shrink-0" />
                      <span className="truncate" title={String(item)}>{String(item)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">{lang === 'hi' ? 'इस शिकायत के साथ कोई संलग्नक दर्ज नहीं है।' : 'No attachments lodged with this grievance.'}</p>
            )}
          </div>

          {/* SLA Diagnostic Box */}
          {complaint.slaMetrics && (
            <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2">
              <div className="flex items-center gap-2 text-blue-900 text-xs font-bold uppercase tracking-wider">
                <FileCheck size={15} className="text-blue-700" />
                <span>{lang === 'hi' ? 'कॉन्फ़िगरेबल SLA डायग्नोस्टिक' : 'Configurable SLA Diagnostic'}</span>
              </div>
              <div className="text-xs text-slate-700 grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div>
                  <span className="text-slate-500">{lang === 'hi' ? 'मामले की आयु:' : 'Case Age:'}</span>{' '}
                  <span className="font-semibold">{complaint.slaMetrics.ageDays} {lang === 'hi' ? 'दिन' : 'days'}</span> ({lang === 'hi' ? 'SLA लक्ष्य:' : 'SLA Target:'} {complaint.slaMetrics.slaDeadlineDays}d)
                </div>
                <div>
                  <span className="text-slate-500">{lang === 'hi' ? 'अद्यतन रहित दिन:' : 'Days Untouched:'}</span>{' '}
                  <span className="font-semibold">{complaint.slaMetrics.daysSinceUpdate} {lang === 'hi' ? 'दिन' : 'days'}</span>
                </div>
                <div>
                  <span className="text-slate-500">{lang === 'hi' ? 'अनुपालन स्थिति:' : 'Compliance Health:'}</span>{' '}
                  {complaint.slaMetrics.isSlaBreached ? (
                    <span className="text-rose-700 font-bold">{lang === 'hi' ? 'SLA का उल्लंघन हुआ' : 'SLA Breached'}</span>
                  ) : complaint.slaMetrics.isStale ? (
                    <span className="text-amber-700 font-bold">{lang === 'hi' ? 'ठहरा हुआ / पुराना' : 'Stalled / Stale'}</span>
                  ) : (
                    <span className="text-emerald-700 font-bold">{lang === 'hi' ? 'लक्षित SLA के भीतर' : 'Within Target SLA'}</span>
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
                  {lang === 'hi' ? 'आधिकारिक निवारण एवं गुणवत्ता सत्यापन रिकॉर्ड' : 'Official Resolution & Quality Verification Record'}
                </h2>
                <p className="text-xs text-slate-500">
                  {lang === 'hi' ? 'सिविकसारथी निवारण गुणवत्ता मानकों के अंतर्गत सत्यापित' : 'Validated under CivicSarthi Resolution Quality Standards'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                {tStatus(complaint.status)}
              </span>
              {typeof complaint.resolutionDetails.score === 'number' && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
                  {lang === 'hi' ? 'स्कोर:' : 'Score:'} {complaint.resolutionDetails.score}/100
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-0.5">{lang === 'hi' ? 'निवारण परिणाम' : 'Remediation Outcome'}</span>
              <span className="font-bold text-slate-900">
                {formatOutcomeType(complaint.resolutionDetails.outcomeType, lang)}
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-0.5">{lang === 'hi' ? 'सत्यापन पद्धति' : 'Verification Method'}</span>
              <span className="font-bold text-slate-900">
                {formatVerificationMethod(complaint.resolutionDetails.verificationMethod, lang)}
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-0.5">{lang === 'hi' ? 'निवारण समय-मुद्रा' : 'Resolution Timestamp'}</span>
              <span className="font-bold text-slate-900">
                {complaint.resolutionDetails.resolvedAt
                  ? new Date(complaint.resolutionDetails.resolvedAt).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : (lang === 'hi' ? 'दर्ज किया गया' : 'Recorded')}
              </span>
            </div>
          </div>

          {complaint.resolutionDetails.closureRemarks && (
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-1">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                {lang === 'hi' ? 'आधिकारिक समापन टिप्पणियाँ' : 'Official Closure Remarks'}
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
                <span>{lang === 'hi' ? 'पर्यवेक्षी प्रक्रियात्मक छूट स्वीकृत:' : 'Supervisory Procedural Exception Granted:'} {formatExceptionReason(complaint.resolutionDetails.exceptionReason, lang)}</span>
              </div>
              {/* Only exposed in officer mode; never in citizen mode */}
              {isOfficerMode && complaint.resolutionDetails.exceptionJustification && (
                <p className="text-[11px] text-amber-800 italic pt-1 border-t border-amber-200">
                  {lang === 'hi' ? 'औचित्य:' : 'Justification:'} {complaint.resolutionDetails.exceptionJustification}
                </p>
              )}
            </div>
          )}

          {/* Evidence references: only in officer mode */}
          {isOfficerMode && Array.isArray(complaint.resolutionDetails.evidence) && complaint.resolutionDetails.evidence.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                {lang === 'hi' ? 'संदर्भित समर्थक साक्ष्य' : 'Referenced Supporting Evidence'}
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
              <span>{lang === 'hi' ? 'सत्यापित अधिकारी पद:' : 'Verified by Officer Role:'} <strong className="text-slate-700 capitalize">{complaint.resolutionDetails.resolvedBy.role || (lang === 'hi' ? 'अधिकारी' : 'Officer')}</strong></span>
              {complaint.resolutionDetails.resolvedBy.userId && (
                <span>{lang === 'hi' ? 'अधिकारी आईडी:' : 'Officer ID:'} <strong className="text-slate-700">{complaint.resolutionDetails.resolvedBy.userId}</strong></span>
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
            <span>{lang === 'hi' ? `शिकायत पुनः खोली गई (जाँच चक्र #${complaint.reopenedCount || 1})` : `Grievance Reopened (Investigation Cycle #${complaint.reopenedCount || 1})`}</span>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            {lang === 'hi'
              ? 'यह शिकायत स्वीकृत नागरिक समीक्षा याचिका के बाद पुनः खोली गई है। संबंधित विभाग द्वारा इस मामले की सक्रिय रूप से पुनः जाँच की जा रही है। सिविकसारथी मानकों के तहत, बाद के समापन हेतु पूर्ण पुनर्सत्यापन अनिवार्य होगा।'
              : 'This grievance was reopened following an approved citizen review petition. The assigned department is actively re-investigating the reported civic issue. Under CivicSarthi quality verification standards, subsequent closure will require a complete re-verification pass.'}
          </p>
          {complaint.previousResolutionDetails && (
            <div className="pt-2 border-t border-amber-200/80 text-[11px] text-amber-900">
              <span className="font-semibold">{lang === 'hi' ? `पिछला निवारण परिणाम (चक्र #${complaint.reopenedCount || 1}): ` : `Previous Resolution Outcome (Cycle #${complaint.reopenedCount || 1}): `}</span>
              <span>
                {formatOutcomeType(complaint.previousResolutionDetails.outcomeType, lang)} ({formatVerificationMethod(complaint.previousResolutionDetails.verificationMethod, lang)})
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
                  {lang === 'hi' ? 'नागरिक अनुवर्ती स्मरण पत्र' : 'Citizen Follow-Up Reminder'}
                </h2>
                <p className="text-xs text-slate-500">
                  {lang === 'hi' ? 'प्रगति रुकने पर विभागीय समीक्षा हेतु इन-ऐप अनुवर्ती अनुरोध भेजें' : 'Request an in-app follow-up for departmental review when progress has stalled'}
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
                  <span>{lang === 'hi' ? 'स्मरण पत्र भेजा जा रहा है...' : 'Submitting Reminder...'}</span>
                </>
              ) : reminderEligibility?.throttled ? (
                <>
                  <Clock size={14} />
                  <span>{lang === 'hi' ? `प्रतीक्षा अवधि (${reminderEligibility.timeRemainingMinutes || 0} मिनट शेष)` : `Throttled (${reminderEligibility.timeRemainingMinutes || 0}m left)`}</span>
                </>
              ) : (
                <>
                  <Bell size={14} />
                  <span>{lang === 'hi' ? 'अनुवर्ती स्मरण पत्र भेजें' : 'Send Follow-Up Reminder'}</span>
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
              <strong>{lang === 'hi' ? 'वितरण माध्यम:' : 'Delivery Mode:'}</strong> {lang === 'hi' ? 'इन-ऐप ऑडिट लॉग (निरीक्षण अधिकारियों के लिए स्थायी रूप से दर्ज; बाहरी एसएमएस/ईमेल कॉन्फ़िगर नहीं है)।' : 'In-app audit log (reminders are permanently logged for inspecting officers; external SMS/Email is unconfigured).'}
            </span>
            <span className="font-mono text-[11px] text-slate-500">
              {lang === 'hi' ? 'शीतलन अवधि: 24 घंटे' : 'Cooldown window: 24 hours'}
            </span>
          </div>

          {/* Past Reminders List */}
          {remindersList.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                {lang === 'hi' ? `स्मरण पत्र ऑडिट ट्रेल (${remindersList.length})` : `Reminder Audit Trail (${remindersList.length})`}
              </span>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {remindersList.map((rem) => (
                  <div key={rem.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-blue-700">#{rem.id}</span>
                      <span className="text-slate-600 ml-2">{rem.message}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {new Date(rem.requestedAt || rem.createdAt).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN')}
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
                {lang === 'hi' ? 'नागरिक स्पष्टीकरण एवं सूचना संवाद' : 'Citizen Clarification & Information Threads'}
              </h2>
              <p className="text-xs text-slate-500">
                {lang === 'hi' ? 'आधिकारिक शिकायत स्थिति बदले बिना स्पष्टीकरण प्रश्न पूछें या अतिरिक्त विवरण प्रदान करें' : 'Ask clarifying questions or supply additional details without altering official complaint status'}
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
              <span>{showClarificationForm ? (lang === 'hi' ? 'रद्द करें' : 'Cancel') : (lang === 'hi' ? 'नया स्पष्टीकरण अनुरोध' : 'New Clarification Query')}</span>
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
                <span>{lang === 'hi' ? 'स्पष्टीकरण प्रश्न' : 'Clarification Question'}</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="clrType"
                  value="ADDITIONAL_INFO"
                  checked={clarificationType === 'ADDITIONAL_INFO'}
                  onChange={() => setClarificationType('ADDITIONAL_INFO')}
                />
                <span>{lang === 'hi' ? 'अतिरिक्त सूचना / स्थल विवरण' : 'Additional Information / Landmark Details'}</span>
              </label>
            </div>

            <div>
              <textarea
                required
                rows={3}
                value={clarificationContent}
                onChange={(e) => setClarificationContent(e.target.value)}
                placeholder={lang === 'hi' ? 'अपना स्पष्टीकरण प्रश्न या पूरक जानकारी लिखें (न्यूनतम 5 वर्ण, अधिकतम 2000)...' : 'Type your clarification question or supplementary info (min 5 characters, max 2000)...'}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>{lang === 'hi' ? 'न्यूनतम 5 वर्ण' : 'Min 5 chars'}</span>
                <span>{clarificationContent.length} / 2000</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowClarificationForm(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={submittingClarification || clarificationContent.trim().length < 5}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {submittingClarification && <RefreshCw size={12} className="animate-spin" />}
                <span>{lang === 'hi' ? 'विभाग को सबमिट करें' : 'Submit to Department'}</span>
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
                      {clr.requestType === 'ADDITIONAL_INFO' ? (lang === 'hi' ? 'अतिरिक्त सूचना' : 'Additional Information') : (lang === 'hi' ? 'स्पष्टीकरण अनुरोध' : 'Clarification Request')}
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
                      {clr.status === 'RESPONDED' ? (lang === 'hi' ? 'उत्तर दिया गया' : 'RESPONDED') : clr.status === 'CLOSED' ? (lang === 'hi' ? 'बंद' : 'CLOSED') : (lang === 'hi' ? 'प्रतीक्षारत' : 'PENDING')}
                    </span>
                    {clr.status !== 'CLOSED' && (
                      <button
                        type="button"
                        onClick={() => handleClarificationClose(clr.id)}
                        className="px-2 py-0.5 text-[10px] text-slate-600 hover:text-slate-900 border border-slate-300 rounded hover:bg-slate-100 transition"
                      >
                        {lang === 'hi' ? 'संवाद बंद करें' : 'Close Thread'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Citizen Question / Context */}
                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    {lang === 'hi' ? 'नागरिक अनुरोध' : 'Citizen Request'} ({new Date(clr.createdAt).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN')}):
                  </span>
                  <p className="text-slate-800 font-medium leading-relaxed">
                    {clr.content}
                  </p>
                </div>

                {/* Officer Responses */}
                {clr.responses && clr.responses.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 block">
                      {lang === 'hi' ? `आधिकारिक विभागीय उत्तर (${clr.responses.length}):` : `Official Department Responses (${clr.responses.length}):`}
                    </span>
                    {clr.responses.map((resp, rIdx) => (
                      <div key={rIdx} className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-900">
                          <span>{resp.responderName} ({resp.responderRole})</span>
                          <span>{new Date(resp.respondedAt).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN')}</span>
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
                      {lang === 'hi' ? 'नागरिक-दृश्य विभागीय उत्तर पोस्ट करें:' : 'Post Citizen-Visible Department Response:'}
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder={lang === 'hi' ? 'नागरिक-दृश्य उत्तर लिखें (न्यूनतम 5 वर्ण)...' : 'Type citizen-visible response (min 5 characters)...'}
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
                        {respondingClarificationId === clr.id ? (lang === 'hi' ? 'भेजा जा रहा है...' : 'Sending...') : (lang === 'hi' ? 'उत्तर भेजें' : 'Send Response')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">{lang === 'hi' ? 'इस शिकायत हेतु कोई स्पष्टीकरण अनुरोध नहीं है।' : 'No clarification requests initiated for this grievance.'}</p>
        )}
      </div>

      {/* PHASE 10: CITIZEN RESOLUTION FEEDBACK & RATINGS */}
      {(complaint.status === 'RESOLVED' || complaint.status === 'CLOSED' || feedbackList.length > 0) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Star size={20} className="text-amber-500 fill-amber-400" />
              <h2 className="font-bold text-base text-slate-900">
                {lang === 'hi' ? 'नागरिक निवारण संतुष्टि एवं रेटिंग' : 'Citizen Resolution Satisfaction & Ratings'}
              </h2>
            </div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
              {lang === 'hi' ? 'निवारण प्रतिक्रिया' : 'Resolution Feedback'}
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
                        {fb.rating} / 5 {lang === 'hi' ? 'सितारे' : 'Stars'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {lang === 'hi' ? `निवारण चक्र #${fb.resolutionMilestone || 1}` : `Resolution Cycle #${fb.resolutionMilestone || 1}`} • {new Date(fb.createdAt).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
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
            <p className="text-xs text-slate-500 italic">{lang === 'hi' ? 'इस निवारण के लिए अभी तक कोई नागरिक संतुष्टि रेटिंग दर्ज नहीं की गई है।' : 'No citizen satisfaction ratings recorded yet for this resolution.'}</p>
          )}

          {feedbackMessage && (
            <div className={`p-3 rounded-lg text-xs ${
              feedbackMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {feedbackMessage.text}
            </div>
          )}

          {/* Citizen Feedback Submission Form (Only shown if owner or citizen and no feedback for current milestone) */}
          {(!isOfficerMode || (user && user.id === complaint.citizenId)) &&
            (complaint.status === 'RESOLVED' || complaint.status === 'CLOSED') &&
            !feedbackList.some(f => String(f.resolutionMilestone || '1') === String(complaint.resolutionMilestone || '1')) && (
              <form onSubmit={handleFeedbackSubmit} className="pt-3 border-t border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-800 block">
                  {lang === 'hi' ? 'अपने निवारण अनुभव का मूल्यांकन करें' : 'Rate Your Resolution Experience'}
                </span>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">{lang === 'hi' ? 'रेटिंग:' : 'Rating:'}</span>
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
                    {lang === 'hi' ? 'नागरिक टिप्पणियाँ (वैकल्पिक, अधिकतम 1000 वर्ण)' : 'Citizen Comments (Optional, max 1000 characters)'}
                  </label>
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={feedbackComments}
                    onChange={(e) => setFeedbackComments(e.target.value)}
                    placeholder={lang === 'hi' ? 'बताएं कि क्या कार्य संतोषजनक ढंग से पूर्ण हुआ, समयबद्धता, अधिकारी आचरण...' : 'Share whether the work was completed adequately, timeliness, officer conduct...'}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingFeedback}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  {submittingFeedback ? (lang === 'hi' ? 'रेटिंग दर्ज की जा रही है...' : 'Recording Rating...') : (lang === 'hi' ? 'निवारण रेटिंग सबमिट करें' : 'Submit Resolution Rating')}
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
              {lang === 'hi' ? 'औपचारिक निवारण अपील डेस्क' : 'Formal Resolution Appeals Desk'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800">
              {lang === 'hi' ? 'विवाद निवारण' : 'Dispute Escalation'}
            </span>
            {(!isOfficerMode || (user && user.id === complaint.citizenId)) &&
              (complaint.status === 'RESOLVED' || complaint.status === 'CLOSED') && (
                <button
                  type="button"
                  onClick={() => setShowAppealForm(!showAppealForm)}
                  className="text-xs px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition"
                >
                  {showAppealForm ? (lang === 'hi' ? 'अपील रद्द करें' : 'Cancel Appeal') : (lang === 'hi' ? 'अपील दर्ज करें' : 'File Appeal')}
                </button>
              )}
          </div>
        </div>

        {/* Existing Appeals List */}
        {appealsLoading ? (
          <div className="p-4 text-center text-slate-500 text-xs">
            <RefreshCw size={14} className="animate-spin inline mr-1 text-purple-600" />
            {lang === 'hi' ? 'अपील इतिहास लोड हो रहा है...' : 'Loading appeals history...'}
          </div>
        ) : appealLoadError ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            {lang === 'hi' ? `इस समय अपील इतिहास लोड करने में असमर्थ (${appealLoadError})।` : `Unable to load appeal history at this time (${appealLoadError}).`}
          </div>
        ) : appealsList.length > 0 ? (
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
                    {appeal.status === 'UPHELD' ? (lang === 'hi' ? 'स्वीकृत' : 'UPHELD') : appeal.status === 'REJECTED' ? (lang === 'hi' ? 'खारिज' : 'REJECTED') : (lang === 'hi' ? 'प्रतीक्षारत' : appeal.status)}
                  </span>
                </div>

                <p className="text-slate-800 italic bg-white p-2.5 rounded-lg border border-slate-100">
                  "{appeal.citizenExplanation || appeal.explanation}"
                </p>

                {appeal.decision && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-[11px] space-y-1">
                    <div className="flex items-center justify-between font-bold text-blue-900">
                      <span>{lang === 'hi' ? 'निर्णय निष्कर्ष:' : 'Adjudication Verdict:'} {typeof appeal.decision === 'object' ? appeal.decision.outcome : appeal.decision}</span>
                      <span>{lang === 'hi' ? 'निर्णय तिथि:' : 'Decided:'} {new Date(appeal.decision?.decidedAt || appeal.decidedAt || appeal.updatedAt).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN')}</span>
                    </div>
                    {(appeal.decision?.reason || appeal.citizenExplanationDecision) && (
                      <p className="text-blue-800">
                        {appeal.decision?.reason || appeal.citizenExplanationDecision}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">{lang === 'hi' ? 'इस शिकायत के विरुद्ध कोई औपचारिक अपील दर्ज नहीं है।' : 'No formal appeals lodged against this grievance.'}</p>
        )}

        {/* Appeal Filing Form */}
        {showAppealForm && (
          <form onSubmit={handleAppealSubmit} className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-3 text-xs">
            <h3 className="font-bold text-purple-900 text-xs">
              {lang === 'hi' ? 'औपचारिक निवारण अपील दर्ज करें' : 'Lodge Formal Resolution Appeal'}
            </h3>
            <p className="text-[11px] text-purple-800">
              {lang === 'hi'
                ? 'यदि निवारण कार्य अधूरा है, साक्ष्य परिणाम का समर्थन नहीं करते, या प्रक्रियात्मक नियमों का उल्लंघन हुआ है, तो औपचारिक अपील प्रस्तुत करें।'
                : 'Submit a formal dispute if the remediation is incomplete, the evidence does not support the claimed outcome, or procedural rules were violated.'}
            </p>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {lang === 'hi' ? 'विवाद कारण श्रेणी *' : 'Dispute Reason Category *'}
              </label>
              <select
                value={appealReasonCategory}
                onChange={(e) => setAppealReasonCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="INCOMPLETE_WORK">{lang === 'hi' ? 'अपूर्ण कार्य' : 'Incomplete Work'}</option>
                <option value="POOR_QUALITY">{lang === 'hi' ? 'घटिया निवारण गुणवत्ता' : 'Poor Remediation Quality'}</option>
                <option value="RECURRING_DEFECT">{lang === 'hi' ? 'पुनरावर्ती दोष' : 'Recurring Defect'}</option>
                <option value="EVIDENCE_DISPUTED">{lang === 'hi' ? 'साक्ष्य विवादित / गलत' : 'Evidence Disputed / Inaccurate'}</option>
                <option value="PROCEDURAL_VIOLATION">{lang === 'hi' ? 'प्रक्रियात्मक उल्लंघन' : 'Procedural Violation'}</option>
                <option value="UNSATISFACTORY_EXPLANATION">{lang === 'hi' ? 'असंतोषजनक अधिकारी स्पष्टीकरण' : 'Unsatisfactory Officer Explanation'}</option>
                <option value="OTHER">{lang === 'hi' ? 'अन्य कारण' : 'Other Reason'}</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {lang === 'hi' ? 'विस्तृत विवरण * (न्यूनतम 10 वर्ण)' : 'Detailed Explanation * (Min 10 characters)'}
              </label>
              <textarea
                required
                rows={3}
                value={appealExplanation}
                onChange={(e) => setAppealExplanation(e.target.value)}
                placeholder={lang === 'hi' ? 'बताएं कि समाधान क्यों विवादित है और क्या सुधारात्मक कार्रवाई अपेक्षित है...' : 'Explain why the resolution is disputed and what corrective action is expected...'}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {lang === 'hi' ? 'समर्थक साक्ष्य संदर्भ (वैकल्पिक URL या फ़ाइल आईडी)' : 'Supporting Evidence Reference (Optional URL or File ID)'}
              </label>
              <input
                type="text"
                value={appealEvidence}
                onChange={(e) => setAppealEvidence(e.target.value)}
                placeholder={lang === 'hi' ? 'उदा. https://... या फ़ोटो सत्यापन आईडी' : 'e.g. https://... or photo verification ID'}
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
                {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={submittingAppeal || appealExplanation.trim().length < 10}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-sm transition disabled:opacity-50"
              >
                {submittingAppeal ? (lang === 'hi' ? 'अपील प्रस्तुत हो रही है...' : 'Submitting Appeal...') : (lang === 'hi' ? 'अपील सबमिट करें' : 'Submit Appeal')}
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
              {lang === 'hi' ? 'नियंत्रित शिकायत पुनः खोलने का डेस्क' : 'Controlled Grievance Reopening Desk'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800">
              {lang === 'hi' ? 'पुनः जाँच याचिकाएँ' : 'Re-Investigation Petitions'}
            </span>
            {(!isOfficerMode || (user && user.id === complaint.citizenId)) &&
              (complaint.status === 'RESOLVED' || complaint.status === 'CLOSED') &&
              complaint.status !== 'REOPENED' && (
                <button
                  type="button"
                  onClick={() => setShowReopeningForm(!showReopeningForm)}
                  className="text-xs px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold transition"
                >
                  {showReopeningForm ? (lang === 'hi' ? 'अनुरोध रद्द करें' : 'Cancel Request') : (lang === 'hi' ? 'पुनः खोलने का अनुरोध करें' : 'Request Reopening')}
                </button>
              )}
          </div>
        </div>

        {/* Existing Reopening Requests */}
        {reopeningsLoading ? (
          <div className="p-4 text-center text-slate-500 text-xs">
            <RefreshCw size={14} className="animate-spin inline mr-1 text-rose-600" />
            {lang === 'hi' ? 'पुनः खोलने का इतिहास लोड हो रहा है...' : 'Loading reopening history...'}
          </div>
        ) : reopeningLoadError ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            {lang === 'hi' ? `इस समय इतिहास लोड करने में असमर्थ (${reopeningLoadError})।` : `Unable to load reopening history at this time (${reopeningLoadError}).`}
          </div>
        ) : reopeningsList.length > 0 ? (
          <div className="space-y-3">
            {reopeningsList.map((req) => (
              <div key={req.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-rose-700">
                      #{req.referenceNumber || req.id}
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
                    {req.status === 'APPROVED' ? (lang === 'hi' ? 'स्वीकृत' : 'APPROVED') : req.status === 'REJECTED' ? (lang === 'hi' ? 'अस्वीकृत' : 'REJECTED') : (lang === 'hi' ? 'प्रतीक्षारत' : req.status)}
                  </span>
                </div>

                <p className="text-slate-800 italic bg-white p-2.5 rounded-lg border border-slate-100">
                  "{req.citizenExplanation || req.explanation}"
                </p>

                {req.decision && (
                  <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-[11px] space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>{lang === 'hi' ? 'पर्यवेक्षक निर्णय:' : 'Supervisor Verdict:'} {typeof req.decision === 'object' ? req.decision.outcome : req.decision}</span>
                      <span>{lang === 'hi' ? 'निर्णय तिथि:' : 'Decided:'} {new Date(req.decision?.decidedAt || req.decidedAt || req.updatedAt).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN')}</span>
                    </div>
                    {(req.decision?.reason || req.decisionReason) && (
                      <p className="text-slate-700">
                        {lang === 'hi' ? 'कारण:' : 'Reason:'} {req.decisionReason || req.decision?.reason}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">{lang === 'hi' ? 'इस शिकायत हेतु कोई पुनः खोलने की याचिका नहीं है।' : 'No reopening petitions filed for this grievance.'}</p>
        )}

        {/* Reopening Petition Form */}
        {showReopeningForm && (
          <form onSubmit={handleReopeningSubmit} className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl space-y-3 text-xs">
            <h3 className="font-bold text-rose-900 text-xs">
              {lang === 'hi' ? 'शिकायत पुनः खोलने की याचिका दर्ज करें' : 'Lodge Grievance Reopening Petition'}
            </h3>
            <p className="text-[11px] text-rose-800">
              {lang === 'hi'
                ? 'यदि समस्या जमीनी स्तर पर अभी भी बनी हुई है या मरम्मत विफल रही है, तो आधिकारिक रूप से पुनः खोलने हेतु याचिका दें। स्वीकृत अनुरोध स्थिति को REOPENED पर रीसेट करता है।'
                : 'Petition for official case reopening if the issue persists on the ground or physical repair failed. An approved request resets the case status to REOPENED and requires departmental remediation.'}
            </p>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {lang === 'hi' ? 'पुनः खोलने का कारण श्रेणी *' : 'Reopening Reason Category *'}
              </label>
              <select
                value={reopeningReasonCategory}
                onChange={(e) => setReopeningReasonCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="ISSUE_PERSISTS">{lang === 'hi' ? 'जमीनी स्तर पर समस्या अभी भी जारी है' : 'Issue Still Persists On Ground'}</option>
                <option value="RECURRING_FAILURE">{lang === 'hi' ? 'बार-बार होने वाला दोष / विफलता' : 'Recurring Defect / Failure'}</option>
                <option value="INCOMPLETE_REMEDIATION">{lang === 'hi' ? 'अधूरा निवारण' : 'Incomplete Remediation'}</option>
                <option value="EVIDENCE_UNVERIFIABLE">{lang === 'hi' ? 'साक्ष्य असत्यापनीय / झूठा' : 'Evidence Unverifiable / False'}</option>
                <option value="SAFETY_HAZARD_REMAINS">{lang === 'hi' ? 'सार्वजनिक सुरक्षा खतरा बना हुआ है' : 'Public Safety Hazard Remains'}</option>
                <option value="OTHER">{lang === 'hi' ? 'अन्य कारण' : 'Other Reason'}</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {lang === 'hi' ? 'नागरिक विवरण * (न्यूनतम 10 वर्ण)' : 'Citizen Explanation * (Min 10 characters)'}
              </label>
              <textarea
                required
                rows={3}
                value={reopeningExplanation}
                onChange={(e) => setReopeningExplanation(e.target.value)}
                placeholder={lang === 'hi' ? 'स्पष्ट रूप से बताएं कि शिकायत क्यों पुनः खोली जानी चाहिए और क्या अनसुलझा रह गया है...' : 'State clearly why the grievance must be reopened and what remains unresolved...'}
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
                {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={submittingReopening || reopeningExplanation.trim().length < 10}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-sm transition disabled:opacity-50"
              >
                {submittingReopening ? (lang === 'hi' ? 'याचिका दर्ज हो रही है...' : 'Lodging Petition...') : (lang === 'hi' ? 'पुनः खोलने की याचिका सबमिट करें' : 'Submit Reopening Petition')}
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
                {lang === 'hi' ? 'अधिकारी निर्णय एवं निवारण नियंत्रण' : 'Officer Decision & Redressal Controls'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
                {lang === 'hi' ? 'अधिकृत ट्राइएज डेस्क' : 'Authorized Triage Desk'}
              </span>
              <button
                type="button"
                onClick={() => setShowFlagModal(true)}
                className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold transition shadow-xs"
                title={lang === 'hi' ? 'धोखाधड़ी, दुरुपयोग या स्पैम समीक्षा हेतु शिकायत चिह्नित करें' : 'Flag complaint for fraud, abuse, or spam review'}
              >
                <Flag size={13} className="text-amber-700" />
                <span>{lang === 'hi' ? 'समीक्षा हेतु चिह्नित करें' : 'Flag for Review'}</span>
              </button>
            </div>
          </div>

          {/* Phase 6: AI Complaint Intelligence & Decision Support Cockpit */}
          <div className="p-5 bg-gradient-to-br from-slate-50 to-blue-50/50 rounded-xl border border-blue-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  {lang === 'hi' ? 'एआई शिकायत इंटेलिजेंस एवं निर्णय सहायता' : 'AI Complaint Intelligence & Decision Support'}
                </h3>
              </div>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold self-start sm:self-auto">
                {lang === 'hi' ? 'सहायक परामर्श (निर्धारक v1)' : 'Assistive Advisory (Deterministic v1)'}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Card 1: Intelligent Classification */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2.5 text-xs">
                <span className="font-bold text-slate-700 uppercase tracking-wider block text-[11px]">
                  {lang === 'hi' ? 'वर्गीकरण एवं रूटिंग' : 'Classification & Routing'}
                </span>
                <div>
                  <span className="text-slate-500">{lang === 'hi' ? 'अनुशंसित श्रेणी:' : 'Recommended Category:'}</span>
                  <div className="font-bold text-slate-900 capitalize text-sm">
                    {tCategory(complaint.intelligence?.classification?.category || complaint.category)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">{lang === 'hi' ? 'अनुशंसित विभाग:' : 'Recommended Department:'}</span>
                  <div className="font-semibold text-slate-800">
                    {tDepartment(complaint.intelligence?.classification?.departmentName || complaint.departmentId || complaint.department)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">{lang === 'hi' ? 'विश्वास स्तर:' : 'Confidence:'}</span>
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                    {Math.round((complaint.intelligence?.classification?.confidence || 0.8) * 100)}%
                  </span>
                </div>
                {complaint.intelligence?.classification?.explanation && (
                  <p className="text-[11px] text-slate-600 italic pt-1 border-t border-slate-100">
                    {lang === 'hi' ? 'तर्क:' : 'Rationale:'} {complaint.intelligence.classification.explanation}
                  </p>
                )}
              </div>

              {/* Card 2: Explainable Priority Recommendation & Officer Action */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 uppercase tracking-wider block text-[11px]">
                    {lang === 'hi' ? 'प्राथमिकता अनुशंसा' : 'Priority Recommendation'}
                  </span>
                  <PriorityBadge priority={complaint.intelligence?.priorityRecommendation?.priority || 'MEDIUM'} />
                </div>

                {complaint.intelligence?.priorityRecommendation?.publicSafetyHazard && (
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] font-semibold flex items-center gap-1.5">
                    <AlertTriangle size={14} className="shrink-0 text-rose-600" />
                    <span>{lang === 'hi' ? 'शिकायत विवरण में सार्वजनिक सुरक्षा खतरा चिह्नित' : 'Public Safety Hazard Flagged in Complaint Narrative'}</span>
                  </div>
                )}

                <div>
                  <span className="text-slate-500 block mb-1">{lang === 'hi' ? 'तर्क संकेत:' : 'Reasoning Signals:'}</span>
                  <ul className="space-y-1 text-[11px] text-slate-700">
                    {(complaint.intelligence?.priorityRecommendation?.reasons || [
                      lang === 'hi' ? 'मानक श्रेणी आधार रेखा प्राथमिकता निर्धारित।' : 'Assigned standard category baseline priority.'
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
                      <option value="CRITICAL">{lang === 'hi' ? 'गंभीर (CRITICAL)' : 'Set CRITICAL'}</option>
                      <option value="HIGH">{lang === 'hi' ? 'उच्च (HIGH)' : 'Set HIGH'}</option>
                      <option value="MEDIUM">{lang === 'hi' ? 'मध्यम (MEDIUM)' : 'Set MEDIUM'}</option>
                      <option value="LOW">{lang === 'hi' ? 'कम (LOW)' : 'Set LOW'}</option>
                    </select>
                    <button
                      type="submit"
                      disabled={priorityUpdating || newPriority === complaint.priority}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow transition disabled:opacity-50"
                    >
                      {priorityUpdating ? (lang === 'hi' ? 'सहेजा जा रहा है...' : 'Saving...') : (lang === 'hi' ? 'प्राथमिकता लागू करें' : 'Apply Priority')}
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder={lang === 'hi' ? 'प्राथमिकता परिवर्तन का तर्क (उदा. स्थल पर सत्यापित)...' : 'Override rationale (e.g. verified on site)...'}
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
                    {lang === 'hi' ? 'समान शिकायत पहचान' : 'Duplicate Detection'}
                  </span>
                  {complaint.duplicateOf && (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold text-[10px]">
                      {lang === 'hi' ? `संबंधित #${complaint.duplicateOf}` : `Linked to #${complaint.duplicateOf}`}
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
                      {lang === 'hi' ? `इस क्षेत्राधिकार में ${duplicates.length} समान शिकायतें मिलीं:` : `Found ${duplicates.length} similar complaints in this jurisdiction:`}
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
                            {Math.round(dup.matchScore * 100)}% {lang === 'hi' ? 'समानता' : 'Match'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-800 line-clamp-1 font-medium">
                          {dup.title}
                        </p>
                        {dup.signals && (
                          <p className="text-[10px] text-slate-500">
                            {lang === 'hi' ? 'संकेत:' : 'Signals:'} {dup.signals.join(', ')}
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
                              {linkingDuplicate ? (lang === 'hi' ? 'लिंक हो रहा है...' : 'Linking...') : (lang === 'hi' ? 'डुप्लिकेट के रूप में लिंक करें' : 'Link as Duplicate')}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-lg text-slate-500 text-[11px] italic text-center">
                    {lang === 'hi' ? 'इस क्षेत्राधिकार और समय सीमा में कोई समान शिकायत नहीं मिली।' : 'No matching duplicate grievances detected in this jurisdiction and time window.'}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status Transition Control */}
            <form onSubmit={handleStatusUpdate} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block">
                {lang === 'hi' ? 'शिकायत स्थिति अद्यतन करें' : 'Update Grievance Status'}
              </span>
              {statusMessage && (
                <div className={`p-2.5 rounded-lg text-xs ${statusMessage.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {statusMessage.text}
                </div>
              )}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">{lang === 'hi' ? 'लक्षित स्थिति *' : 'Target Status *'}</label>
                <select
                  required
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">{lang === 'hi' ? 'स्थिति चयन करें...' : 'Select status transition...'}</option>
                  {STATUS_OPTIONS.map((st) => (
                    <option key={st} value={st}>{tStatus(st)} ({st})</option>
                  ))}
                </select>
              </div>

              {(newStatus === 'RESOLVED' || newStatus === 'CLOSED') && (
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldCheck size={14} className="text-blue-700" />
                    <span>{lang === 'hi' ? 'निवारण गुणवत्ता सत्यापन आवश्यक' : 'Resolution Quality Verification Required'}</span>
                  </div>
                  <p className="text-[11px] text-blue-800 leading-snug">
                    {lang === 'hi'
                      ? `स्थिति को ${tStatus(newStatus)} पर ले जाने के लिए सत्यापन मानदंड लागू होंगे: सत्यापित परिणाम प्रकार, निरीक्षण पद्धति, निवारण टिप्पणियाँ (≥25 वर्ण), और समर्थक साक्ष्य।`
                      : `Transitioning to ${newStatus} enforces verifiable checklist criteria: verified outcome type, inspection method, remediation remarks (≥25 chars), and supporting evidence or supervisory exception.`}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">{lang === 'hi' ? 'कार्रवाई टिप्पणियाँ' : 'Action Remarks'}</label>
                <input
                  type="text"
                  placeholder={lang === 'hi' ? 'उदा. स्थल निरीक्षण संपन्न, संवेदक नियुक्त किया गया...' : 'e.g. Field inspection completed, contractor engaged...'}
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
                  ? (lang === 'hi' ? 'स्थिति अद्यतन हो रही है...' : 'Updating Status...')
                  : newStatus === 'RESOLVED' || newStatus === 'CLOSED'
                  ? (lang === 'hi' ? `सत्यापित करें एवं शिकायत निवारित करें (${tStatus(newStatus)}) →` : `Verify & Resolve Grievance (${newStatus}) →`)
                  : (lang === 'hi' ? 'स्थिति परिवर्तन लागू करें' : 'Apply Status Transition')}
              </button>
            </form>

            {/* Department Reassignment Control (Admin Gated) */}
            {isAdmin ? (
              <form onSubmit={handleDepartmentReassign} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block">
                    {lang === 'hi' ? 'विभाग पुनः आबंटित करें' : 'Reassign Department'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                    {lang === 'hi' ? 'व्यवस्थापक विशेषाधिकार' : 'Admin Privilege'}
                  </span>
                </div>
                {reassignMessage && (
                  <div className={`p-2.5 rounded-lg text-xs ${reassignMessage.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {reassignMessage.text}
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">{lang === 'hi' ? 'लक्षित विभाग *' : 'Target Department *'}</label>
                  <select
                    required
                    value={reassignDeptId}
                    onChange={(e) => setReassignDeptId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{tDepartment(d.name)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">{lang === 'hi' ? 'पुनः आबंटन का कारण' : 'Reassignment Rationale'}</label>
                  <input
                    type="text"
                    placeholder={lang === 'hi' ? 'उदा. क्षेत्राधिकार जल निकासी प्रभाग के अंतर्गत आता है...' : 'e.g. Jurisdiction falls under municipal drainage division...'}
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
                  {reassigning ? (lang === 'hi' ? 'पुनः आबंटित हो रहा है...' : 'Reassigning...') : (lang === 'hi' ? 'शिकायत पुनः आबंटित करें' : 'Reassign Grievance')}
                </button>
              </form>
            ) : (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <span className="font-bold text-slate-800 flex items-center gap-1.5 text-[11px]">
                  <Lock size={12} className="text-slate-500" />
                  {lang === 'hi' ? 'विभाग पुनः आबंटन' : 'Department Reassignment'}
                </span>
                <p className="text-[11px] text-slate-500">
                  {lang === 'hi'
                    ? 'विभागीय पिंग-पॉन्ग बाउंस रोकने के लिए क्रॉस-विभाग पुनः आबंटन हेतु सिस्टम एडमिनिस्ट्रेटर की आवश्यकता होती है।'
                    : 'Cross-department reassignment requires System Administrator privileges to prevent departmental loop bounces.'}
                </p>
              </div>
            )}
          </div>

          {/* Internal Officer Notes Section */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <MessageSquare size={14} className="text-blue-600" />
                {lang === 'hi' ? `आंतरिक अधिकारी समीक्षा टिप्पणियाँ (${complaint.officerNotes?.length || 0})` : `Internal Officer Review Notes (${complaint.officerNotes?.length || 0})`}
              </span>
              <span className="text-[11px] text-slate-400">{lang === 'hi' ? 'नागरिक दृश्य में दृश्यमान नहीं' : 'Not visible to citizen view'}</span>
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
                placeholder={lang === 'hi' ? 'गोपनीय आंतरिक अधिकारी टिप्पणी जोड़ें (उदा. निविदा जारी, सामग्री सोमवार को पहुंचेगी)...' : 'Add confidential internal officer note (e.g. tender issued, equipment arriving on Monday)...'}
                value={officerNote}
                onChange={(e) => setOfficerNote(e.target.value)}
                className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="submit"
                disabled={savingNote || !officerNote.trim()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow transition disabled:opacity-50"
              >
                {savingNote ? (lang === 'hi' ? 'जोड़ा जा रहा है...' : 'Adding...') : (lang === 'hi' ? 'नोट दर्ज करें' : 'Log Note')}
              </button>
            </form>

            {/* List of existing notes */}
            {complaint.officerNotes && complaint.officerNotes.length > 0 ? (
              <div className="space-y-2 pt-2">
                {complaint.officerNotes.map((n, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-600">{n.officerId || (lang === 'hi' ? 'अधिकारी' : 'OFFICER')}</span>
                      <span>{new Date(n.timestamp).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN')}</span>
                    </div>
                    <p>{n.note}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">{lang === 'hi' ? 'अभी तक कोई आंतरिक नोट नहीं जोड़ा गया है।' : 'No internal notes added yet.'}</p>
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
                    {lang === 'hi' ? 'निवारण गुणवत्ता सत्यापन डेस्क' : 'Resolution Quality Verification Desk'}
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800">
                    {lang === 'hi' ? `लक्षित स्थिति: ${tStatus(resolutionTargetStatus)}` : `Target: ${resolutionTargetStatus}`}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {lang === 'hi' ? 'शिकायत बंद करने से पहले अनिवार्य वस्तुनिष्ठ, सत्यापन योग्य निवारण मानक' : 'Objective, verifiable resolution standards required before grievance closure'}
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
                <span className="text-slate-500 block text-[10px]">{lang === 'hi' ? 'मामला आईडी' : 'Case ID'}</span>
                <span className="font-mono font-bold text-slate-800">#{complaint.referenceNumber || complaint.id}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">{lang === 'hi' ? 'श्रेणी' : 'Category'}</span>
                <span className="font-bold text-slate-800 capitalize">{tCategory(complaint.category)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">{lang === 'hi' ? 'विभाग' : 'Department'}</span>
                <span className="font-bold text-slate-800">{tDepartment(complaint.departmentId || complaint.department)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">{lang === 'hi' ? 'अधिकृत पद' : 'Role Authorized'}</span>
                <span className="font-bold text-slate-800 capitalize">{user?.role || (lang === 'hi' ? 'अधिकारी' : 'Officer')}</span>
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
                    <span>{lang === 'hi' ? `विभागीय निवारण नीति: ${tCategory(complaint.category)}` : `Department Resolution Policy: ${complaint.category}`}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] ${catPolicy.requiresEvidence ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-200 text-slate-700'}`}>
                      {catPolicy.requiresEvidence ? (lang === 'hi' ? 'मरम्मत हेतु साक्ष्य अनिवार्य' : 'Evidence Mandatory for Repair') : (lang === 'hi' ? 'साक्ष्य वैकल्पिक' : 'Evidence Optional')}
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
                <span>{lang === 'hi' ? 'मानक सत्यापित निवारण' : 'Standard Verified Resolution'}</span>
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
                <span>{lang === 'hi' ? 'पर्यवेक्षी प्रक्रियात्मक छूट' : 'Supervisory Procedural Exception'}</span>
              </button>
            </div>

            <form onSubmit={handleSubmitResolution} className="space-y-4">
              {!isException ? (
                <>
                  {/* Field 1: Outcome Type */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {lang === 'hi' ? 'निवारण परिणाम प्रकार *' : 'Remediation Outcome Type *'}
                    </label>
                    <select
                      value={outcomeType}
                      onChange={(e) => setOutcomeType(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {RESOLUTION_OUTCOME_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {formatOutcomeType(opt.value, lang)}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1 italic">
                      {RESOLUTION_OUTCOME_OPTIONS.find((o) => o.value === outcomeType)?.description}
                    </p>
                    {(outcomeType === 'NO_DEFECT_FOUND' || outcomeType === 'REFERRED_EXTERNAL') && (
                      <p className="text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200 mt-1.5 font-medium">
                        {lang === 'hi' ? `✓ इस गैर-मरम्मत परिणाम (${outcomeType}) के लिए भौतिक साक्ष्य की आवश्यकता से छूट दी गई है।` : `✓ Supporting physical evidence is waived for this non-repair outcome (${outcomeType}).`}
                      </p>
                    )}
                  </div>

                  {/* Field 2: Verification Method */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {lang === 'hi' ? 'परिणाम सत्यापन पद्धति *' : 'Outcome Verification Method *'}
                    </label>
                    <select
                      value={verificationMethod}
                      onChange={(e) => setVerificationMethod(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {VERIFICATION_METHOD_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {formatVerificationMethod(opt.value, lang)}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1 italic">
                      {VERIFICATION_METHOD_OPTIONS.find((m) => m.value === verificationMethod)?.description}
                    </p>
                  </div>

                  {/* Feature C: Historical Resolution Suggestions */}
                  <HistoricalResolutionSuggestions
                    complaintId={complaint.id}
                    onApplyTemplate={(summary) => setClosureRemarks(summary)}
                  />

                  {/* Field 3: Closure Remarks */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">
                        {lang === 'hi' ? 'सार्थक समापन टिप्पणियाँ * (न्यूनतम 25 वर्ण)' : 'Meaningful Closure Remarks * (Min 25 chars)'}
                      </label>
                      <span className={`text-[11px] font-mono font-semibold ${closureRemarks.trim().length >= 25 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {closureRemarks.trim().length} / 25 {lang === 'hi' ? 'न्यूनतम' : 'min'}
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      required
                      value={closureRemarks}
                      onChange={(e) => setClosureRemarks(e.target.value)}
                      placeholder={lang === 'hi' ? 'निष्पादित किए गए विशिष्ट सुधारात्मक कदमों, पूर्ण की गई मरम्मत या निरीक्षण निष्कर्षों का विवरण दें (कम से कम 25 वर्ण)...' : 'Explain specific remediation steps executed, repairs completed, or inspection findings (minimum 25 characters)...'}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <div className="flex items-center justify-between text-[11px] mt-1">
                      <span className={closureRemarks.trim().length >= 25 ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                        {closureRemarks.trim().length >= 25
                          ? (lang === 'hi' ? '✓ न्यूनतम वर्ण आवश्यकता पूर्ण हुई' : '✓ Minimum character requirement met')
                          : (lang === 'hi' ? `⚠️ कम से कम ${Math.max(0, 25 - closureRemarks.trim().length)} और वर्ण आवश्यक हैं` : `⚠️ Need at least ${Math.max(0, 25 - closureRemarks.trim().length)} more characters`)}
                      </span>
                    </div>
                  </div>

                  {/* Field 4: Evidence References */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700">
                        {lang === 'hi' ? 'समर्थक साक्ष्य संदर्भ' : 'Supporting Evidence References'}
                      </label>
                      <span className="text-[11px] text-slate-500">
                        {evidenceList.length} {lang === 'hi' ? 'संलग्न' : 'attached'}
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
                      <p className="text-[11px] text-slate-400 italic">{lang === 'hi' ? 'अभी तक कोई साक्ष्य संदर्भ नहीं जोड़ा गया है।' : 'No evidence references added yet.'}</p>
                    )}

                    {/* Add reference input */}
                    <div className="space-y-1.5">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newEvidenceRef}
                          onChange={(e) => setNewEvidenceRef(e.target.value)}
                          placeholder={lang === 'hi' ? 'संदर्भ ट्रैकिंग स्ट्रिंग (उदा. PHOTO-2026-001, WO-98214)...' : 'Reference tracking string (e.g. PHOTO-2026-001, WO-98214)...'}
                          className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleAddEvidenceRef}
                          disabled={!newEvidenceRef.trim()}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1"
                        >
                          <Plus size={13} />
                          <span>{lang === 'hi' ? 'जोड़ें' : 'Attach'}</span>
                        </button>
                      </div>

                      {/* Quick suggestions */}
                      <div className="flex flex-wrap gap-1.5 text-[10px]">
                        <span className="text-slate-500 self-center">{lang === 'hi' ? 'प्रीसेट:' : 'Prefix presets:'}</span>
                        <button
                          type="button"
                          onClick={() => setNewEvidenceRef('PHOTO-SITE-CLEARED-')}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 text-slate-700"
                        >
                          + {lang === 'hi' ? 'फोटो संदर्भ' : 'Photo Ref'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewEvidenceRef('WO-REPAIR-')}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 text-slate-700"
                        >
                          + {lang === 'hi' ? 'कार्य आदेश' : 'Work Order'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewEvidenceRef('INSP-REP-')}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 text-slate-700"
                        >
                          + {lang === 'hi' ? 'निरीक्षण रिपोर्ट' : 'Inspection Report'}
                        </button>
                      </div>

                      {/* Unsafe path alert */}
                      {newEvidenceRef.trim().length > 0 && !isSafeEvidenceReference(newEvidenceRef.trim()) && (
                        <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                          <AlertCircle size={12} />
                          <span>{lang === 'hi' ? 'असुरक्षित संदर्भ सिंटैक्स पहचाना गया! स्थानीय फाइल सिस्टम पाथ सख्त वर्जित हैं।' : 'Unsafe reference syntax detected! Local filesystem paths and traversals are strictly prohibited.'}</span>
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
                        <span className="font-bold">{lang === 'hi' ? 'पर्यवेक्षी व्यवस्थापक विशेषाधिकार सक्रिय: ' : 'Supervisory Administrator Privilege Active: '}</span>
                        <span>{lang === 'hi' ? 'आपके पास पर्यवेक्षी प्रक्रियात्मक छूट का मूल्यांकन और अनुमोदन करने के व्यवस्थापकीय क्रेडेंशियल हैं।' : 'You have administrative credentials to evaluate and approve supervisory procedural exceptions.'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-start gap-2">
                      <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">{lang === 'hi' ? 'भूमिका-आधारित प्राधिकरण सूचना: ' : 'Role-Based Authorization Notice: '}</span>
                        <span>
                          {lang === 'hi'
                            ? 'आप अधिकारी (गैर-व्यवस्थापक) के रूप में लॉग इन हैं। सामान्य प्रक्रियात्मक छूट के लिए व्यवस्थापक प्राधिकरण की आवश्यकता होती है।'
                            : 'You are logged in as Officer (non-admin). General procedural exceptions require Administrator authorization. The backend will reject unauthorized exceptions with 403 Forbidden unless this complaint is an incident duplicate cascade.'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Exception Reason */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {lang === 'hi' ? 'छूट कारण कोड *' : 'Exception Reason Code *'}
                    </label>
                    <select
                      value={exceptionReason}
                      onChange={(e) => setExceptionReason(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
                    >
                      {Object.values(RESOLUTION_EXCEPTION_REASONS).map((r) => (
                        <option key={r.code} value={r.code}>
                          {formatExceptionReason(r.code, lang)} ({r.code})
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
                        {lang === 'hi' ? 'छूट का औचित्य * (न्यूनतम 25 वर्ण)' : 'Exception Justification * (Min 25 chars)'}
                      </label>
                      <span className={`text-[11px] font-mono font-semibold ${exceptionJustification.trim().length >= 25 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {exceptionJustification.trim().length} / 25 {lang === 'hi' ? 'न्यूनतम' : 'min'}
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      required
                      value={exceptionJustification}
                      onChange={(e) => setExceptionJustification(e.target.value)}
                      placeholder={lang === 'hi' ? 'बताएं कि मानक निवारण क्यों पूर्ण नहीं हो सका और प्रशासनिक छूट कानूनी या परिचालन रूप से क्यों उचित है...' : 'Explain why standard remediation could not be completed and why an administrative exception is legally or operationally justified...'}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                    <div className="flex items-center justify-between text-[11px] mt-1">
                      <span className={exceptionJustification.trim().length >= 25 ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                        {exceptionJustification.trim().length >= 25
                          ? (lang === 'hi' ? '✓ न्यूनतम वर्ण आवश्यकता पूर्ण हुई' : '✓ Minimum character requirement met')
                          : (lang === 'hi' ? `⚠️ कम से कम ${Math.max(0, 25 - exceptionJustification.trim().length)} और वर्ण आवश्यक हैं` : `⚠️ Need at least ${Math.max(0, 25 - exceptionJustification.trim().length)} more characters`)}
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
                        {lang === 'hi' ? 'स्कोर:' : 'Score:'} {resolutionScore}/100
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
                        {lang === 'hi' ? 'पहचानी गई अनुपलब्ध आवश्यकताएँ:' : 'Missing Requirements Identified:'}
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
                        {lang === 'hi' ? 'प्रक्रियात्मक चेकलिस्ट विवरण:' : 'Procedural Checklist Breakdown:'}
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
                  {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={resolutionSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow transition disabled:opacity-50 flex items-center gap-2"
                >
                  {resolutionSubmitting && <RefreshCw size={13} className="animate-spin" />}
                  <span>{resolutionSubmitting ? (lang === 'hi' ? 'सत्यापन हो रहा है...' : 'Validating Resolution...') : (lang === 'hi' ? `सत्यापित करें एवं पुष्टि करें (${tStatus(resolutionTargetStatus)})` : `Validate & Confirm ${resolutionTargetStatus}`)}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANUAL SPAM / ABUSE REVIEW MODAL (Problem C) */}
      {showFlagModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <Flag size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {lang === 'hi' ? 'स्पैम / धोखाधड़ी समीक्षा हेतु चिह्नित करें' : 'Flag Grievance for Spam / Fraud Review'}
                  </h3>
                  <p className="text-[11px] text-slate-600">
                    {lang === 'hi' ? 'लक्षित संदर्भ:' : 'Target Reference:'} <span className="font-mono font-bold text-amber-900">#{complaint.referenceNumber || complaint.id}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowFlagModal(false);
                  setFlagMessage(null);
                }}
                disabled={flagging}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFlagComplaint} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-900 space-y-1">
                <span className="font-bold block flex items-center gap-1.5 text-[11px]">
                  <ShieldAlert size={14} className="text-amber-700" />
                  {lang === 'hi' ? 'उत्तरदायी मानवीय समीक्षा' : 'Responsible Human-in-the-Loop Review'}
                </span>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  {lang === 'hi'
                    ? 'इस शिकायत को चिह्नित करने से यह पूर्ण टेलीमेट्री के साथ स्पैम समीक्षा डेस्क पर जोड़ दी जाती है। शिकायत हटाई या खारिज नहीं की जाती; नागरिक अधिकार और ऑडिट ट्रेल सुरक्षित रहते हैं।'
                    : 'Flagging this grievance adds it to the Spam Review Desk queue with full telemetry for supervisory evaluation. The complaint is not rejected or deleted; citizen rights and audit trails are strictly preserved.'}
                </p>
              </div>

              {flagMessage && (
                <div className={`p-3 rounded-xl text-xs ${
                  flagMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {flagMessage.text}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'hi' ? 'चिह्नित करने का कारण *' : 'Reason for Flagging *'}
                </label>
                <select
                  value={flagReasonCode}
                  onChange={(e) => setFlagReasonCode(e.target.value)}
                  disabled={flagging}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                >
                  <option value="SUSPICIOUS_CONTENT">{lang === 'hi' ? 'संदेहास्पद या विरोधाभासी शिकायत विवरण' : 'Suspicious or Contradictory Grievance Details'}</option>
                  <option value="DUPLICATE_TEXT_EXACT">{lang === 'hi' ? 'समान दोहराया गया विवरण पैटर्न' : 'Identical Repeated Narrative Pattern'}</option>
                  <option value="GIBBERISH_NONSENSE_DETECTED">{lang === 'hi' ? 'निरर्थक या अबोधगम्य सामग्री' : 'Nonsensical or Incomprehensible Content'}</option>
                  <option value="BURST_FREQUENCY">{lang === 'hi' ? 'असामान्य प्रविष्टि आवृत्ति / स्वचालन' : 'Abnormal Submission Frequency / Automation'}</option>
                  <option value="OTHER">{lang === 'hi' ? 'अन्य प्रशासनिक जांच आवश्यक' : 'Other Administrative Screening Required'}</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'hi' ? 'अधिकारी स्पष्टीकरण एवं साक्ष्य टिप्पणियाँ * (न्यूनतम 10 वर्ण)' : 'Officer Explanation & Evidence Notes * (Min 10 characters)'}
                </label>
                <textarea
                  required
                  rows={4}
                  value={flagNotes}
                  onChange={(e) => setFlagNotes(e.target.value)}
                  disabled={flagging}
                  placeholder={lang === 'hi' ? 'समीक्षा हेतु चिह्नित करने का तथ्यात्मक आधार बताएं (उदा. कई वार्ड फाइलों में समान शब्दावली देखी गई)...' : 'State the factual basis for flagging this complaint for review (e.g. repeated identical wording observed across multiple ward filings)...'}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span>{lang === 'hi' ? 'न्यूनतम 10 वर्ण आवश्यक' : 'Minimum 10 characters required'}</span>
                  <span>{flagNotes.length} {lang === 'hi' ? 'वर्ण' : 'chars'}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowFlagModal(false);
                    setFlagMessage(null);
                  }}
                  disabled={flagging}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                >
                  {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={flagging || flagNotes.trim().length < 10}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow transition disabled:opacity-50 flex items-center gap-2"
                >
                  {flagging && <RefreshCw size={13} className="animate-spin" />}
                  <span>{flagging ? (lang === 'hi' ? 'चिह्नित किया जा रहा है...' : 'Submitting Flag...') : (lang === 'hi' ? 'पुष्टि करें एवं समीक्षा हेतु चिह्नित करें' : 'Confirm & Flag for Review')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
