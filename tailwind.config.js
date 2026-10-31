/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'navy-deep': '#0A2540',
        // Reading-room ink ramp: light page surfaces and the dark viewer surfaces
        paper: {
          DEFAULT: '#f5f7fa',
          card: '#ffffff',
          raised: '#eceff4',
        },
        ink: {
          950: '#07080d',
          900: '#0b0d14',
          850: '#11141c',
          800: '#1a1e28',
        },
        fg: {
          DEFAULT: '#0A2540',
          2: '#4b5565',
          3: '#6b7487',
        },
        // Scanner blue: the one accent. 700 for text and fills on light surfaces
        scan: {
          300: '#7dd3fc',
          400: '#38bdf8',
          700: '#0369a1',
        },
        tumor: '#e5484d',
      },
      fontFamily: {
        'sans': ['var(--font-sans)', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        'serif': ['var(--font-serif)', 'serif'],
        'mono': ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'float': '0 8px 24px rgba(10, 37, 64, 0.06)',
        'window': '0 24px 48px -12px rgba(7, 8, 13, 0.25)',
      },
      transitionTimingFunction: {
        'out-quint': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
