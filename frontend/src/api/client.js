import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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

// Request interceptor to attach CSRF token header for state-modifying calls
api.interceptors.request.use((reqConfig) => {
  if (['post', 'put', 'patch', 'delete'].includes(reqConfig.method?.toLowerCase())) {
    const csrfToken = getCookie('civicsarthi_csrf');
    if (csrfToken) {
      reqConfig.headers['x-csrf-token'] = csrfToken;
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

export async function login({ email, password }) {
  const res = await api.post('/auth/login', { email, password });
  return res.data;
}

export async function register({ email, password, name }) {
  const res = await api.post('/auth/register', { email, password, name });
  return res.data;
}

export async function logout() {
  const res = await api.post('/auth/logout');
  return res.data;
}

export async function fetchCurrentUser() {
  const res = await api.get('/auth/me');
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
export async function fetchComplaintTracking(id) {
  const res = await api.get(`/complaints/${encodeURIComponent(id)}/track`);
  return res.data;
}

// ==========================================
// Authenticated Complaint Operations
// ==========================================

export async function fetchComplaints(params = {}) {
  const res = await api.get('/complaints', { params });
  return res.data;
}

export async function fetchComplaintById(id) {
  const res = await api.get(`/complaints/${encodeURIComponent(id)}`);
  return res.data;
}

export async function createComplaint(payload) {
  const res = await api.post('/complaints', payload);
  return res.data;
}

export async function updateComplaintStatus(id, { status, remarks, actorType }) {
  const res = await api.patch(`/complaints/${encodeURIComponent(id)}/status`, {
    status,
    remarks,
    actorType
  });
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

export { API_BASE_URL };
export default api;
