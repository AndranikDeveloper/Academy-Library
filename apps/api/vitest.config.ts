import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/academy_library_test?schema=public',
      LOG_LEVEL: 'silent',
    },
  },
});
