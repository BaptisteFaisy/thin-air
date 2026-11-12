/**
 * Le script de poids de publication (`scripts/poids-publication.mjs`) exécuté
 * pour de vrai : sur le site construit (`apps/web/dist` s'il existe, sinon on
 * le construit), sur un dossier témoin qui contient le doublon de 14 Mo (les
 * deux variantes de wasm publiées ensemble), sur un témoin sans doublon, et
 * sur un dossier absent.
 *
 * `vitest.config.ts` est gelé (docs/CONTRACT.md) et ne ramasse que
 * `packages/*|apps/*` : ce fichier se lance donc explicitement — comme
 * `scripts/pack-check.test.ts` —
 * `npx vitest run --config <config incluant scripts/**> scripts/poids-publication.test.ts`
 * et le script lui-même reste exécutable sans vitest :
 * `node scripts/poids-publication.mjs`.
 *
 * Aucun son, aucune requête réseau : le build lancé ici est le build vite du
 * dépôt, et les témoins sont des fichiers texte dans un dossier temporaire.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(import.meta.dirname, "..");
const SCRIPT = join(RACINE, "scripts", "poids-publication.mjs");
const DIST = join(RACINE, "apps", "web", "dist");

function lance(cible?: string): { status: number | null; sortie: string } {
  const args = cible ? [SCRIPT, cible] : [SCRIPT];
  const r = spawnSync(process.execPath, args, { cwd: RACINE, encoding: "utf8" });
  return { status: r.status, sortie: `${r.stdout}\n${r.stderr}` };
}

/** Construit le site si `apps/web/dist` n'existe pas encore (énoncé du lot). */
function distConstruit(): void {
  if (existsSync(DIST)) return;
  const build = spawnSync("npm", ["run", "build"], { cwd: RACINE, encoding: "utf8" });
  expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);
}

/** Dossier témoin : une page, et les deux variantes de wasm côte à côte. */
function temoin(avecDoublon: boolean): string {
  const racine = mkdtempSync(join(tmpdir(), "poids-publication-"));
  const wasm = join(racine, "models", "wasm");
  mkdirSync(wasm, { recursive: true });
  writeFileSync(join(wasm, "vision_wasm_internal.wasm"), "moteur non-module\n");
  writeFileSync(join(wasm, "vision_wasm_internal.js"), "chargeur non-module\n");
  if (avecDoublon) {
    writeFileSync(join(wasm, "vision_wasm_module_internal.wasm"), "moteur module\n");
    writeFileSync(join(wasm, "vision_wasm_module_internal.js"), "chargeur module\n");
  }
  writeFileSync(join(racine, "index.html"), "<!doctype html>\n");
  return racine;
}

describe("poids-publication.mjs", () => {
  it("liste le site construit, fichier par fichier, avec le total", () => {
    distConstruit();
    const r = lance();
    expect(r.status).toBe(0);
    expect(r.sortie).toContain("index.html");
    expect(r.sortie).toContain("total publié :");
    expect(r.sortie).toContain("octets");
  }, 240_000);

  it("signale le doublon quand les deux variantes de wasm sont publiées", () => {
    const r = lance(temoin(true));
    expect(r.status).toBe(0);
    expect(r.sortie).toContain("DOUBLON");
    expect(r.sortie).toContain("vision_wasm_module_internal.wasm");
    expect(r.sortie).toContain("vision_wasm_module_internal.js");
  });

  it("dit l'absence de doublon quand une seule variante est publiée", () => {
    const r = lance(temoin(false));
    expect(r.status).toBe(0);
    expect(r.sortie).toContain("aucun doublon de 14 Mo");
    expect(r.sortie).not.toContain("DOUBLON");
  });

  it("sort non nul si le dossier est absent, avec la marche à suivre", () => {
    const r = lance(join(mkdtempSync(join(tmpdir(), "poids-publication-")), "absent"));
    expect(r.status).toBe(1);
    expect(r.sortie).toContain("introuvable");
    expect(r.sortie).toContain("npm run build");
  });
});
