import api from './api';

export const requestService = {
  getSummary: () => api.get('/requests/summary'),
  list: (params = {}) => api.get('/requests', { params }),
  getById: (id) => api.get(`/requests/${id}`),
  create: (values) => api.post('/requests', values),
  resubmit: (id, values) => api.patch(`/requests/${id}/resubmit`, values),
};
