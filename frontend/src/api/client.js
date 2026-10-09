import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor for friendly error extraction
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
    return Promise.reject(new Error(errorMsg));
  }
);

export async function fetchHealth() {
  const res = await api.get('/health');
  return res.data;
}

export async function fetchDepartments() {
  const res = await api.get('/departments');
  return res.data;
}

export async function fetchComplaints(params = {}, options = {}) {
  const headers = {};
  if (options.role) {
    headers['x-portal-role'] = options.role;
  }
  const res = await api.get('/complaints', { params, headers });
  return res.data;
}

export async function fetchComplaintStats() {
  const res = await api.get('/complaints/stats');
  return res.data;
}

export async function fetchComplaintById(id, options = {}) {
  const headers = {};
  const params = {};
  if (options.role) {
    params.role = options.role;
    headers['x-portal-role'] = options.role;
  }
  const res = await api.get(`/complaints/${encodeURIComponent(id)}`, { params, headers });
  return res.data;
}

/**
 * Public Tracking API: fetches sanitized lifecycle tracking without private contact details or officer notes.
 */
export async function fetchComplaintTracking(id) {
  const res = await api.get(`/complaints/${encodeURIComponent(id)}/track`);
  return res.data;
}

export async function createComplaint(payload) {
  const res = await api.post('/complaints', payload);
  return res.data;
}

export async function updateComplaintStatus(id, { status, remarks, actorType = 'OFFICER' }) {
  const res = await api.patch(`/complaints/${encodeURIComponent(id)}/status`, {
    status,
    remarks,
    actorType
  });
  return res.data;
}

export async function reassignComplaintDepartment(id, { departmentId, remarks, actorType = 'OFFICER' }) {
  const res = await api.patch(`/complaints/${encodeURIComponent(id)}/department`, {
    departmentId,
    remarks,
    actorType
  });
  return res.data;
}

export async function addOfficerNote(id, { note, officerId = 'DEMO_OFFICER' }) {
  const res = await api.post(`/complaints/${encodeURIComponent(id)}/notes`, {
    note,
    officerId
  });
  return res.data;
}

export async function fetchComplaintHistory(id) {
  const res = await api.get(`/complaints/${encodeURIComponent(id)}/history`);
  return res.data;
}

export { API_BASE_URL };
export default api;
