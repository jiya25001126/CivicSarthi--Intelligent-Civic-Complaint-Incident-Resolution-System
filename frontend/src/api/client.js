const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE_URL}/api/health`);
  if (!res.ok) throw new Error(`Healthcheck failed: ${res.statusText}`);
  return res.json();
}

export async function fetchComplaints(params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = `${API_BASE_URL}/api/complaints${query ? `?${query}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch complaints: ${res.statusText}`);
  return res.json();
}

export async function fetchComplaintById(id) {
  const res = await fetch(`${API_BASE_URL}/api/complaints/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch complaint ${id}: ${res.statusText}`);
  return res.json();
}

export async function fetchDepartments() {
  const res = await fetch(`${API_BASE_URL}/api/departments`);
  if (!res.ok) throw new Error(`Failed to fetch departments: ${res.statusText}`);
  return res.json();
}

export { API_BASE_URL };
