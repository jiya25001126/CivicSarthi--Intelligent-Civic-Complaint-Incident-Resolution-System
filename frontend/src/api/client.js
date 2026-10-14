import axios from 'axios';

export function resolveApiBaseUrl(configuredUrl, isProd = false) {
  if (configuredUrl && typeof configuredUrl === 'string' && configuredUrl.trim() !== '') {
    return configuredUrl.trim().replace(/\/+$/, '');
  }
  return isProd ? '' : 'http://localhost:5000';
}

const envUrl = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_API_URL : undefined;
const isProduction = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.PROD : false;
const API_BASE_URL = resolveApiBaseUrl(envUrl, isProduction);

function getCookie(name) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 10000,
  withCredentials: true, // Enables HttpOnly session cookie transmission across requests
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to attach Authorization and CSRF token headers
api.interceptors.request.use((reqConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('civicsarthi_token');
    if (token) {
      if (typeof reqConfig.headers.set === 'function') {
        reqConfig.headers.set('Authorization', `Bearer ${token}`);
      } else {
        reqConfig.headers['Authorization'] = `Bearer ${token}`;
      }
    }
  }

  if (['post', 'put', 'patch', 'delete'].includes(reqConfig.method?.toLowerCase())) {
    let csrfToken = getCookie('civicsarthi_csrf');
    if (!csrfToken && typeof window !== 'undefined') {
      try {
        csrfToken = localStorage.getItem('civicsarthi_csrf');
      } catch {}
    }
    if (csrfToken) {
      if (typeof reqConfig.headers.set === 'function') {
        reqConfig.headers.set('x-csrf-token', csrfToken);
      } else {
        reqConfig.headers['x-csrf-token'] = csrfToken;
      }
    }
  }
  return reqConfig;
});

// Response interceptor for friendly error extraction
api.interceptors.response.use(
  (response) => response,
  (error) => {
    let errorMsg = 'An unexpected error occurred while communicating with the CivicSarthi server.';
    if (error.response?.data?.error) {
      errorMsg = error.response.data.error;
      if (Array.isArray(error.response.data.details)) {
        const details = error.response.data.details.map(d => `${d.path}: ${d.message}`).join(', ');
        errorMsg += ` (${details})`;
      }
    } else if (error.message) {
      errorMsg = error.message;
    }

    const customError = new Error(errorMsg);
    customError.status = error.response?.status;
    customError.response = error.response;
    return Promise.reject(customError);
  }
);

// ==========================================
// Authentication & Session Endpoints
// ==========================================

export async function fetchCsrfToken() {
  try {
    const res = await api.get('/auth/csrf');
    const csrf = res.data?.csrfToken || res.data?.data?.csrfToken;
    if (csrf && typeof window !== 'undefined') {
      try {
        localStorage.setItem('civicsarthi_csrf', csrf);
      } catch {}
    }
    return csrf;
  } catch (err) {
    console.warn('Failed to fetch CSRF token:', err.message);
    return null;
  }
}

export async function login({ email, password }) {
  const res = await api.post('/auth/login', { email, password });
  if (typeof window !== 'undefined') {
    try {
      if (res.data?.data?.token) {
        localStorage.setItem('civicsarthi_token', res.data.data.token);
      }
      const csrf = res.data?.data?.csrfToken || res.data?.csrfToken;
      if (csrf) {
        localStorage.setItem('civicsarthi_csrf', csrf);
      }
    } catch {}
  }
  return res.data;
}

export async function register({ email, password, name }) {
  const res = await api.post('/auth/register', { email, password, name });
  if (typeof window !== 'undefined') {
    try {
      if (res.data?.data?.token) {
        localStorage.setItem('civicsarthi_token', res.data.data.token);
      }
      const csrf = res.data?.data?.csrfToken || res.data?.csrfToken;
      if (csrf) {
        localStorage.setItem('civicsarthi_csrf', csrf);
      }
    } catch {}
  }
  return res.data;
}

export async function logout() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('civicsarthi_token');
      localStorage.removeItem('civicsarthi_csrf');
    } catch {}
  }
  const res = await api.post('/auth/logout');
  return res.data;
}

export async function fetchCurrentUser() {
  const res = await api.get('/auth/me');
  const csrf = res.data?.csrfToken || res.data?.data?.csrfToken;
  if (csrf && typeof window !== 'undefined') {
    try {
      localStorage.setItem('civicsarthi_csrf', csrf);
    } catch {}
  }
  return res.data;
}

// ==========================================
// Public Platform Endpoints
// ==========================================

export async function fetchHealth() {
  const res = await api.get('/health');
  return res.data;
}

export async function fetchDepartments() {
  const res = await api.get('/departments');
  return res.data;
}

export async function fetchComplaintStats() {
  const res = await api.get('/complaints/stats');
  return res.data;
}

/**
 * Public Tracking API: fetches sanitized lifecycle tracking without private contact details or officer notes.
 * No authentication required.
 */
export async function fetchComplaintTracking(referenceOrId) {
  try {
    const res = await api.get(`/complaints/track/${encodeURIComponent(referenceOrId)}`);
    return res.data;
  } catch (err) {
    // Fallback to legacy tracking route if needed
    if (err.status === 404 || err.response?.status === 404) {
      const fallbackRes = await api.get(`/complaints/${encodeURIComponent(referenceOrId)}/track`);
      return fallbackRes.data;
    }
    throw err;
  }
}

// ==========================================
// Authenticated Complaint Operations
// ==========================================

export async function fetchComplaints(params = {}) {
  const res = await api.get('/complaints', { params });
  return res.data;
}

export async function fetchMyComplaints(params = {}) {
  const res = await api.get('/complaints/my', { params });
  return res.data;
}

export async function fetchComplaintById(id) {
  const res = await api.get(`/complaints/${encodeURIComponent(id)}`);
  return res.data;
}

export async function createComplaint(payload, idempotencyKey = null) {
  const headers = {};
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }
  let csrf = getCookie('civicsarthi_csrf');
  if (!csrf && typeof window !== 'undefined') {
    try {
      csrf = localStorage.getItem('civicsarthi_csrf');
    } catch {}
  }
  if (!csrf) {
    csrf = await fetchCsrfToken();
  }
  if (csrf) {
    headers['x-csrf-token'] = csrf;
  }
  const res = await api.post('/complaints', payload, { headers });
  return res.data;
}

export async function updateComplaintStatus(id, payload) {
  const res = await api.patch(`/complaints/${encodeURIComponent(id)}/status`, payload);
  return res.data;
}

export async function reassignComplaintDepartment(id, { departmentId, remarks, actorType }) {
  const res = await api.patch(`/complaints/${encodeURIComponent(id)}/department`, {
    departmentId,
    remarks,
    actorType
  });
  return res.data;
}

export async function addOfficerNote(id, { note }) {
  const res = await api.post(`/complaints/${encodeURIComponent(id)}/notes`, {
    note
  });
  return res.data;
}

export async function fetchComplaintHistory(id) {
  const res = await api.get(`/complaints/${encodeURIComponent(id)}/history`);
  return res.data;
}

// ==========================================
// AI Complaint Intelligence Operations
// ==========================================

export async function analyzeGrievancePreview(payload) {
  const res = await api.post('/complaints/analyze', payload);
  return res.data;
}

export async function fetchComplaintIntelligence(id) {
  const res = await api.get(`/complaints/${encodeURIComponent(id)}/intelligence`);
  return res.data;
}

export async function fetchComplaintDuplicates(id) {
  const res = await api.get(`/complaints/${encodeURIComponent(id)}/duplicates`);
  return res.data;
}

export async function updateComplaintPriority(id, { priority, remarks }) {
  const res = await api.patch(`/complaints/${encodeURIComponent(id)}/priority`, {
    priority,
    remarks
  });
  return res.data;
}

export async function linkComplaintDuplicate(id, { duplicateOf, remarks }) {
  const res = await api.patch(`/complaints/${encodeURIComponent(id)}/duplicate`, {
    duplicateOf,
    remarks
  });
  return res.data;
}

// ==========================================
// Parent Incident Operations (Phase 7)
// ==========================================

export async function fetchIncidents(params = {}) {
  const res = await api.get('/incidents', { params });
  return res.data;
}

export async function fetchIncidentById(id) {
  const res = await api.get(`/incidents/${encodeURIComponent(id)}`);
  return res.data;
}

export async function createIncident(payload) {
  const res = await api.post('/incidents', payload);
  return res.data;
}

export async function updateIncidentStatus(id, payload) {
  const res = await api.patch(`/incidents/${encodeURIComponent(id)}/status`, payload);
  return res.data;
}

export async function linkComplaintToIncident(incidentId, { complaintId, remarks } = {}) {
  const res = await api.post(`/incidents/${encodeURIComponent(incidentId)}/complaints`, {
    complaintId,
    remarks
  });
  return res.data;
}

export async function unlinkComplaintFromIncident(incidentId, complaintId, { remarks } = {}) {
  const params = remarks ? { remarks } : {};
  const res = await api.delete(
    `/incidents/${encodeURIComponent(incidentId)}/complaints/${encodeURIComponent(complaintId)}`,
    { params }
  );
  return res.data;
}

export async function transferComplaintBetweenIncidents({ fromIncidentId, toIncidentId, complaintId, justification }) {
  const res = await api.post('/incidents/transfer-complaint', {
    fromIncidentId,
    toIncidentId,
    complaintId,
    justification
  });
  return res.data;
}

// ==========================================
// Multi-Department Subtask Operations (Phase 7)
// ==========================================

export async function fetchSubtasks(params = {}) {
  const res = await api.get('/subtasks', { params });
  return res.data;
}

export async function fetchIncidentSubtasks(incidentId, params = {}) {
  const res = await api.get(`/incidents/${encodeURIComponent(incidentId)}/subtasks`, { params });
  return res.data;
}

export async function createSubtask(payload) {
  const res = await api.post('/subtasks', payload);
  return res.data;
}

export async function getSubtaskById(id) {
  const res = await api.get(`/subtasks/${encodeURIComponent(id)}`);
  return res.data;
}

export async function updateSubtaskStatus(id, { status, remarks } = {}) {
  const res = await api.patch(`/subtasks/${encodeURIComponent(id)}/status`, {
    status,
    remarks
  });
  return res.data;
}

export async function updateSubtask(id, payload) {
  const res = await api.patch(`/subtasks/${encodeURIComponent(id)}`, payload);
  return res.data;
}

// ==========================================
// Administrative Operations (Admin only)
// ==========================================

export async function fetchAdminUsers(params = {}) {
  const res = await api.get('/admin/users', { params });
  return res.data;
}

export async function provisionAdminUser(payload) {
  const res = await api.post('/admin/users', payload);
  return res.data;
}

export async function fetchAdminAuditLogs(params = {}) {
  const res = await api.get('/admin/audit-logs', { params });
  return res.data;
}

// ==========================================
// Neglect Radar & Supervisory Monitoring (Phase 8)
// ==========================================

export async function fetchNeglectRadar(params = {}) {
  const res = await api.get('/neglect-radar', { params });
  return res.data;
}

export async function fetchNeglectRadarItem(entityType, id) {
  const res = await api.get(`/neglect-radar/${encodeURIComponent(entityType)}/${encodeURIComponent(id)}`);
  return res.data;
}

// ==========================================
// Phase 10: Feedback, Appeals & Controlled Reopening
// ==========================================

export async function submitComplaintFeedback(complaintId, payload) {
  const res = await api.post(`/complaints/${encodeURIComponent(complaintId)}/feedback`, payload);
  return res.data;
}

export async function getComplaintFeedback(complaintId) {
  const res = await api.get(`/complaints/${encodeURIComponent(complaintId)}/feedback`);
  return res.data;
}

export async function fetchMyFeedback() {
  const res = await api.get('/feedback/my');
  return res.data;
}

export async function fetchFeedbackSummary(departmentId) {
  const params = departmentId ? { departmentId } : {};
  const res = await api.get('/feedback/summary', { params });
  return res.data;
}

export async function submitComplaintAppeal(complaintId, payload) {
  const res = await api.post(`/complaints/${encodeURIComponent(complaintId)}/appeals`, payload);
  return res.data;
}

export async function fetchMyAppeals() {
  const res = await api.get('/appeals/my');
  return res.data;
}

export async function fetchAppeals(params = {}) {
  const res = await api.get('/appeals', { params });
  return res.data;
}

export async function fetchAppealById(appealId) {
  const res = await api.get(`/appeals/${encodeURIComponent(appealId)}`);
  return res.data;
}

export async function fetchAppealTracking(reference) {
  const res = await api.get(`/appeals/track/${encodeURIComponent(reference)}`);
  return res.data;
}

export async function updateAppealStatus(appealId, payload) {
  const res = await api.patch(`/appeals/${encodeURIComponent(appealId)}/status`, payload);
  return res.data;
}

export async function addAppealNote(appealId, payload) {
  const res = await api.post(`/appeals/${encodeURIComponent(appealId)}/notes`, payload);
  return res.data;
}

export async function recordAppealDecision(appealId, payload) {
  const res = await api.post(`/appeals/${encodeURIComponent(appealId)}/decision`, payload);
  return res.data;
}

export async function submitReopeningRequest(complaintId, payload) {
  const res = await api.post(`/complaints/${encodeURIComponent(complaintId)}/reopening-requests`, payload);
  return res.data;
}

export async function fetchComplaintReopenings(complaintId) {
  const res = await api.get(`/complaints/${encodeURIComponent(complaintId)}/reopening-requests`);
  return res.data;
}

export async function fetchMyReopeningRequests() {
  const res = await api.get('/reopening-requests/my');
  return res.data;
}

export async function fetchReopeningRequests(params = {}) {
  const res = await api.get('/reopening-requests', { params });
  return res.data;
}

export async function fetchReopeningRequestById(requestId) {
  const res = await api.get(`/reopening-requests/${encodeURIComponent(requestId)}`);
  return res.data;
}

export async function recordReopeningDecision(requestId, payload) {
  const res = await api.post(`/reopening-requests/${encodeURIComponent(requestId)}/decision`, payload);
  return res.data;
}

// ==========================================
// Phase 11: Spam/Fake Screening & Review Desk
// ==========================================

export async function fetchSpamReviews(params = {}) {
  const res = await api.get('/spam-reviews', { params });
  return res.data;
}

export async function fetchSpamReviewById(reviewId) {
  const res = await api.get(`/spam-reviews/${encodeURIComponent(reviewId)}`);
  return res.data;
}

export async function recordSpamReviewDecision(reviewId, payload) {
  const res = await api.post(`/spam-reviews/${encodeURIComponent(reviewId)}/decision`, payload);
  return res.data;
}

export async function fetchMyReputation() {
  const res = await api.get('/citizen/reputation');
  return res.data;
}

export async function fetchCitizenReputation(citizenId) {
  const res = await api.get(`/spam-reviews/citizens/${encodeURIComponent(citizenId)}/reputation`);
  return res.data;
}

// ==========================================
// Phase 12: Citizen Clarification, Reminders & Status Translator
// ==========================================

export async function submitComplaintClarification(complaintId, payload) {
  const res = await api.post(`/complaints/${encodeURIComponent(complaintId)}/clarifications`, payload);
  return res.data;
}

export async function fetchComplaintClarifications(complaintId) {
  const res = await api.get(`/complaints/${encodeURIComponent(complaintId)}/clarifications`);
  return res.data;
}

export async function fetchClarifications(params = {}) {
  const res = await api.get('/clarifications', { params });
  return res.data;
}

export async function fetchClarificationById(clarificationId) {
  const res = await api.get(`/clarifications/${encodeURIComponent(clarificationId)}`);
  return res.data;
}

export async function respondToClarification(clarificationId, payload) {
  const res = await api.post(`/clarifications/${encodeURIComponent(clarificationId)}/respond`, payload);
  return res.data;
}

export async function closeClarification(clarificationId, payload = {}) {
  const res = await api.post(`/clarifications/${encodeURIComponent(clarificationId)}/close`, payload);
  return res.data;
}

export async function requestComplaintReminder(complaintId) {
  const res = await api.post(`/complaints/${encodeURIComponent(complaintId)}/reminders`);
  return res.data;
}

export async function fetchComplaintReminderStatus(complaintId) {
  const res = await api.get(`/complaints/${encodeURIComponent(complaintId)}/reminders/eligibility`);
  return res.data;
}

export async function fetchComplaintReminders(complaintId) {
  const res = await api.get(`/complaints/${encodeURIComponent(complaintId)}/reminders`);
  return res.data;
}

export async function fetchComplaintStatusExplanation(complaintIdOrRef, params = {}) {
  const res = await api.get(`/complaints/${encodeURIComponent(complaintIdOrRef)}/status-explanation`, { params });
  return res.data;
}

// ==========================================
// Phase 13: Aggregate Analytics & Reporting Endpoints
// ==========================================

export async function fetchAnalyticsOverview(params = {}) {
  const res = await api.get('/analytics/overview', { params });
  return res.data;
}

export async function fetchAnalyticsTrends(params = {}) {
  const res = await api.get('/analytics/trends', { params });
  return res.data;
}

export async function fetchAnalyticsDepartments(params = {}) {
  const res = await api.get('/analytics/departments', { params });
  return res.data;
}

export async function fetchAnalyticsCategories(params = {}) {
  const res = await api.get('/analytics/categories', { params });
  return res.data;
}

export async function fetchAnalyticsWorkflow(params = {}) {
  const res = await api.get('/analytics/workflow', { params });
  return res.data;
}

export async function exportAnalyticsReport(params = {}) {
  const res = await api.get('/analytics/export', {
    params,
    responseType: 'blob'
  });
  return res;
}

export { API_BASE_URL };
export default api;
