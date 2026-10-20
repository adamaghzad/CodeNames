import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Tests must run without real API keys: AI layer uses its labelled
    // demo fallback, persistence no-ops without Supabase env.
    env: { GROQ_API_KEY: "", NEXT_PUBLIC_SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "" },
  },
});
