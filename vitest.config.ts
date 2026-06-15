import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Minimal env so modules that validate process.env can be imported in tests.
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      NEXTAUTH_SECRET: 'test-secret-test-secret-test-secret',
      NEXTAUTH_URL: 'http://localhost:3000',
      APP_URL: 'http://localhost:3000',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
