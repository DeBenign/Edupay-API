// src/utils/roles.js
// The EduPay owner signs in with role "admin" but has no school, so the app treats them as a fourth portal: "platform".
export const portalOf = (user) => (user?.isPlatformAdmin ? 'platform' : user?.role)
export const homeFor  = (user) => (user ? `/${portalOf(user)}` : '/login')
