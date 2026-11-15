import api from './api';

export const userService = {
  getAll: (params) => api.get('/admin/users', { params }),
  getById: (id) => api.get(`/admin/users/${id}`),
  create: (data) => api.post('/admin/users', data),
  update: (id, data) => api.put(`/admin/users/${id}`, data),
  toggleStatus: (id) => api.patch(`/admin/users/${id}/status`),
  getAdminStats: () => api.get('/admin/stats'),
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
};

export const notificationService = {
  getAll: (params) => api.get('/notifications', { params }),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

export const fileService = {
  getPreview: (id) => api.get(`/files/${id}/preview`, {
    responseType: 'blob',
    skipAuthRedirect: true,
  }),
  /**
   * Requests a time-limited signed Cloudinary download URL from the backend.
   * Returns JSON: { signedUrl, expiresAt, fileName, mimeType, fileSize }
   * The backend performs authorization before generating the URL.
   */
  getSignedUrl: (id) => api.get(`/files/${id}`),
  getMeta: (id) => api.get(`/files/${id}?meta=true`),
};
