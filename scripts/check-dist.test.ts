/**
 * Le contrôle du site construit (`scripts/check-dist.mjs`) exécuté pour de
 * vrai, sur des dossiers témoins : il distingue une URL réellement demandée
 * d'une chaîne présente dans un fichier.
 *
 *   - une origine tierce dans NOTRE code fait échouer le contrôle (AIR-N-01) ;
 *   - une chaîne Google dans le code tiers servi par le site (MediaPipe et son
 *     chargeur) est ignorée, mais signalée dans la liste imprimée.
 *
 * `vitest.config.ts` est gelé (docs/CONTRACT.md) et ne ramasse que
 * `packages/*|apps/*` : ce fichier se lance donc explicitement —
 * `npx vitest run --config scripts/vitest.scripts.config.ts scripts/check-dist.test.ts`
 * — et le contrôle lui-même reste exécutable sans vitest :
 * `node scripts/check-dist.mjs`.
 *
 * Aucun son, aucune requête réseau : les témoins sont des fichiers texte dans
 * un dossier temporaire.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(import.meta.dirname, "..");
const SCRIPT = join(RACINE, "scripts", "check-dist.mjs");

/** Un site témoin : un dossier `dist` avec les fichiers texte donnés. */
function temoin(fichiers: Record<string, string>): string {
  const racine = mkdtempSync(join(tmpdir(), "check-dist-"));
  for (const [nom, contenu] of Object.entries(fichiers)) {
    const chemin = join(racine, "dist", nom);
    mkdirSync(dirname(chemin), { recursive: true });
    writeFileSync(chemin, contenu);
  }
  return racine;
}

/** Lance le contrôle sur le dossier `dist` du témoin, et rend code + sortie. */
function controler(racine: string): { code: number | null; sortie: string } {
  const r = spawnSync(process.execPath, [SCRIPT, "dist"], { cwd: racine, encoding: "utf8" });
  return { code: r.status, sortie: `${r.stdout}\n${r.stderr}` };
}

/** La chaîne Google réellement présente dans le paquet MediaPipe embarqué. */
function googleDansMediaPipe(fichier: string): Record<string, string> {
  return { [fichier]: `url:"https://odml.pa.googleapis.com/v1/log",\n` };
}

describe("contrôle du site construit (check-dist.mjs)", () => {
  it("refuse une vraie origine tierce dans notre code (AIR-N-01)", () => {
    const r = controler(temoin({ "assets/notre-code.js": "fetch('https://attacker.example/bidon');\n" }));
    expect(r.code).toBe(1);
    expect(r.sortie).toContain("attacker.example");
    expect(r.sortie).toContain("notre-code.js");
    expect(r.sortie).toContain("AIR-N-01");
  });

  it("ignore les chaînes Google du paquet MediaPipe et du worker, mais les dit", () => {
    const r = controler(
      temoin({
        ...googleDansMediaPipe("assets/vision_bundle-abc.js"),
        ...googleDansMediaPipe("assets/analysis-worker-def.js"),
        ...googleDansMediaPipe("models/wasm/vision_wasm_internal.js"),
        ...googleDansMediaPipe("models/wasm/vision_wasm_module_internal.js"),
      }),
    );
    expect(r.code).toBe(0);
    expect(r.sortie).toContain("aucune origine tierce");
    expect(r.sortie).toContain("vision_bundle-abc.js");
    expect(r.sortie).toContain("analysis-worker-def.js");
    expect(r.sortie).toContain("vision_wasm_internal.js");
    expect(r.sortie).toContain("vision_wasm_module_internal.js");
  });

  it("refuse un fichier sonore publié (AIR-F-25)", () => {
    const r = controler(temoin({ "audio/sample.wav": "RIFF....WAVE...." }));
    expect(r.code).toBe(1);
    expect(r.sortie).toContain("sample.wav");
    expect(r.sortie).toContain("AIR-F-25");
  });

  it("sort 2 et explique la marche à suivre si le dossier est absent", () => {
    // La racine existe, mais sans dossier `dist` : le contrôle le signale.
    const r = controler(mkdtempSync(join(tmpdir(), "check-dist-")));
    expect(r.code).toBe(2);
    expect(r.sortie).toContain("npm run build");
  });
});
