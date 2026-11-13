/**
 * La liste figée des fonctionnalités promises, confrontée au code.
 *
 * `scripts/check-features.mjs` compare `docs/features.json` à ce que le code
 * livre réellement. Ce test lance la garde dans un processus enfant et
 * vérifie ses deux issues : la garde passe sur le dépôt tel quel, et elle
 * refuse, en nommant le manque, dès que la liste et le code divergent.
 *
 * Le dépôt n'est pas modifié : la liste mutée est écrite dans le dossier
 * temporaire, puis passée à la garde par `--liste`. Aucune commande n'est
 * exécutée, aucun son n'est émis, aucune requête réseau (cahier §14.3,
 * AIR-N-02).
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = new URL("../../..", import.meta.url).pathname;
const SCRIPT = join(RACINE, "scripts", "check-features.mjs");
const LISTE = join(RACINE, "docs", "features.json");

/** Lance la garde sur une liste donnée ; renvoie son code et ses sorties. */
function lancer(liste = LISTE) {
  const resultat = spawnSync(process.execPath, [SCRIPT, "--liste", liste], {
    cwd: RACINE,
    encoding: "utf8",
  });
  return { code: resultat.status, sortie: `${resultat.stdout}${resultat.stderr}` };
}

/** La forme de la liste telle que `docs/features.json` la déclare. */
interface Liste {
  ecrans: { ancres: { symbole: string }[] }[];
  fonctionnalites: {
    exigence: string;
    ecran: string;
    preuve: { ancre: string };
  }[];
}

/** Une copie de la liste, mutée par la fonction donnée. */
function listeMutee(mutation: (donnees: Liste) => void): string {
  const donnees = JSON.parse(readFileSync(LISTE, "utf8")) as Liste;
  mutation(donnees);
  const dossier = mkdtempSync(join(tmpdir(), "features-"));
  const chemin = join(dossier, "features.json");
  writeFileSync(chemin, JSON.stringify(donnees), "utf8");
  return chemin;
}

/** La première fonctionnalité de la liste, refusée s'il n'y en a pas. */
function premiere(donnees: Liste): Liste["fonctionnalites"][number] {
  const found = donnees.fonctionnalites[0];
  if (found === undefined) throw new Error("la liste ne porte aucune fonctionnalité");
  return found;
}

/** Le premier écran de la liste, refusé s'il n'y en a pas. */
function premierEcran(donnees: Liste): Liste["ecrans"][number] {
  const found = donnees.ecrans[0];
  if (found === undefined) throw new Error("la liste ne porte aucun écran");
  return found;
}

/** La première ancre du premier écran, refusée s'il n'y en a pas. */
function premiereAncre(donnees: Liste): { symbole: string } {
  const ancre = premierEcran(donnees).ancres[0];
  if (ancre === undefined) throw new Error("le premier écran n'a aucune ancre");
  return ancre;
}

describe("la liste des fonctionnalités promises contre le code", () => {
  it("passe sur le dépôt tel quel", () => {
    const verdict = lancer();
    expect(verdict.code).toBe(0);
    expect(verdict.sortie).not.toContain("manque");
  });

  it("refuse une fonctionnalité retirée de la liste, en nommant l'exigence", () => {
    const chemin = listeMutee((donnees) => {
      donnees.fonctionnalites = donnees.fonctionnalites.filter((f) => f.exigence !== "AIR-F-50");
    });
    const verdict = lancer(chemin);
    expect(verdict.code).toBe(1);
    expect(verdict.sortie).toContain("AIR-F-50");
  });

  it("refuse un écran dont le composant n'existe pas", () => {
    const chemin = listeMutee((donnees) => {
      premiereAncre(donnees).symbole = "AccueilInexistant";
    });
    const verdict = lancer(chemin);
    expect(verdict.code).toBe(1);
    expect(verdict.sortie).toContain("AccueilInexistant");
  });

  it("refuse une preuve qui ne cite plus l'exigence", () => {
    const chemin = listeMutee((donnees) => {
      premiere(donnees).preuve.ancre = "AIR-F-99";
    });
    const verdict = lancer(chemin);
    expect(verdict.code).toBe(1);
    expect(verdict.sortie).toContain("AIR-F-99");
  });

  it("refuse une fonctionnalité portée par un écran inconnu", () => {
    const chemin = listeMutee((donnees) => {
      premiere(donnees).ecran = "ecran-inconnu";
    });
    const verdict = lancer(chemin);
    expect(verdict.code).toBe(1);
    expect(verdict.sortie).toContain("ecran-inconnu");
  });

  it("refuse une exigence que le cahier ne porte pas", () => {
    const chemin = listeMutee((donnees) => {
      premiere(donnees).exigence = "AIR-F-99";
    });
    const verdict = lancer(chemin);
    expect(verdict.code).toBe(1);
    expect(verdict.sortie).toContain("AIR-F-99");
  });
});
