#!/usr/bin/env node
/**
 * La sonde de disponibilité (`scripts/sonde-dispo.mjs`) éprouvée contre un
 * serveur HTTP local éphémère (`node:http`, port aléatoire) : AUCUN réseau
 * extérieur, aucun octet du vrai modèle — le serveur répond avec des corps de
 * quelques octets, exactement comme la sonde n'en demande jamais davantage.
 *
 * `vitest.config.ts` est gelé (docs/CONTRACT.md) et ne ramasse que
 * `packages/*|apps/*` : ce fichier tourne donc avec le banc standard de Node,
 * sans dépendance ajoutée —
 *   node --test scripts/sonde-dispo.test.mjs
 * Il reste exécutable directement : `node scripts/sonde-dispo.test.mjs`.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const RACINE = join(import.meta.dirname, "..");
const SONDE = join(RACINE, "scripts", "sonde-dispo.mjs");
const BASE = "/thin-air/";
const JS = `${BASE}assets/index-test.js`;
const MODELE = `${BASE}models/hand_landmarker.task`;
const WASM = `${BASE}models/wasm/vision_wasm_internal.wasm`;

const PAGE = `<!doctype html><html><head>
<script type="module" crossorigin src="${JS}"></script></head><body></body></html>`;

/** Réponses par défaut : tout est servi, typé et caché. */
function saines() {
  return {
    [`${BASE}`]: { statut: 200, type: "text/html; charset=utf-8", cache: "max-age=600", corps: PAGE },
    [JS]: { statut: 200, type: "application/javascript; charset=utf-8", cache: "max-age=600", corps: "// js" },
    [MODELE]: { statut: 200, type: "application/octet-stream", cache: "max-age=600", corps: "modele" },
    [WASM]: { statut: 200, type: "application/wasm", cache: "max-age=600", corps: "wasm" },
  };
}

/** Serveur éphémère sur 127.0.0.1, port 0 ; `routes` remplace `saines()`. */
async function serveur(routes) {
  const reponses = { ...saines(), ...routes };
  const http = createServer((requete, reponse) => {
    const chemin = decodeURIComponent(new URL(requete.url ?? "/", "http://localhost").pathname);
    const trouve = reponses[chemin];
    if (!trouve) {
      reponse.writeHead(404, { "content-type": "text/plain" }).end("absent");
      return;
    }
    const entetes = { "content-type": trouve.type };
    if (trouve.cache !== null) entetes["cache-control"] = trouve.cache;
    reponse.writeHead(trouve.statut, entetes);
    reponse.end(requete.method === "HEAD" ? undefined : trouve.corps);
  });
  await new Promise((resoudre) => http.listen(0, "127.0.0.1", resoudre));
  const port = http.address().port;
  return {
    url: `http://127.0.0.1:${port}${BASE}`,
    ferme: () => new Promise((resoudre) => http.close(resoudre)),
  };
}

/**
 * Lance la sonde comme le fait la CI, résultat écrit dans un dossier jetable.
 * Asynchrone : `spawnSync` figerait la boucle du test, donc le serveur local
 * ne pourrait pas répondre à l'enfant — deadlock garanti.
 */
function lance(url) {
  const out = mkdtempSync(join(tmpdir(), "sonde-"));
  return new Promise((resoudre, rejeter) => {
    const enfant = spawn(process.execPath, [SONDE, "--url", url, "--json", "--out", out], { cwd: RACINE });
    const morceaux = [];
    for (const flux of [enfant.stdout, enfant.stderr]) {
      flux.setEncoding("utf8");
      flux.on("data", (morceau) => morceaux.push(morceau));
    }
    enfant.on("error", rejeter);
    enfant.on("close", (code) => resoudre({ code, sortie: morceaux.join(""), dossier: out }));
    setTimeout(() => enfant.kill("SIGKILL"), 45_000).unref();
  });
}

/** Le JSON écrit par la sonde, relu depuis son dossier de sortie. */
function resultat(r) {
  const [nom] = readdirSync(r.dossier).filter((fichier) => fichier.endsWith(".json")).sort();
  return JSON.parse(readFileSync(join(r.dossier, nom), "utf8"));
}

test("site entièrement servi → code 0, aucune anomalie", async (t) => {
  const site = await serveur({});
  t.after(site.ferme);
  const r = await lance(site.url);
  assert.equal(r.code, 0, r.sortie);
  const json = resultat(r);
  assert.equal(json.ok, true);
  assert.deepEqual(json.anomalies, []);
  assert.deepEqual(
    json.ressources.map((ressource) => ressource.nom),
    ["page", "js", "modele", "wasm"],
  );
  assert.equal(json.url, site.url);
  assert.ok(json.horodatage.endsWith("Z"), "résultat horodaté");
});

test("modèle en 404 → code non nul et message lisible", async (t) => {
  const site = await serveur({ [MODELE]: { statut: 404, type: "text/plain", cache: null, corps: "" } });
  t.after(site.ferme);
  const r = await lance(site.url);
  assert.notEqual(r.code, 0);
  assert.match(r.sortie, /modele .*HTTP 404, attendu 2xx/);
  const json = resultat(r);
  assert.equal(json.ok, false);
  assert.equal(json.ressources.find((x) => x.nom === "modele").statut, 404);
});

test("Content-Type faux sur le wasm → signalé", async (t) => {
  const site = await serveur({ [WASM]: { statut: 200, type: "text/plain", cache: "max-age=600", corps: "wasm" } });
  t.after(site.ferme);
  const r = await lance(site.url);
  assert.notEqual(r.code, 0);
  assert.match(r.sortie, /wasm .*Content-Type « text\/plain », attendu « application\/wasm »/);
});

test("Cache-Control absent sur le JS → signalé", async (t) => {
  const site = await serveur({
    [JS]: { statut: 200, type: "application/javascript", cache: null, corps: "// js" },
  });
  t.after(site.ferme);
  const r = await lance(site.url);
  assert.notEqual(r.code, 0);
  assert.match(r.sortie, /js .*Cache-Control absent/);
});

test("page sans JS référencé → signalé, la sonde ne devine rien", async (t) => {
  const site = await serveur({ [`${BASE}`]: { statut: 200, type: "text/html", cache: "max-age=0", corps: "<html></html>" } });
  t.after(site.ferme);
  const r = await lance(site.url);
  assert.notEqual(r.code, 0);
  assert.match(r.sortie, /aucun <script src=/);
  assert.deepEqual(
    resultat(r).ressources.map((ressource) => ressource.nom),
    ["page", "modele", "wasm"],
  );
});

test("JS pointé vers une origine tierce → refusé (AIR-N-01)", async (t) => {
  const page = `<html><head><script src="https://exemple.invalid/a.js"></script></head></html>`;
  const site = await serveur({ [`${BASE}`]: { statut: 200, type: "text/html", cache: "max-age=0", corps: page } });
  t.after(site.ferme);
  const r = await lance(site.url);
  assert.notEqual(r.code, 0);
  assert.match(r.sortie, /origine tierce/);
});

test("adresse non HTTPS hors machine locale → refusé (AIR-N-13)", async () => {
  const r = await lance("http://exemple.invalid/thin-air/");
  assert.notEqual(r.code, 0);
  assert.match(r.sortie, /adresse non HTTPS/);
});
