import api from './axios';

export async function listVenues() {
  const { data } = await api.get('/venues');
  return data.data;
}

export async function createVenue(payload) {
  const { data } = await api.post('/venues', payload);
  return data.venue;
}
