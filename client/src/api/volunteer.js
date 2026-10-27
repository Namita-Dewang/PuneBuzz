import api from './axios';

// params: { category, area, from, to, q, page, limit }
export async function listOpportunities(params) {
  const { data } = await api.get('/volunteer-opportunities', { params });
  return data; // { data, page, limit, total }
}

export async function getEventRoles(eventId) {
  const { data } = await api.get(`/events/${eventId}/volunteer-roles`);
  return data.roles;
}

// answers: { motivation, volunteeredBefore, pastExperience, skills, availability, phone }
export async function applyToRole(roleId, answers) {
  const { data } = await api.post(`/volunteer-roles/${roleId}/applications`, answers);
  return data.application;
}

export async function withdrawFromRole(roleId) {
  await api.delete(`/volunteer-roles/${roleId}/applications/me`);
}

// ---- organizer
export async function createRole(eventId, role) {
  const { data } = await api.post(`/events/${eventId}/volunteer-roles`, role);
  return data.role;
}

export async function updateRole(roleId, changes) {
  const { data } = await api.patch(`/volunteer-roles/${roleId}`, changes);
  return data.role;
}

export async function deleteRole(roleId) {
  await api.delete(`/volunteer-roles/${roleId}`);
}

export async function getApplications(eventId) {
  const { data } = await api.get(`/events/${eventId}/volunteer-applications`);
  return data.roles;
}

export async function setApplicationStatus(applicationId, status) {
  const { data } = await api.patch(`/volunteer-applications/${applicationId}`, { status });
  return data.application;
}

// Downloads the .xlsx through the authenticated Axios instance (a plain link
// can't send the token) and hands it to the browser as a file.
export async function downloadApplications(eventId, fallbackName = 'volunteers.xlsx') {
  const response = await api.get(`/events/${eventId}/volunteer-applications/export`, { responseType: 'blob' });
  const match = /filename="([^"]+)"/.exec(response.headers['content-disposition'] ?? '');
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = match?.[1] ?? fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
