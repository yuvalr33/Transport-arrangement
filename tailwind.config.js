/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { heebo: ['var(--font-heebo)', 'sans-serif'] },
      colors: {
        base: '#08111f', surface: '#0f1d30', panel: '#162035', border: '#1e2d45',
      },
    },
  },
  plugins: [],
}
