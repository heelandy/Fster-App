import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#bcdaff',
          300: '#8ec3ff',
          400: '#599fff',
          500: '#347bff',
          600: '#1f5cf5',
          700: '#1846e1',
          800: '#1a3bb6',
          900: '#1b388f',
        },
      },
    },
  },
  plugins: [],
};

export default config;
