import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm coral "Foster" brand (see the mobile design reference).
        brand: {
          50: '#fdf5f2',
          100: '#fbe7e0',
          200: '#f6ccbd',
          300: '#efaa94',
          400: '#e6856a',
          500: '#dd6647',
          600: '#cb4f33',
          700: '#a93f29',
          800: '#883626',
          900: '#6f3023',
        },
        // Soft cream surface tones used for page backgrounds.
        cream: {
          50: '#fdf9f5',
          100: '#fbf3ec',
          200: '#f6e7da',
        },
      },
    },
  },
  plugins: [],
};

export default config;
