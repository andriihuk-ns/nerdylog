import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["tests/**/*.test.ts", "src/**/*.test.ts", "src/**/*.test.tsx"],
    // *.db.test.ts hit a real database: run them only with `npm run test:db`.
    exclude: [".claude/**", "node_modules/**", "**/*.db.test.ts"],
    environment: "node",
  },
});
