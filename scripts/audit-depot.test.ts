/**
 * L'audit du dépôt, sur un dossier de témoins.
 *
 * Le dossier témoin contient exactement quatre situations que le rapport
 * doit montrer : un fichier de code trop long, un `todo(` oublié, un export
 * orphelin et une dépendance déclarée jamais utilisée. Le rapport doit
 * contenir une ligne pour chacune.
 *
 * `vitest.config.ts` est gelé (`docs/CONTRACT.md`) et ne ramasse que
 * `packages/*` et `apps/*` : ce banc se lance donc explicitement —
 * `npx vitest run --config scripts/vitest.scripts.config.ts scripts/audit-depot.test.ts`.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { it } from "vitest";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(RACINE, "scripts", "audit-depot.mjs");

/** Un dossier témoin : quatre situations, rien d'autre. */
function temoin(): string {
  const racine = mkdtempSync(join(tmpdir(), "audit-depot-"));
  ecrire(racine, "package.json", JSON.stringify({
    name: "temoin",
    private: true,
    type: "module",
    dependencies: { "paquet-inutile": "^1.0.0" },
  }));
  ecrire(racine, "packages/core/src/index.ts", [
    'export * from "./gros.js";',
    'export * from "./musique.js";',
    "",
  ].join("\n"));
  ecrire(racine, "packages/core/src/musique.ts", [
    "export function noteName(midi: number): string {",
    '  if (!Number.isFinite(midi)) return todo("music.noteName", "A3");',
    '  return "A3";',
    "}",
    "",
  ].join("\n"));
  ecrire(racine, "packages/core/src/orphelin.ts", [
    "export function jamaisAppele(): number {",
    "  return 42;",
    "}",
    "",
  ].join("\n"));
  ecrire(racine, "packages/core/src/gros.ts", `${Array.from(
    { length: 600 },
    (_, i) => `export const valeur${i} = ${i};`,
  ).join("\n")}\n`);
  return racine;
}

/** Écrit un fichier, en créant les dossiers manquants. */
function ecrire(racine: string, relatif: string, contenu: string): void {
  const chemin = join(racine, relatif);
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, contenu, "utf8");
}

/** Lance l'audit sur le dossier témoin et rend son rapport et son JSON. */
function auditer(racine: string): { rapport: string; json: any; code: number } {
  const cheminJson = join(racine, "out", "audit.json");
  const cheminMd = join(racine, "docs", "audit-depot.md");
  const resultat = spawnSync(process.execPath, [
    SCRIPT, racine, "--json", cheminJson, "--md", cheminMd, "--sans-github",
  ], { encoding: "utf8" });
  assert.equal(resultat.status, 0, `l'audit doit sortir 0 : ${resultat.stderr}`);
  const json = JSON.parse(readFileSync(cheminJson, "utf8"));
  const rapport = readFileSync(cheminMd, "utf8");
  return { rapport, json, code: resultat.status ?? 1 };
}

/** La ligne du rapport qui parle du fichier (une ligne de constat, pas le résumé). */
function ligneDuRapport(rapport: string, motif: RegExp): string {
  const ligne = rapport
    .split("\n")
    .find((candidat) => candidat.startsWith("- ") && motif.test(candidat));
  assert.ok(ligne, `le rapport doit contenir une ligne pour ${motif}`);
  return ligne;
}

it("l'audit montre une ligne par situation du dossier témoin", () => {
  const { rapport, json } = auditer(temoin());

  const long = ligneDuRapport(rapport, /gros\.ts/);
  assert.match(long, /600 lignes/);

  const todo = ligneDuRapport(rapport, /todo\(/);
  assert.match(todo, /musique\.ts/);

  const orphelin = ligneDuRapport(rapport, /orphelin\.ts/);
  assert.match(orphelin, /jamais importé/);

  const dependance = ligneDuRapport(rapport, /paquet-inutile/);
  assert.match(dependance, /jamais importé/);

  assert.equal(json.fichiersTropLongs.length, 1);
  assert.equal(json.todos.length, 1);
  assert.equal(json.exportsOrphelins.length, 1);
  assert.equal(json.dependancesInutiles.length, 1);
  assert.equal(json.exportsOrphelins[0].fichier, "packages/core/src/orphelin.ts");
  assert.equal(json.dependancesInutiles[0].nom, "paquet-inutile");
});

it("l'audit n'écrit rien hors du dossier qu'on lui donne", () => {
  const racine = temoin();
  const { json } = auditer(racine);
  assert.equal(json.racine, racine);
  assert.equal(json.github.disponible, false);
});
