/**
 * Banc de test des exemples autonomes du dépôt.
 *
 * `vitest.config.ts` est gelé (docs/CONTRACT.md) : il ne ramasse que
 * `packages/*|apps/*` et ne doit pas bouger. Ce banc couvre `exemples/**`
 * sans le modifier — il ne fait que lecture, en Node, sans son.
 *
 * Les imports `@thin-air/core` et `@thin-air/audio` se résolvent par les
 * liens du workspace (`node_modules/@thin-air/*`), pas par un alias : c'est
 * exactement ce que voit un tiers qui installe les paquets publiés.
 *
 * Usage : `npx vitest run --config exemples/vitest.exemples.config.ts`
 */
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const racine = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  root: racine,
  test: {
    environment: "node",
    include: ["exemples/**/*.test.ts"],
    reporters: ["dot"],
    testTimeout: 60_000,
  },
});