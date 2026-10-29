// src/components/Logo.jsx: the EduPay mark (3D graduation cap). One source file: public/favicon.svg
export default function Logo({ size = 40, className = '', rounded = true }) {
  return (
    <img
      src="/favicon.svg"
      width={size}
      height={size}
      alt="EduPay"
      draggable={false}
      className={`inline-block select-none ${className}`}
      style={{ width: size, height: size, borderRadius: rounded ? size * 0.23 : 0, boxShadow: '0 8px 20px -6px rgba(37,99,235,.45)' }}
    />
  )
}
