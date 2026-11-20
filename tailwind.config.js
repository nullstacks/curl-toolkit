const rgb = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: rgb('bg'),
        surface: rgb('surface'),
        'surface-2': rgb('surface-2'),
        border: rgb('border'),
        fg: rgb('fg'),
        muted: rgb('muted'),
        accent: rgb('accent'),
        danger: rgb('danger'),
        warn: rgb('warn'),
        ok: rgb('ok'),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
