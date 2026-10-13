import { defineConfig, loadEnv } from "vite";
import path from "node:path";

export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    env: loadEnv(mode, process.cwd(), ""),
    include: ["tests/**/*.test.ts"],
  },
}));
