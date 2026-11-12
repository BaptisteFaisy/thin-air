import { defineWorkspace } from "vitest/config";
import racine from "./vitest.config";

/**
 * Les projets de test du dépôt.
 *
 * `vitest.config.ts` est gelé (docs/CONTRACT.md) et ne ramasse que les
 * dossiers `packages` et `apps` : les bancs d'`exemples/` n'y sont donc pas
 * vus. Ce fichier ajoute un projet « exemples » sans toucher au fichier gelé :
 * le projet racine est repris tel quel (mêmes alias), le second ne fait que
 * ramasser `exemples`.
 *
 * Vitest 3.2 déconseille les fichiers workspace au profit de `test.projects`
 * dans `vitest.config.ts` ; on basculera là le jour où ce fichier cesse d'être
 * gelé.
 */
export default defineWorkspace([
  racine,
  {
    resolve: { alias: racine.resolve?.alias },
    test: {
      name: "exemples",
      environment: "node",
      include: ["exemples/**/*.test.ts"],
      testTimeout: 60_000,
      hookTimeout: 60_000,
      reporters: ["dot"],
    },
  },
]);