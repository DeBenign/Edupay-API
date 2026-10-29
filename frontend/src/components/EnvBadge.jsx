// src/components/EnvBadge.jsx: shows which server this build talks to (PRODUCTION / STAGING / LOCAL)
import { ENV_NAME, BASE_URL, API_MISCONFIGURED } from '../api/axios'

const STYLE = {
  PRODUCTION: { box: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  STAGING:    { box: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  LOCAL:      { box: 'bg-blue-50 text-blue-700 border-blue-200',    dot: 'bg-blue-500' },
}

// variant "chip": small tag in the sidebar.  variant "banner": full line with the API address (Settings pages).
export default function EnvBadge({ variant = 'chip' }) {
  const s = STYLE[ENV_NAME] || STYLE.LOCAL
  if (variant === 'banner') {
    return (
      <div className="space-y-2">
        <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg border w-fit ${s.box}`}>
          <span className={`w-2 h-2 rounded-full ${s.dot}`} />
          Connected to: {ENV_NAME} — {BASE_URL}
        </div>
        {API_MISCONFIGURED && (
          <p className="text-xs font-medium text-red-600">VITE_API_URL is not set for this deployment, so the app cannot reach the backend.</p>
        )}
      </div>
    )
  }
  return (
    <div className={`mt-2.5 flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-md w-fit border ${s.box}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {ENV_NAME}
    </div>
  )
}
