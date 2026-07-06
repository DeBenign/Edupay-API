/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef5ff',
          100: '#d9e8ff',
          200: '#bcd4fe',
          400: '#6da4fc',
          500: '#4285f4',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        // Status colors — payment states
        paid:    { bg: '#f0fdf4', text: '#15803d', border: '#86efac' },
        partial: { bg: '#fffbeb', text: '#b45309', border: '#fcd34d' },
        unpaid:  { bg: '#fef2f2', text: '#b91c1c', border: '#fca5a5' },
        over:    { bg: '#f5f3ff', text: '#6d28d9', border: '#c4b5fd' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in':  'fadeIn 0.2s ease-out',
        'pulse-dot': 'pulseDot 2s infinite',
      },
      keyframes: {
        slideIn:  { from: { transform: 'translateX(100%)', opacity: 0 }, to: { transform: 'translateX(0)', opacity: 1 } },
        fadeIn:   { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseDot: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
      },
    },
  },
  plugins: [],
}
