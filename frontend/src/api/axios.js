// src/api/axios.js
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'
const ENV_NAME = import.meta.env.VITE_ENV_NAME || 'LOCAL'

// Show which server we're hitting on startup
console.log(`🌐 EduPay API → ${BASE_URL} [${ENV_NAME}]`)

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('edupay_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('edupay_token')
      localStorage.removeItem('edupay_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
export { ENV_NAME, BASE_URL }