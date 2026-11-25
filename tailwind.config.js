/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cbox: {
          bg: 'rgb(var(--cbox-bg) / <alpha-value>)',
          surface: 'rgb(var(--cbox-surface) / <alpha-value>)',
          elevated: 'rgb(var(--cbox-elevated) / <alpha-value>)',
          border: 'rgb(var(--cbox-border) / <alpha-value>)',
          text: 'rgb(var(--cbox-text) / <alpha-value>)',
          muted: 'rgb(var(--cbox-muted) / <alpha-value>)',
          accent: 'rgb(var(--cbox-accent) / <alpha-value>)',
          accentHover: 'rgb(var(--cbox-accent-hover) / <alpha-value>)',
          violet: 'rgb(var(--cbox-violet) / <alpha-value>)',
          success: 'rgb(var(--cbox-success) / <alpha-value>)',
          danger: 'rgb(var(--cbox-danger) / <alpha-value>)',
          warning: 'rgb(var(--cbox-warning) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        card: '1rem',
      },
      boxShadow: {
        soft: '0 8px 30px rgba(2, 6, 23, 0.12)',
      },
    },
  },
  plugins: [],
};
