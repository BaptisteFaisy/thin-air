import { defineConfig } from "vitest/config";

/**
 * Banc des tests qui vivent dans `scripts/`.
 *
 * `vitest.config.ts` est gelé (docs/CONTRACT.md) et ne ramasse que
 * `packages/*|apps/*` : les tests de scripts sont donc bans à part, lancés
 * explicitement —
 *
 *   npx vitest run --config vitest.scripts.config.ts
 *
 * Aucun son, aucun réseau : ces tests travaillent sur des témoins (dossiers
 * temporaires, doublures), comme le veut AIR-N-02.
 *
 * État connu : `scripts/pack-check.test.ts` échoue déjà sur `main` (deux cas,
 * un message de garde qui ne contient plus le nom du paquet fautif). C'est une
 * dette préexistante, hors de ce lot : le contrôle de release passe.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/**/*.test.ts"],
    reporters: ["dot"],
  },
});
