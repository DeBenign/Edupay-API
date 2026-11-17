// src/components/Logo.jsx: the EduPay logo. The files live in /public:

const FILES = {
  horizontal:  { src: '/logo-horizontal.png', ratio: 814 / 240 },
  full:        { src: '/logo-full.png',       ratio: 1022 / 369 },
  icon:        { src: '/logo-icon.png',       ratio: 465 / 432 },
  'icon-dark': { src: '/logo-icon-dark.png',  ratio: 542 / 503 },
}

export default function Logo({ variant = 'horizontal', height = 40, size, className = '' }) {
  const f = FILES[variant] || FILES.horizontal
  const h = size ?? height
  return (
    <img
      src={f.src}
      alt="EduPay"
      height={h}
      width={Math.round(h * f.ratio)}
      draggable={false}
      className={`inline-block select-none ${className}`}
      style={{ height: h, width: 'auto' }}
    />
  )
}
