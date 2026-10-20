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
  promoteClass: (data) => api.post('/students/promote-class', data),
  newLinkCode: (id, data) => api.post(`/students/${id}/link-code`, data),

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
  addToStudent: (data) => api.post('/fees/assign-custom', data),
  adjustAssignment: (id, data) => api.patch(`/fees/assignments/${id}/adjust`, data),
}

// ─── Payments ─────────────────────────────────────────────────────────────────
export const paymentAPI = {
  manualEntry:       (data) => api.post('/payments/manual', data),
  getStudentHistory: (id, params) => api.get(`/payments/student/${id}`, { params }),
  getAssignment:     (id)  => api.get(`/payments/assignment/${id}`),
  syncStudent:       (id)  => api.post(`/payments/sync/${id}`),
  overpayments: ()  => api.get('/payments/overpayments'),
  resolveOverpayment: (assignmentId, data) => api.post(`/payments/overpayments/${assignmentId}/resolve`, data),
  approveRefund:      (assignmentId, data) => api.post(`/payments/overpayments/${assignmentId}/approve-refund`, data),
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

// ─── Revenue ──────────────────────────────────────────────────────────────────
export const revenueAPI = {
  school:   (schoolId, params) => api.get(`/revenue/schools/${schoolId}`, { params }),
  platform: (params)           => api.get('/revenue/platform', { params }),
  allSchools:()                => api.get('/revenue/schools'),
}

// ─── Withdrawals ──────────────────────────────────────────────────────────────
export const withdrawalAPI = {
  requestSchool: (schoolId, data) => api.post(`/withdrawals/schools/${schoolId}`, data),
  historySchool: (schoolId)       => api.get(`/withdrawals/schools/${schoolId}`),
  requestPlatform:(data)          => api.post('/withdrawals/platform', data),
}

// ─── Referrals ────────────────────────────────────────────────────────────────
export const referralAPI = {
  list:         (params)         => api.get('/referrals', { params }),
  rewardWaiver: (id)             => api.post(`/referrals/${id}/reward/fee-waiver`),
  myRewards:    ()               => api.get('/referrals/rewards'),
  claimReward:  (rewardId, data) => api.post(`/referrals/rewards/${rewardId}/claim`, data),
  dataPlans: (params) => api.get('/referrals/data-plans', { params }),
}

// ─── Subscription ────────────────────────────────────────────────────────────────
export const subscriptionAPI = {
  mine:    ()               => api.get('/subscriptions/mine'),
  schools: ()               => api.get('/subscriptions/schools'),
  record:  (schoolId, data) => api.post(`/subscriptions/schools/${schoolId}/payments`, data),
  setStudents: (data) => api.patch('/subscriptions/declared-students', data),
}