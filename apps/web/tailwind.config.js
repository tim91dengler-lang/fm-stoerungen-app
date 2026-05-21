/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0f0fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          900: '#0c4a6e',
        },
        status: {
          neu: '#6b7280',
          zugewiesen: '#3b82f6',
          'in-arbeit': '#f59e0b',
          erledigt: '#10b981',
          geschlossen: '#374151',
        },
        prio: {
          niedrig: '#9ca3af',
          mittel: '#60a5fa',
          hoch: '#f97316',
          kritisch: '#ef4444',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
