// src/api/axios.js
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

// ── Which environment is this build talking to? ───────────────────────────────
// 1) VITE_ENV_NAME if set  2) Vercel's own VITE_VERCEL_ENV  3) the address in the browser  4) build mode
const ALIASES = {
  PRODUCTION: 'PRODUCTION', PROD: 'PRODUCTION', LIVE: 'PRODUCTION',
  STAGING: 'STAGING', PREVIEW: 'STAGING',
  LOCAL: 'LOCAL', DEV: 'LOCAL', DEVELOPMENT: 'LOCAL',
}
const host = typeof window !== 'undefined' ? window.location.hostname : ''
const onLocalhost = ['localhost', '127.0.0.1', '::1'].includes(host)

const detectEnv = () => {
  const named = ALIASES[String(import.meta.env.VITE_ENV_NAME || '').trim().toUpperCase()]
  if (named) return named
  const vercel = String(import.meta.env.VITE_VERCEL_ENV || '').toLowerCase()   // production | preview | development
  if (vercel === 'production') return 'PRODUCTION'
  if (vercel === 'preview') return 'STAGING'
  if (onLocalhost) return 'LOCAL'
  return import.meta.env.PROD ? 'PRODUCTION' : 'LOCAL'
}

const ENV_NAME = detectEnv()

// A deployed site with no VITE_API_URL would call its OWN /api, which Vercel answers with index.html
const API_MISCONFIGURED = !onLocalhost && BASE_URL.startsWith('/')

if (!import.meta.env.PROD) console.log(`🌐 EduPay API → ${BASE_URL} [${ENV_NAME}]`)
if (API_MISCONFIGURED) console.error('❌ VITE_API_URL is not set for this deployment. Set it to https://<your-backend>/api in Vercel and redeploy.')

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 403 && err.response?.data?.code === 'PASSWORD_CHANGE_REQUIRED') {
      try {
        const u = JSON.parse(localStorage.getItem('edupay_user'))
        localStorage.setItem('edupay_user', JSON.stringify({ ...u, mustChangePassword: true }))
      } catch { /* ignore */ }
      window.location.reload()
    }
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('edupay_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
export { ENV_NAME, BASE_URL, API_MISCONFIGURED }