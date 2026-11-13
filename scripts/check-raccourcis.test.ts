/**
 * Le contrôle du manifeste des raccourcis clavier (`scripts/check-raccourcis.mjs`)
 * éprouvé sur des manifestes témoins : les trois règles du cahier, une par une.
 *
 *   1. aucun raccourci ne masque un raccourci du navigateur, et l'application
 *      ne prend jamais Ctrl, Méta ni Alt ;
 *   2. une touche n'est assignée qu'une fois dans un contexte donné ;
 *   3. chaque action a un raccourci OU une raison documentée.
 *
 * `vitest.config.ts` est gelé (docs/CONTRACT.md) et ne ramasse que
 * `packages/*|apps/*` : ce fichier se lance donc explicitement —
 * `npx vitest run --config scripts/vitest.scripts.config.ts scripts/check-raccourcis.test.ts`
 * — et le contrôle reste exécutable sans vitest : `node scripts/check-raccourcis.mjs`.
 *
 * Aucun son, aucune requête réseau : le contrôle ne lit qu'un fichier local.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { verifier } from "./check-raccourcis.mjs";

const RACINE = join(import.meta.dirname, "..");
const SCRIPT = join(RACINE, "scripts", "check-raccourcis.mjs");

/** Une action témoin, conforme : une touche, un écran, un contexte, un libellé. */
function action(ajouts: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "action-temoin",
    touches: ["B"],
    ecran: "jeu",
    contexte: "pointeur",
    libelle: { fr: "Une action", en: "An action" },
    raison: { fr: "", en: "" },
    ...ajouts,
  };
}

/** Un manifeste témoin : la liste d'actions donnée. */
function manifeste(actions: Record<string, unknown>[]): Record<string, unknown> {
  return { version: 1, regle: { fr: "règle", en: "rule" }, ecrans: [], actions };
}

describe("le manifeste des raccourcis clavier", () => {
  it("le manifeste du dépôt est conforme", () => {
    const r = spawnSync(process.execPath, [SCRIPT], { cwd: RACINE, encoding: "utf8" });
    expect(r.status, `${r.stdout}\n${r.stderr}`).toBe(0);
    expect(r.stdout).toContain("manifeste conforme");
  });

  it("refuse un raccourci qui masque celui du navigateur", () => {
    const defauts = verifier(manifeste([action({ touches: ["Ctrl+T"] })]));
    expect(defauts).toHaveLength(1);
    expect(defauts[0]).toContain("masque un raccourci du navigateur");
  });

  it("refuse une touche déjà assignée dans le même contexte", () => {
    const defauts = verifier(
      manifeste([action({ id: "une" }), action({ id: "deux" })]),
    );
    expect(defauts).toHaveLength(1);
    expect(defauts[0]).toContain("est déjà assignée");
  });

  it("accepte la même touche dans deux contextes différents", () => {
    const defauts = verifier(
      manifeste([
        action({ id: "une", contexte: "pointeur" }),
        action({ id: "deux", contexte: "clavier" }),
      ]),
    );
    expect(defauts).toEqual([]);
  });

  it("refuse une action sans raccourci et sans raison", () => {
    const defauts = verifier(manifeste([action({ touches: [] })]));
    expect(defauts).toHaveLength(1);
    expect(defauts[0]).toContain("aucun raccourci et aucune raison documentée");
  });

  it("accepte une action sans raccourci mais avec une raison documentée", () => {
    const defauts = verifier(
      manifeste([action({ touches: [], raison: { fr: "pas de touche", en: "no key" } })]),
    );
    expect(defauts).toEqual([]);
  });

  it("refuse deux actions du même identifiant", () => {
    const defauts = verifier(manifeste([action({ id: "meme" }), action({ id: "meme" })]));
    expect(defauts.some((d) => d.includes("identifiant dupliqué"))).toBe(true);
  });

  it("refuse un manifeste sans liste d'actions", () => {
    const defauts = verifier({ version: 1 } as Record<string, unknown>);
    expect(defauts).toHaveLength(1);
    expect(defauts[0]).toContain("liste « actions »");
  });
});
