/**
 * Banc de test des scripts du dépôt.
 *
 * `vitest.config.ts` est gelé (docs/CONTRACT.md) : il ne ramasse que
 * `packages/*|apps/*` et ne doit pas bouger. Ce banc couvre `scripts/**`
 * sans le modifier — il ne fait que lecture, en Node, sans son.
 *
 * Usage : `npx vitest run --config scripts/vitest.scripts.config.ts <fichier>`
 */
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const racine = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  root: racine,
  test: {
    environment: "node",
    include: ["scripts/**/*.test.ts"],
    reporters: ["dot"],
    testTimeout: 30_000,
  },
});
