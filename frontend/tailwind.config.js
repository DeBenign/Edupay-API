/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // EduPay logo colours: navy #071D49, green #0DFF63
        logo: { navy: '#071D49', navy2: '#0A2A6B', green: '#0DFF63', green2: '#0AD654' },
        blue: {
          50:  '#eef2fb',
          100: '#dbe4f5',
          200: '#b8c8e8',
          300: '#8aa3d4',
          400: '#0AD654',
          500: '#0DFF63',
          600: '#071D49',
          700: '#04112D',
          800: '#030c20',
          900: '#020816',
        },
        brand: {
          50:  '#eef2fb',
          100: '#dbe4f5',
          200: '#b8c8e8',
          400: '#0AD654',
          500: '#0DFF63',
          600: '#071D49',
          700: '#04112D',
          900: '#020816',
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
