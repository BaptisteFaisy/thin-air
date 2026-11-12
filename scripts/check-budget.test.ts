/**
 * Contrôle du budget CI (`scripts/check-budget.mjs`) : des workflows témoins
 * pour chaque refus de la règle, puis le dépôt réel.
 *
 * `vitest.config.ts` est gelé (docs/CONTRACT.md) et ne ramasse que
 * `packages/*|apps/*` : ce fichier se lance donc explicitement —
 * `npx vitest run --config scripts/vitest.scripts.config.ts scripts/check-budget.test.ts`
 * — et le contrôle lui-même reste exécutable sans vitest :
 * `node scripts/check-budget.mjs`.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(import.meta.dirname, "..");
const SCRIPT = join(RACINE, "scripts", "check-budget.mjs");

/** Le bloc `on:` d'un workflow qui tourne sur les PR. */
const SUR_PR = "on:\n  pull_request:\n";
/** Le bloc `on:` d'un workflow qui ne tourne jamais sur les PR. */
const HORS_PR = "on:\n  push:\n    branches: [main]\n";

/** Un dépôt témoin : un dossier de workflows et les fichiers donnés. */
function temoin(workflows: Record<string, string>): string {
  const racine = mkdtempSync(join(tmpdir(), "check-budget-"));
  const dossier = join(racine, ".github", "workflows");
  mkdirSync(dossier, { recursive: true });
  for (const [nom, contenu] of Object.entries(workflows)) {
    writeFileSync(join(dossier, nom), contenu);
  }
  return racine;
}

/** Un workflow témoin : le bloc `on:` et le bloc `jobs:`. */
function workflow(declencheur: string, corps: string): string {
  return `name: témoin\n\n${declencheur}\njobs:\n${corps}\n`;
}

/**
 * Un job témoin : son budget, sa tolérance à l'échec, ses étapes.
 * Le budget s'écrit tel quel : « 25 # nuit : fuzz long » porte sa
 * justification sur la même ligne, comme la règle l'exige.
 */
function job(options: { nom?: string; timeout?: string; continueOnError?: string }): string {
  const lignes = [
    `  ${options.nom ?? "garde"}:`,
    "    runs-on: [self-hosted, thin-air-worker]",
  ];
  if (options.timeout !== undefined) lignes.push(`    timeout-minutes: ${options.timeout}`);
  if (options.continueOnError !== undefined) {
    lignes.push(`    continue-on-error: ${options.continueOnError}`);
  }
  lignes.push("    steps:", "      - run: echo ok");
  return `${lignes.join("\n")}\n`;
}

/** Lance le contrôle sur une racine et rend son code de sortie et sa sortie. */
function controler(racine: string): { code: number | null; sortie: string } {
  const r = spawnSync(process.execPath, [SCRIPT, racine], { cwd: racine, encoding: "utf8" });
  return { code: r.status, sortie: `${r.stdout}\n${r.stderr}` };
}

describe("contrôle du budget CI", () => {
  it("accepte un job de PR à 3 min", () => {
    const r = controler(temoin({ "pr.yml": workflow(SUR_PR, job({ timeout: "3" })) }));
    expect(r.code).toBe(0);
    expect(r.sortie).toContain("0 erreur(s)");
  });

  it("refuse un job de PR à 8 min, en nommant le fichier, le job et la valeur", () => {
    const r = controler(temoin({ "pr.yml": workflow(SUR_PR, job({ timeout: "8" })) }));
    expect(r.code).toBe(1);
    expect(r.sortie).toContain("pr.yml");
    expect(r.sortie).toContain("garde");
    expect(r.sortie).toContain("8 > 5");
  });

  it("refuse un job sans timeout", () => {
    const r = controler(temoin({ "pr.yml": workflow(SUR_PR, job({})) }));
    expect(r.code).toBe(1);
    expect(r.sortie).toContain("aucun timeout-minutes");
  });

  it("refuse un job de PR en continue-on-error", () => {
    const r = controler(
      temoin({ "pr.yml": workflow(SUR_PR, job({ timeout: "5", continueOnError: "true" })) }),
    );
    expect(r.code).toBe(1);
    expect(r.sortie).toContain("continue-on-error: true");
  });

  it("refuse un job de PR en continue-on-error écrit en booléen YAML", () => {
    const r = controler(
      temoin({ "pr.yml": workflow(SUR_PR, job({ timeout: "5", continueOnError: "True" })) }),
    );
    expect(r.code).toBe(1);
  });

  it("accepte un continue-on-error: false sur une PR", () => {
    const r = controler(
      temoin({ "pr.yml": workflow(SUR_PR, job({ timeout: "5", continueOnError: "false" })) }),
    );
    expect(r.code).toBe(0);
  });

  it("accepte un job hors PR plus long, justification écrite", () => {
    const r = controler(
      temoin({ "nuit.yml": workflow(HORS_PR, job({ timeout: "25 # nuit : fuzz long" })) }),
    );
    expect(r.code).toBe(0);
  });

  it("refuse un job hors PR plus long sans justification écrite", () => {
    const r = controler(temoin({ "nuit.yml": workflow(HORS_PR, job({ timeout: "25" })) }));
    expect(r.code).toBe(1);
    expect(r.sortie).toContain("sans justification");
  });

  it("refuse un job hors PR sans timeout", () => {
    const r = controler(temoin({ "nuit.yml": workflow(HORS_PR, job({})) }));
    expect(r.code).toBe(1);
    expect(r.sortie).toContain("aucun timeout-minutes");
  });

  it("accepte un continue-on-error hors PR", () => {
    const r = controler(
      temoin({ "build.yml": workflow(HORS_PR, job({ timeout: "5", continueOnError: "true" })) }),
    );
    expect(r.code).toBe(0);
  });

  it("passe sur le dépôt réel", () => {
    const r = controler(RACINE);
    expect(r.code).toBe(0);
    expect(r.sortie).toContain("0 erreur(s)");
  });
});
