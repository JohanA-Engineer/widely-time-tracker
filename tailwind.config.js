/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./app.js",
    "./styles.css"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#3B82F6',
          500: '#2563EB',
          600: '#1D4ED8',
          700: '#1E40AF',
          800: '#1E3A8A',
          900: '#0F172A',
        },
        sage: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#3B82F6',
          500: '#2563EB',
          600: '#1D4ED8',
          700: '#1E40AF',
          800: '#1E3A8A',
          900: '#0F172A',
        },
        warm: {
          50: '#F1F5F9',
          100: '#F8FAFC',
          200: '#E2E8F0',
          300: '#BAE6FD',
          400: '#0284C7',
          500: '#0369A1',
          600: '#0284C7',
        },
        charcoal: {
          50: '#F7F8F7',
          100: '#EBECEB',
          200: '#D6D8D6',
          500: '#64748B',
          700: '#404741',
          800: '#0F172A',
          900: '#0F172A',
          950: '#0B0F19',
        }
      },
      fontFamily: {
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"Inter"', 'ui-monospace', 'monospace'],
      }
    }
  },
  plugins: [],
};
