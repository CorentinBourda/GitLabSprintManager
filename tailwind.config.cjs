/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/frontend/**/*.{vue,js,ts,jsx,tsx}',
    './app/views/**/*.{erb,html}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          200: '#bcd2ff',
          300: '#8eb4ff',
          400: '#598bff',
          500: '#3563ff',
          600: '#1f43f5',
          700: '#1832e1',
          800: '#1a2bb6',
          900: '#1c2c8f',
          950: '#151b54',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(53,99,255,0.15), 0 10px 40px -10px rgba(53,99,255,0.35)',
        card: '0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.1)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
