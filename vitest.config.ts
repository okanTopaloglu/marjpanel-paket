import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

export default defineConfig({
  // tsconfig "jsx: preserve" der (Next.js kendi derler); vitest'in esbuild
  // dönüştürücüsüne otomatik JSX çalışma zamanını açıkça söylüyoruz.
  esbuild: { jsx: "automatic" },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
