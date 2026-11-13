/**
 * Le contrôle de la publication (`scripts/check-deployed.mjs`) éprouvé contre
 * un serveur HTTP local éphémère (`node:http`, port aléatoire) : AUCUN accès
 * au site réel, aucun octet du vrai modèle, aucun son.
 *
 * `vitest.config.ts` est gelé (docs/CONTRACT.md) et ne ramasse que
 * `packages/*|apps/*` : ce fichier tourne donc avec le banc des scripts,
 * sans dépendance ajoutée —
 *   npx vitest run --config vitest.scripts.config.ts scripts/check-deployed.test.ts
 * Le script reste exécutable directement : `node scripts/check-deployed.mjs`.
 *
 * Quatre cas, tous locaux : le bundle servi est identique au bundle construit
 * (code 0), il en diffère (code 1), il ne fait que 9 Kio (code 1, publication
 * incomplète), et le réseau manque (code 2, vérification impossible).
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, it } from "vitest";

const RACINE = join(import.meta.dirname, "..");
const SCRIPT = join(RACINE, "scripts", "check-deployed.mjs");
const BASE = "/thin-air/";
const BUNDLE = `${BASE}assets/index-TEST00001.js`;
const MODELE = `${BASE}models/hand_landmarker.task`;
const WASM_JS = `${BASE}models/wasm/vision_wasm_internal.js`;
const WASM_WASM = `${BASE}models/wasm/vision_wasm_internal.wasm`;

/** Un bundle plausible : plus de 50 Kio, pour passer le contrôle de taille. */
const GROS_BUNDLE = "// bundle de démonstration\n".repeat(4000);
/** Le bundle résiduel de l'incident : 9 Kio, servit pendant des heures. */
const PETIT_BUNDLE = "// bundle résiduel\n".repeat(600);

const MODELES = {
  [MODELE]: "modèle de démonstration",
  [WASM_JS]: "chargeur de démonstration",
  [WASM_WASM]: "moteur de démonstration",
};

const serveurs = [];
const dossiers = [];

/** La page publique : elle nomme le bundle, comme la page construite. */
function page(nomBundle: string): string {
  return (
    `<!doctype html><html><head>` +
    `<script type="module" crossorigin src="${BASE}assets/${nomBundle}"></script>` +
    `</head><body></body></html>`
  );
}

/**
 * Un build local témoin : `index.html` et le bundle qu'il nomme, dans un
 * dossier temporaire.
 */
function buildLocal(contenu: string, nomBundle = "index-TEST00001.js"): string {
  const racine = mkdtempSync(join(tmpdir(), "check-deployed-build-"));
  dossiers.push(racine);
  mkdirSync(join(racine, "assets"), { recursive: true });
  writeFileSync(join(racine, "index.html"), page(nomBundle), "utf8");
  writeFileSync(join(racine, "assets", nomBundle), contenu, "utf8");
  return racine;
}

/** Un serveur éphémère sur 127.0.0.1, port 0 ; `bundle` peut être absent. */
async function serveur(bundle: string | null, nomBundle = "index-TEST00001.js", sansModele = false) {
  const http = createServer((requete, reponse) => {
    const chemin = decodeURIComponent(new URL(requete.url ?? "/", "http://localhost").pathname);
    const corps = corpsDe(chemin, bundle, nomBundle, sansModele);
    if (corps === null) {
      reponse.writeHead(404, { "content-type": "text/plain" }).end("absent");
      return;
    }
    reponse.writeHead(200, {
      "content-type": typeDe(chemin),
      "content-length": Buffer.byteLength(corps, "utf8"),
    });
    reponse.end(corps);
  });
  await new Promise((resoudre) => http.listen(0, "127.0.0.1", resoudre));
  const port = (http.address() as { port: number }).port;
  const instance = {
    url: `http://127.0.0.1:${port}${BASE}`,
    ferme: () => new Promise((resoudre) => http.close(resoudre)),
  };
  serveurs.push(instance);
  return instance;
}

/** Le corps servi pour un chemin, ou `null` quand le chemin n'existe pas. */
function corpsDe(
  chemin: string,
  bundle: string | null,
  nomBundle: string,
  sansModele: boolean,
): string | null {
  if (chemin === BASE) return page(nomBundle);
  if (bundle !== null && chemin === `${BASE}assets/${nomBundle}`) return bundle;
  if (sansModele) return null;
  const modele = MODELES[chemin as keyof typeof MODELES];
  return modele ?? null;
}

/** Le Content-Type d'un chemin : le script n'en tient pas compte, le serveur si. */
function typeDe(chemin: string): string {
  if (chemin.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (chemin.endsWith(".wasm")) return "application/wasm";
  if (chemin.endsWith(".task")) return "application/octet-stream";
  return "text/html; charset=utf-8";
}

/**
 * Lance le script. Asynchrone : `spawnSync` figerait la boucle du test, donc
 * le serveur local ne pourrait pas répondre à l'enfant — deadlock garanti.
 */
function lance(url: string, dist: string): Promise<{ code: number | null; sortie: string }> {
  return new Promise((resoudre, rejeter) => {
    const enfant = spawn(process.execPath, [SCRIPT, "--url", url, "--dist", dist], {
      cwd: RACINE,
    });
    const morceaux: string[] = [];
    for (const flux of [enfant.stdout, enfant.stderr]) {
      flux.setEncoding("utf8");
      flux.on("data", (morceau) => morceaux.push(morceau));
    }
    enfant.on("error", rejeter);
    enfant.on("close", (code) => resoudre({ code, sortie: morceaux.join("") }));
  });
}

afterAll(async () => {
  for (const site of serveurs) await site.ferme();
  for (const dossier of dossiers) rmSync(dossier, { recursive: true, force: true });
});

describe("AIR-N-13 — la publication est vérifiée après coup", () => {
  it("un bundle servi identique au bundle construit → code 0", async () => {
    const site = await serveur(GROS_BUNDLE);
    const r = await lance(site.url, buildLocal(GROS_BUNDLE));
    assert.equal(r.code, 0, r.sortie);
    assert.match(r.sortie, /site public conforme/);
  });

  it("un bundle servi différent du bundle construit → code 1, le SHA en cause", async () => {
    const site = await serveur(GROS_BUNDLE);
    const r = await lance(site.url, buildLocal("// autre bundle\n".repeat(4000)));
    assert.equal(r.code, 1, r.sortie);
    assert.match(r.sortie, /ne sert pas le bundle construit/);
  });

  it("un bundle de 9 Kio → code 1, publication incomplète", async () => {
    const site = await serveur(PETIT_BUNDLE);
    const r = await lance(site.url, buildLocal(PETIT_BUNDLE));
    assert.equal(r.code, 1, r.sortie);
    assert.match(r.sortie, /publication incomplète/);
  });

  it("le modèle absent du site public → code 1, le chemin est nommé", async () => {
    const site = await serveur(GROS_BUNDLE, "index-TEST00001.js", true);
    const r = await lance(site.url, buildLocal(GROS_BUNDLE));
    assert.equal(r.code, 1, r.sortie);
    assert.match(r.sortie, /n'est pas servi par le site public/);
  });

  it("sans réseau → code 2, la vérification est impossible", async () => {
    const site = await serveur(GROS_BUNDLE);
    await site.ferme();
    const r = await lance(site.url, buildLocal(GROS_BUNDLE));
    assert.equal(r.code, 2, r.sortie);
    assert.match(r.sortie, /vérification impossible/);
  });
});
