/**
 * La garde de dérive des prises de référence.
 *
 * Les prises de `takes/reference/` sont figées, mais elles sont produites par
 * un générateur (`make-reference-takes.ts`, formes du lot B1). Si le générateur
 * change sans que les fichiers soient regelés — ou l'inverse —, une prise
 * dériverait sans que personne ne le voie. Le générateur sait se vérifier
 * lui-même (`--check`) : ce test le lance et exige zéro écart.
 *
 * Le second test prouve que la garde mord : sur une copie altérée dans un
 * dossier temporaire, `--check` doit échouer. Rien n'est écrit dans le dépôt.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { REFERENCE_TAKES } from "./takes.js";

const GENERATEUR = "apps/bench/src/make-reference-takes.ts";

/** Le tsx du dépôt, lancé par Node directement (pas de `npx`, plus lent). */
function tsx(): string {
  const local = join("node_modules", ".bin", "tsx");
  return existsSync(local) ? local : "tsx";
}

/** Lance le générateur et rend son code de sortie avec sa sortie complète. */
function generer(...args: string[]): { code: number; sortie: string } {
  const resultat = spawnSync(tsx(), [GENERATEUR, ...args], { cwd: process.cwd(), encoding: "utf8" });
  return { code: resultat.status ?? -1, sortie: `${resultat.stdout ?? ""}${resultat.stderr ?? ""}` };
}

describe("garde de dérive des prises (make-reference-takes --check)", () => {
  it("les prises figées sont exactement ce que le générateur produit aujourd'hui", () => {
    const { code, sortie } = generer("--check");
    expect(code, sortie).toBe(0);
    expect(sortie).toContain("0 écart(s)");
    for (const spec of REFERENCE_TAKES) expect(sortie, `prise non vérifiée : ${spec.name}`).toContain(`✓ ${spec.name}`);
  });

  it("une prise altérée est refusée : la garde mord", () => {
    const dir = mkdtempSync(join(tmpdir(), "prises-derive-"));
    try {
      for (const spec of REFERENCE_TAKES) cpSync(`takes/reference/${spec.name}.json`, join(dir, `${spec.name}.json`));
      const victime = join(dir, "left-hand-only.json");
      const prise = JSON.parse(readFileSync(victime, "utf8")) as { frames: { u: number }[] };
      const premiere = prise.frames[0];
      if (premiere !== undefined) premiere.u += 0.01;
      writeFileSync(victime, JSON.stringify(prise));
      const { code, sortie } = generer("--check", "--dir", dir);
      expect(code, sortie).toBe(1);
      expect(sortie).toContain("✗ left-hand-only");
      expect(sortie).toContain("ne correspond plus au générateur");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
