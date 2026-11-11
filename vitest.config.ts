import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const racine = fileURLToPath(new URL(".", import.meta.url));
const alias = (nom: string) => ({
  find: `@thin-air/${nom}`,
  replacement: `${racine}packages/${nom}/src/index.ts`,
});

// Un seul banc de test pour tout le dépôt : Node, sans navigateur, sans écran,
// sans périphérique audio (AIR-N-02). Un test qui a besoin du DOM le demande
// fichier par fichier : `// @vitest-environment happy-dom`.
export default defineConfig({
  resolve: {
    alias: [alias("core"), alias("schema"), alias("audio"), alias("vision")],
  },
  test: {
    environment: "node",
    include: [
      "packages/*/src/**/*.test.ts",
      "apps/*/src/**/*.test.ts",
      "apps/*/src/**/*.test.tsx",
    ],
    exclude: ["**/node_modules/**", "**/dist/**", "apps/web/e2e/**"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    reporters: ["dot"],
  },
});
