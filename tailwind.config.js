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
        /* M3 Dynamic Color Aliases via CSS variables */
        m3: {
          'primary': 'var(--m3-primary)',
          'on-primary': 'var(--m3-on-primary)',
          'primary-container': 'var(--m3-primary-container)',
          'on-primary-container': 'var(--m3-on-primary-container)',
          'secondary': 'var(--m3-secondary)',
          'on-secondary': 'var(--m3-on-secondary)',
          'secondary-container': 'var(--m3-secondary-container)',
          'on-secondary-container': 'var(--m3-on-secondary-container)',
          'tertiary': 'var(--m3-tertiary)',
          'on-tertiary': 'var(--m3-on-tertiary)',
          'tertiary-container': 'var(--m3-tertiary-container)',
          'on-tertiary-container': 'var(--m3-on-tertiary-container)',
          'error': 'var(--m3-error)',
          'on-error': 'var(--m3-on-error)',
          'error-container': 'var(--m3-error-container)',
          'on-error-container': 'var(--m3-on-error-container)',
          'surface': 'var(--m3-surface)',
          'on-surface': 'var(--m3-on-surface)',
          'surface-variant': 'var(--m3-surface-variant)',
          'on-surface-variant': 'var(--m3-on-surface-variant)',
          'surface-container-lowest': 'var(--m3-surface-container-lowest)',
          'surface-container-low': 'var(--m3-surface-container-low)',
          'surface-container': 'var(--m3-surface-container)',
          'surface-container-high': 'var(--m3-surface-container-high)',
          'surface-container-highest': 'var(--m3-surface-container-highest)',
          'outline': 'var(--m3-outline)',
          'outline-variant': 'var(--m3-outline-variant)',
          'inverse-surface': 'var(--m3-inverse-surface)',
          'inverse-on-surface': 'var(--m3-inverse-on-surface)',
        }
      },
      fontFamily: {
        'sans': ['"Google Sans"', '"Google Sans Text"', 'system-ui', '-apple-system', 'sans-serif'],
        'display': ['"Google Sans"', 'system-ui', 'sans-serif'],
        'body': ['"Google Sans Text"', '"Google Sans"', 'system-ui', 'sans-serif'],
        'mono': ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        'xs': '4px',
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '28px',
      },
      boxShadow: {
        'm3-1': '0 1px 3px 1px rgba(0,0,0,0.15), 0 1px 2px 0 rgba(0,0,0,0.3)',
        'm3-2': '0 2px 6px 2px rgba(0,0,0,0.15), 0 1px 2px 0 rgba(0,0,0,0.3)',
        'm3-3': '0 4px 8px 3px rgba(0,0,0,0.15), 0 1px 3px 0 rgba(0,0,0,0.3)',
      },
      transitionTimingFunction: {
        'm3-standard': 'cubic-bezier(0.2, 0, 0, 1)',
        'm3-emphasized': 'cubic-bezier(0.2, 0, 0, 1)',
      }
    },
  },
  plugins: [],
}
