/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#111744', 50: '#EFF3FF', 100: '#DFE0FF', 700: '#3D4372' },
        gold: { DEFAULT: '#D9B64A', light: '#FFE089', dark: '#735C00' },
        canvas: '#F8F9FF',
        ink: '#141C28',
        muted: '#46464F',
        line: '#E5E7EB'
      },
      fontFamily: { sans: ['Inter', 'sans-serif'], display: ['Manrope', 'sans-serif'] },
      boxShadow: {
        ambient: '0 1px 3px rgba(0,0,0,.05)',
        floating: '0 10px 15px -3px rgba(0,0,0,.10)'
      },
      borderRadius: { card: '1rem' }
    }
  },
  plugins: []
}
