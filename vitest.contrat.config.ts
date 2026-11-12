import { defineConfig } from "vitest/config";

/**
 * Banc de test du contrat d'API publique (`scripts/check-api.test.ts`).
 *
 * `vitest.config.ts` est gelé (docs/CONTRACT.md) et ne ramasse que
 * `packages/*` et `apps/*` : ce banc couvre le test qui vit à côté de la
 * garde, sans embarquer les autres tests d'outils.
 *
 * Lancement : `npx vitest run --config vitest.contrat.config.ts`
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/check-api.test.ts"],
    testTimeout: 30_000,
    reporters: ["dot"],
  },
});
