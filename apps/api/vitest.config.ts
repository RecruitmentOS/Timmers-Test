import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    resolve: {
      conditions: ["import"],
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/services/**"],
      thresholds: {
        perFile: true,
        "src/services/billing.service.ts": {
          branches: 80,
        },
        "src/services/ai-screening.service.ts": {
          branches: 80,
        },
        "src/services/apply.service.ts": {
          branches: 80,
        },
      },
    },
  },
});
