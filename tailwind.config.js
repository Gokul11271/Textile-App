/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        premium: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#0a0a0a',
          black: '#000000',
        }
      },
      fontFamily: {
        'google-sans': ['Google Sans', 'sans-serif'],
        'premium-text': ['Outfit', 'sans-serif'],
        'premium-mono': ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
