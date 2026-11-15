import api from './api';

export const requestService = {
  create: (formData) =>
    api.post('/requests', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  getAll: (params) => api.get('/requests', { params }),

  getById: (id) => api.get(`/requests/${id}`),

  getHistory: (id) => api.get(`/requests/${id}/history`),

  getStats: () => api.get('/requests/stats'),

  approve: (id, data) => api.put(`/requests/${id}/approve`, data),

  reject: (id, data) => api.put(`/requests/${id}/reject`, data),

  returnForCorrection: (id, data) => api.put(`/requests/${id}/return`, data),

  escalate: (id, data) => api.put(`/requests/${id}/escalate`, data),

  resubmit: (id, formData) =>
    api.put(`/requests/${id}/resubmit`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};
