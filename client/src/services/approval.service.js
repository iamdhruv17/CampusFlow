import api from './api';
export const approvalService = { list: () => api.get('/approvals/assigned'), get: (id) => api.get(`/approvals/${id}`), decide: (id, payload) => api.post(`/approvals/${id}/decision`, payload), history: (id) => api.get(`/approvals/${id}/history`) };
