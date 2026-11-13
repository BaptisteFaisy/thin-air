/**
 * Le contrôle du repli processeur (`scripts/check-wasm.mjs`) exécuté pour de
 * vrai, sur des dossiers témoins : une variante manquante doit être refusée,
 * toutes les variantes présentes doivent être acceptées, et la preuve doit
 * manquer si le paquet ne dit plus rien.
 *
 * `vitest.config.ts` est gelé (docs/CONTRACT.md) et ne ramasse que
 * `packages/*|apps/*` : ce fichier se lance donc explicitement — comme
 * `scripts/pack-check.test.ts` —
 * `npx vitest run --config scripts/vitest.scripts.config.ts scripts/check-wasm.test.ts`
 * et le script lui-même reste exécutable sans vitest :
 * `node scripts/check-wasm.mjs`.
 *
 * Aucun son, aucune requête réseau : les témoins sont des fichiers texte
 * dans un dossier temporaire, et le paquet de MediaPipe est remplacé par un
 * faux paquet qui reproduit la règle de nommage (jamais le bundle réel).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(import.meta.dirname, "..");
const SCRIPT = join(RACINE, "scripts", "check-wasm.mjs");

/**
 * Le faux paquet : la règle de nommage et le choix du délégué, recopiés pour
 * que le contrôle travaille sur une entrée stable. Le délégué est placé loin
 * de la règle, comme dans le paquet réel.
 */
const BUNDLE_TEMOIN = [
  'function sh(t,e,r){return r=`wasm${r?"_module":""}_internal`,Promise.resolve({',
  "wasmLoaderPath:`${e}/${t}_${r}.js`,wasmBinaryPath:`${e}/${t}_${r}.wasm`})}",
  `/* ${"remplissage ".repeat(40)} */`,
  'oh.forVisionTasks=function(t,e=!1){return sh("vision",t,e)}',
  `/* ${"remplissage ".repeat(40)} */`,
  '"GPU"===e.delegate?(a=n):(b=m);',
].join("\n");

/** Le paquet témoin : les quatre fichiers d'exécution, et un bundle lisible. */
function paquetTemoin(sansRegle = false): string {
  const racine = mkdtempSync(join(tmpdir(), "check-wasm-paquet-"));
  const wasm = join(racine, "wasm");
  mkdirSync(wasm, { recursive: true });
  for (const nom of [
    "vision_wasm_internal.js",
    "vision_wasm_internal.wasm",
    "vision_wasm_module_internal.js",
    "vision_wasm_module_internal.wasm",
  ]) {
    writeFileSync(join(wasm, nom), "faux moteur\n");
  }
  writeFileSync(
    join(racine, "vision_bundle.mjs"),
    sansRegle ? "export const rien = 1;\n" : BUNDLE_TEMOIN,
  );
  return racine;
}

/** Les sources du site : l'appel à `forVisionTasks` et le service worker. */
function sourcesTemoins(indicateur = "", worker = ""): string {
  const racine = mkdtempSync(join(tmpdir(), "check-wasm-sources-"));
  const vision = join(racine, "packages", "vision", "src");
  mkdirSync(vision, { recursive: true });
  writeFileSync(
    join(vision, "landmarker-core.ts"),
    `const fileset = await module.FilesetResolver.forVisionTasks(wasmRoot${indicateur});\n`,
  );
  const sw = join(racine, "public");
  mkdirSync(sw, { recursive: true });
  writeFileSync(
    join(sw, "sw.js"),
    `const LOURDS = ["models/hand_landmarker.task",${worker}].map((c) => c);\n`,
  );
  return racine;
}

/** Le dossier publié : les fichiers d'exécution qu'il contient. */
function publieTemoin(noms: string[]): string {
  const racine = mkdtempSync(join(tmpdir(), "check-wasm-publie-"));
  const wasm = join(racine, "models", "wasm");
  mkdirSync(wasm, { recursive: true });
  for (const nom of noms) writeFileSync(join(wasm, nom), "faux moteur\n");
  return join(racine, "models", "wasm");
}

function lance(paquet: string, publie: string, sources: string) {
  const args = [SCRIPT, "--paquet", paquet, "--publie", publie, "--sources", sources];
  const r = spawnSync(process.execPath, args, { cwd: RACINE, encoding: "utf8" });
  return { status: r.status, sortie: `${r.stdout}\n${r.stderr}` };
}

describe("check-wasm.mjs", () => {
  it("refuse quand la variante demandée n'est pas publiée", () => {
    const paquet = paquetTemoin();
    const publie = publieTemoin(["vision_wasm_internal.js"]); // le moteur manque
    const sources = sourcesTemoins();
    const r = lance(paquet, publie, sources);
    expect(r.status).toBe(1);
    expect(r.sortie).toContain("repli processeur NON GARANTI");
    expect(r.sortie).toContain("vision_wasm_internal.wasm");
    rmSync(paquet, { recursive: true, force: true });
  });

  it("accepte quand la variante demandée est publiée, et prouve pourquoi", () => {
    const paquet = paquetTemoin();
    const publie = publieTemoin(["vision_wasm_internal.js", "vision_wasm_internal.wasm"]);
    const sources = sourcesTemoins();
    const r = lance(paquet, publie, sources);
    expect(r.status).toBe(0);
    expect(r.sortie).toContain("repli processeur GARANTI");
    expect(r.sortie).toContain("vision_wasm_internal");
    expect(r.sortie).toContain("forVisionTasks");
    rmSync(paquet, { recursive: true, force: true });
  });

  it("exige la variante module quand un appel du site la demande", () => {
    const paquet = paquetTemoin();
    const publie = publieTemoin(["vision_wasm_internal.js", "vision_wasm_internal.wasm"]);
    const sources = sourcesTemoins(", true");
    const r = lance(paquet, publie, sources);
    expect(r.status).toBe(1);
    expect(r.sortie).toContain("vision_wasm_module_internal.wasm");
    rmSync(paquet, { recursive: true, force: true });
  });

  it("accepte la variante module quand elle est publiée et demandée", () => {
    const paquet = paquetTemoin();
    const publie = publieTemoin([
      "vision_wasm_internal.js",
      "vision_wasm_internal.wasm",
      "vision_wasm_module_internal.js",
      "vision_wasm_module_internal.wasm",
    ]);
    const sources = sourcesTemoins(", true");
    const r = lance(paquet, publie, sources);
    expect(r.status).toBe(0);
    expect(r.sortie).toContain("repli processeur GARANTI");
    rmSync(paquet, { recursive: true, force: true });
  });

  it("refuse quand la preuve est impossible : le paquet ne dit plus rien", () => {
    const paquet = paquetTemoin(true);
    const publie = publieTemoin(["vision_wasm_internal.js", "vision_wasm_internal.wasm"]);
    const sources = sourcesTemoins();
    const r = lance(paquet, publie, sources);
    expect(r.status).toBe(1);
    expect(r.sortie).toContain("règle de nommage");
    rmSync(paquet, { recursive: true, force: true });
  });

  it("refuse quand le service worker demande un fichier non publié", () => {
    const paquet = paquetTemoin();
    const publie = publieTemoin(["vision_wasm_internal.js", "vision_wasm_internal.wasm"]);
    const sources = sourcesTemoins(
      "",
      '"models/wasm/vision_wasm_module_internal.wasm"',
    );
    const r = lance(paquet, publie, sources);
    expect(r.status).toBe(1);
    expect(r.sortie).toContain("service worker");
    rmSync(paquet, { recursive: true, force: true });
  });
});
