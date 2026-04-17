/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Primary: Deep Trust Blue (Policybazaar-inspired) ───────
        primary: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#2563EB',
          600: '#0B3B8C',   // ← main action colour  (deep trust blue)
          700: '#082B6B',
          800: '#051B44',
          900: '#03102A',
          950: '#020B1E',
        },
        // Brand alias — used as bg-navy, text-navy, etc.
        navy: {
          DEFAULT: '#0B3B8C',   // deep trust blue
          light:   '#1A5CB4',
          dark:    '#082B6B',
        },
        // ── Accent: Emerald (protected / paid) ────────────────────
        accent: {
          DEFAULT: '#059669',
          light:   '#10B981',
          dark:    '#047857',
        },
        // ── Semantic ──────────────────────────────────────────────
        surface:  '#F8FAFF',   // subtle blue-tint white
        success:  '#059669',
        warning:  '#F59E0B',   // brighter amber
        danger:   '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs':  ['0.7rem',     { lineHeight: '1rem' }],
        'xs':   ['0.8rem',     { lineHeight: '1.2rem' }],
        'sm':   ['0.875rem',   { lineHeight: '1.35rem' }],
        'base': ['0.9375rem',  { lineHeight: '1.55rem' }], // 15px
        'lg':   ['1.0625rem',  { lineHeight: '1.6rem' }],
        'xl':   ['1.25rem',    { lineHeight: '1.75rem' }],
        '2xl':  ['1.5rem',     { lineHeight: '2rem' }],
        '3xl':  ['1.875rem',   { lineHeight: '2.25rem' }],
        '4xl':  ['2.25rem',    { lineHeight: '2.5rem' }],
        '5xl':  ['3rem',       { lineHeight: '1.1' }],
        '6xl':  ['3.5rem',     { lineHeight: '1.08' }],
      },
      boxShadow: {
        'sm':   '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'md':   '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)',
        'lg':   '0 10px 15px -3px rgb(0 0 0 / 0.07), 0 4px 6px -4px rgb(0 0 0 / 0.07)',
        'xl':   '0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.08)',
        'glow-navy':   '0 0 24px rgb(11 59 140 / 0.30)',
        'glow-indigo': '0 0 20px rgb(99 102 241 / 0.35)',
        'glow-emerald': '0 0 20px rgb(5 150 105 / 0.3)',
      },
      borderRadius: {
        DEFAULT: '8px',
        'sm':  '6px',
        'md':  '8px',
        'lg':  '10px',
        'xl':  '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      animation: {
        'fade-in':  'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'shimmer':  'shimmer 1.6s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
