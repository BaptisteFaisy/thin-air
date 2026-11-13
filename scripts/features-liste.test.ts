/**
 * La liste des fonctionnalités (`scripts/lib/features-liste.mjs`) : la
 * découverte des routes et des composants que le front livre.
 *
 * Le point dur est la route : une constante comme `KIOSK_PARAM = "kiosk"`
 * est un paramètre d'adresse, mais une constante comme `TOUCHE_SON = "p"` est
 * une touche du jeu. Confondre les deux fait réclamer à la liste une route
 * qui n'existe pas — et casse la CI sur un lot qui n'a rien fait de faux.
 *
 * Ce banc est celui des scripts (`scripts/vitest.scripts.config.ts`) :
 *   npx vitest run --config scripts/vitest.scripts.config.ts scripts/features-liste.test.ts
 *
 * Aucun son, aucune requête réseau : les témoins sont des fichiers texte dans
 * un dossier temporaire.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { decouvrirRoutes } from "./lib/features-liste.mjs";

/** Un front témoin : `apps/web/src` avec les fichiers donnés. */
function front(fichiers: Record<string, string>): string {
  const racine = mkdtempSync(join(tmpdir(), "features-liste-"));
  for (const [nom, contenu] of Object.entries(fichiers)) {
    const chemin = join(racine, "apps", "web", "src", nom);
    mkdirSync(dirname(chemin), { recursive: true });
    writeFileSync(chemin, contenu, "utf8");
  }
  return racine;
}

describe("les routes lues par le front", () => {
  it("un paramètre lu en clair est une route", () => {
    const racine = front({
      "App.tsx": 'export function App() { return null; }\nconst lang = new URLSearchParams("").get("lang");\n',
    });
    expect([...decouvrirRoutes(racine).keys()]).toContain("lang");
  });

  it("une constante de paramètre est une route", () => {
    const racine = front({
      "kiosk.ts": 'export const KIOSK_PARAM = "kiosk";\n',
    });
    expect([...decouvrirRoutes(racine).keys()]).toContain("kiosk");
  });

  it("une constante de touche n'est pas une route", () => {
    const racine = front({
      "hooks.ts": 'export const TOUCHE_SON = "p";\nexport const TOUCHES_CORDE = ["a"];\n',
    });
    expect([...decouvrirRoutes(racine).keys()]).not.toContain("p");
  });

  it("le fichier qui lit la route est noté", () => {
    const racine = front({
      "App.tsx": 'const x = new URLSearchParams("").get("limites");\n',
    });
    expect(decouvrirRoutes(racine).get("limites")).toEqual(["apps/web/src/App.tsx"]);
  });
});
