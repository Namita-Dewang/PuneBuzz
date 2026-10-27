import api from './axios';

// role: 'user' (books seats) or 'organizer' (can also create events)
export async function register({ name, email, password, role = 'user' }) {
  const { data } = await api.post('/auth/register', { name, email, password, role });
  return data; // { user, token }
}

export async function login({ email, password }) {
  const { data } = await api.post('/auth/login', { email, password });
  return data; // { user, token }
}

export async function fetchMe() {
  const { data } = await api.get('/auth/me');
  return data.user;
}
