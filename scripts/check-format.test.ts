/**
 * La vérification de formatage (`scripts/check-format.mjs`) sur des témoins :
 * un fichier CRLF, un fichier tabulé, un fichier sans saut de ligne final, un
 * fichier vide, et un fichier propre. Le script est lancé pour de vrai, dans
 * un dossier temporaire : aucun fichier du dépôt n'est touché.
 *
 * `vitest.config.ts` est gelé (docs/CONTRACT.md) et ne ramasse que
 * `packages/*|apps/*` : ce fichier se lance explicitement —
 * `npx vitest run --config vitest.scripts.config.ts scripts/check-format.test.ts`
 * — et la garde elle-même reste exécutable sans vitest :
 * `node scripts/check-format.mjs`.
 *
 * Aucun son, aucune requête réseau : des fichiers texte dans un dossier
 * temporaire, lus et écrits par Node.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(import.meta.dirname, "..");
const SCRIPT = join(RACINE, "scripts", "check-format.mjs");

/** Un dossier témoin : des fichiers écrits, puis le verdict du script. */
function temoin(fichiers: Record<string, string>): { code: number | null; sortie: string } {
  const dossier = mkdtempSync(join(tmpdir(), "check-format-"));
  for (const [nom, contenu] of Object.entries(fichiers)) {
    writeFileSync(join(dossier, nom), contenu);
  }
  const resultat = spawnSync(process.execPath, [SCRIPT, dossier], { encoding: "utf8" });
  rmSync(dossier, { recursive: true, force: true });
  return { code: resultat.status, sortie: `${resultat.stdout}\n${resultat.stderr}` };
}

describe("check-format — les règles de .editorconfig", () => {
  it("un retour à la ligne CRLF est refusé", () => {
    const verdict = temoin({ "temoignage.txt": "première ligne\r\nseconde ligne\r\n" });
    expect(verdict.code).toBe(1);
    expect(verdict.sortie).toContain("end_of_line");
  });

  it("une tabulation est refusée", () => {
    const verdict = temoin({ "temoignage.txt": "une tabulation\tici\n" });
    expect(verdict.code).toBe(1);
    expect(verdict.sortie).toContain("indent_style");
  });

  it("un fichier sans saut de ligne final est refusé", () => {
    const verdict = temoin({ "temoignage.txt": "pas de saut de ligne final" });
    expect(verdict.code).toBe(1);
    expect(verdict.sortie).toContain("insert_final_newline");
  });

  it("un fichier vide est refusé", () => {
    const verdict = temoin({ "temoignage.txt": "" });
    expect(verdict.code).toBe(1);
    expect(verdict.sortie).toContain("vide");
  });

  it("un espace en fin de ligne est refusé", () => {
    const verdict = temoin({ "temoignage.txt": "une ligne suivie d'une espace \n" });
    expect(verdict.code).toBe(1);
    expect(verdict.sortie).toContain("trim_trailing_whitespace");
  });

  it("un fichier propre est accepté", () => {
    const verdict = temoin({ "temoignage.txt": "une ligne\ndeuxième ligne\n" });
    expect(verdict.code).toBe(0);
    expect(verdict.sortie).toContain("aucun problème");
  });

  it("les règles viennent du .editorconfig du dossier vérifié", () => {
    const verdict = temoin({
      ".editorconfig": "root = true\n\n[*]\ntrim_trailing_whitespace = false\n",
      "temoignage.txt": "une ligne suivie d'une espace \n",
    });
    expect(verdict.code).toBe(0);
  });
});
