/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#111744', 50: '#EFF3FF', 100: '#DFE0FF', 700: '#3D4372' },
        gold: { DEFAULT: '#D9B64A', light: '#FFE089', dark: '#735C00', hover: '#C9A73C', darker: '#B89634' },
        canvas: '#F8F9FF',
        canvasalt: '#F5F7FA',
        ink: '#141C28',
        muted: '#5B6576',
        line: '#E5E7EB',
        'line-soft': '#EEF0F4',
        success: { DEFAULT: '#22C55E' },
        warning: { DEFAULT: '#F59E0B' },
        danger: { DEFAULT: '#EF4444' },
        info: { DEFAULT: '#3B82F6' }
      },
      fontFamily: { sans: ['Inter', 'sans-serif'], display: ['Manrope', 'sans-serif'] },
      fontSize: {
        'display-sm': ['clamp(2rem, 4vw, 3rem)', { lineHeight: '1.15' }],
        'page-title': ['clamp(1.5rem, 2.5vw, 2rem)', { lineHeight: '1.2' }],
        'kpi': ['clamp(1.75rem, 3vw, 2.25rem)', { lineHeight: '1.2' }]
      },
      boxShadow: {
        ambient: '0 1px 3px rgba(0,0,0,.05)',
        card: '0 1px 3px rgba(17,23,68,.05), 0 1px 2px rgba(17,23,68,.04)',
        floating: '0 10px 15px -3px rgba(0,0,0,.10)'
      },
      borderRadius: { card: '1rem' },
      transitionDuration: { fast: '150ms' }
    }
  },
  plugins: []
}
