import { defineConfig } from "vitest/config";

/**
 * Integration tests against the dev database in DATABASE_URL (.env.local).
 * Every test runs inside a transaction that is rolled back: nothing is left behind.
 * Never run against production.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["tests/**/*.db.test.ts"],
    exclude: [".claude/**", "node_modules/**"],
    environment: "node",
    setupFiles: ["tests/integration/setup-env.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
