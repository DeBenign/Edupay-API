// src/api/index.js
import api from './axios'

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  register:      (data) => api.post('/auth/register', data),
  login:         (data) => api.post('/auth/login', data),
  me:            ()     => api.get('/auth/me'),
  changePassword:(data) => api.patch('/auth/change-password', data),
  createStaff:   (data) => api.post('/auth/create-staff', data),
}

// ─── School ───────────────────────────────────────────────────────────────────
export const schoolAPI = {
  create:  (data) => api.post('/schools', data),
  getmine: ()     => api.get('/schools/me'),
  update:  (id, data) => api.patch(`/schools/${id}`, data),
}

// ─── Students ─────────────────────────────────────────────────────────────────
export const studentAPI = {
  enroll:         (data)   => api.post('/students', data),
  list:           (params) => api.get('/students', { params }),
  get:            (id)     => api.get(`/students/${id}`),
  update:         (id, data) => api.patch(`/students/${id}`, data),
  deactivate:     (id)     => api.delete(`/students/${id}`),
  getAccount:     (id)     => api.get(`/students/${id}/account`),
  retryProvision: (id)     => api.post(`/students/${id}/provision-account`),
}

// ─── Fees ─────────────────────────────────────────────────────────────────────
export const feeAPI = {
  createStructure:       (data)   => api.post('/fees/structures', data),
  listStructures:        (params) => api.get('/fees/structures', { params }),
  getStructure:          (id)     => api.get(`/fees/structures/${id}`),
  updateStructure:       (id, d)  => api.patch(`/fees/structures/${id}`, d),
  assignToStudent:       (data)   => api.post('/fees/assign', data),
  assignToClass:         (data)   => api.post('/fees/assign-class', data),
  getStudentAssignments: (id)     => api.get(`/fees/assignments/${id}`),
}

// ─── Payments ─────────────────────────────────────────────────────────────────
export const paymentAPI = {
  manualEntry:       (data) => api.post('/payments/manual', data),
  getStudentHistory: (id, params) => api.get(`/payments/student/${id}`, { params }),
  getAssignment:     (id)  => api.get(`/payments/assignment/${id}`),
  syncStudent:       (id)  => api.post(`/payments/sync/${id}`),
}

// ─── Reports ──────────────────────────────────────────────────────────────────
export const reportAPI = {
  schoolSummary:   (params) => api.get('/reports/summary', { params }),
  classBreakdown:  (params) => api.get('/reports/class', { params }),
  overpayments:    (params) => api.get('/reports/overpayments', { params }),
  studentStatement:(id)     => api.get(`/reports/student/${id}/statement`),
}

// ─── Parents ──────────────────────────────────────────────────────────────────
export const parentAPI = {
  dashboard:       ()      => api.get('/parents/dashboard'),
  children:        ()      => api.get('/parents/children'),
  linkChild:       (data)  => api.post('/parents/link-child', data),
  unlinkChild:     (id)    => api.delete(`/parents/children/${id}/unlink`),
  childAccount:    (id)    => api.get(`/parents/children/${id}/account`),
  childBalance:    (id)    => api.get(`/parents/children/${id}/balance`),
  childPayments:   (id, p) => api.get(`/parents/children/${id}/payments`, { params: p }),
  notifications:   (p)     => api.get('/parents/notifications', { params: p }),
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────
export const webhookAPI = {
  logs:   (params) => api.get('/webhooks/logs', { params }),
  replay: (id)     => api.post(`/webhooks/replay/${id}`),
}

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationAPI = {
  list:       (params) => api.get('/notifications', { params }),
  markRead:   (id)     => api.patch(`/notifications/${id}/read`),
  markAllRead:()       => api.patch('/notifications/read-all'),
}
