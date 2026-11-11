/**
 * La garde de publication (`scripts/pack-check.mjs`) exécutée sur le dépôt
 * réel, plus deux dépôts témoins qui doivent être refusés.
 *
 * `vitest.config.ts` est gelé (docs/CONTRACT.md) et ne ramasse que
 * `packages/*|apps/*` : ce fichier se lance donc explicitement —
 * `npx vitest run --config <config incluant scripts/**> scripts/pack-check.test.ts`
 * — et la garde elle-même reste exécutable sans vitest : `node scripts/pack-check.mjs`.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(import.meta.dirname, "..");
const SCRIPT = join(RACINE, "scripts", "pack-check.mjs");

function lance(racine: string): { status: number | null; sortie: string } {
  const r = spawnSync(process.execPath, [SCRIPT, racine], { cwd: racine, encoding: "utf8" });
  return { status: r.status, sortie: `${r.stdout}\n${r.stderr}` };
}

/** Un dépôt témoin minimal : un seul paquet `core`, sans garde sonore. */
function temoin(paquet: { manifeste: object; fichiers: Record<string, string> }): string {
  const racine = mkdtempSync(join(tmpdir(), "pack-check-"));
  writeFileSync(join(racine, "package.json"), JSON.stringify({ name: "temoin", workspaces: [], devDependencies: {} }));
  const src = join(racine, "packages", "core", "src");
  mkdirSync(src, { recursive: true });
  mkdirSync(join(racine, "scripts", "hooks"), { recursive: true });
  writeFileSync(join(racine, "scripts", "hooks", "no-audio-asset-guard.mjs"), "process.exit(0);\n");
  writeFileSync(join(racine, "packages", "core", "package.json"), JSON.stringify(paquet.manifeste));
  for (const [nom, contenu] of Object.entries(paquet.fichiers)) {
    writeFileSync(join(src, nom), contenu);
  }
  return racine;
}

const MANIFESTE_OK = { name: "@thin-air/core", version: "0.1.0", type: "module", license: "MIT" };

describe("pack-check.mjs", () => {
  it("sort 0 sur le dépôt réel et annonce les trois paquets", () => {
    const r = lance(RACINE);
    expect(r.sortie).toContain("@thin-air/core");
    expect(r.sortie).toContain("@thin-air/audio");
    expect(r.sortie).toContain("@thin-air/schema");
    expect(r.sortie).toContain("aucun fichier sonore");
    expect(r.status).toBe(0);
  }, 60_000);

  it("refuse un manifeste sans version (code non nul)", () => {
    const { version: _absent, ...sansVersion } = MANIFESTE_OK;
    const r = lance(temoin({ manifeste: sansVersion, fichiers: { "index.ts": "export const a = 1;\n" } }));
    expect(r.status).not.toBe(0);
    expect(r.sortie).toContain("version");
  });

  it("refuse un fichier source orphelin, joignable depuis aucune entrée", () => {
    const r = lance(
      temoin({
        manifeste: MANIFESTE_OK,
        fichiers: { "index.ts": "export const a = 1;\n", "mort.ts": "export const b = 2;\n" },
      }),
    );
    expect(r.status).not.toBe(0);
    expect(r.sortie).toContain("orphelin");
  });

  it("refuse l'import d'un paquet non déclaré en dépendance", () => {
    const r = lance(
      temoin({
        manifeste: MANIFESTE_OK,
        fichiers: { "index.ts": 'import gauche from "left-pad";\nexport default gauche;\n' },
      }),
    );
    expect(r.status).not.toBe(0);
    expect(r.sortie).toContain("left-pad");
  });
});
