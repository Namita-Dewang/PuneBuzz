import api from './axios';

// params: { category, area, from, to, q, free, page, limit } (undefined values are dropped)
export async function listEvents(params) {
  const { data } = await api.get('/events', { params });
  return data; // { data, page, limit, total }
}

export async function getEvent(id) {
  const { data } = await api.get(`/events/${id}`);
  return data.event;
}

export async function createEvent(payload) {
  const { data } = await api.post('/events', payload);
  return data.event;
}

// Send only the fields that changed (PATCH).
export async function updateEvent(id, changes) {
  const { data } = await api.patch(`/events/${id}`, changes);
  return data.event;
}

// Soft delete: sets status to 'cancelled'.
export async function cancelEvent(id) {
  const { data } = await api.delete(`/events/${id}`);
  return data.event;
}

export async function getAttendees(id) {
  const { data } = await api.get(`/events/${id}/attendees`);
  return data; // { confirmed: [...], waitlist: [...] }
}

export async function getMyEvents() {
  const { data } = await api.get('/me/events');
  return data; // { attending, waitlisted, organizing }
}

export async function rsvp(id) {
  const { data } = await api.post(`/events/${id}/rsvp`);
  return data; // { status: 'confirmed' } | { status: 'waitlisted', position }
}

export async function cancelRsvp(id) {
  const { data } = await api.delete(`/events/${id}/rsvp`);
  return data; // { status: 'cancelled' | 'left_waitlist' }
}
