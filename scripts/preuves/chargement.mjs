#!/usr/bin/env node
/**
 * Preuve rejouable du premier chargement sous connexion bridée (cahier §4 :
 * « moins de 30 secondes du premier clic à la première note », annexe D).
 *
 * Méthode : le site construit (`apps/web/dist`) et les modèles
 * (`public/models`) sont servis par un petit serveur statique LOCAL ; un
 * Chromium headless lancé MUET (`--mute-audio`, AIR-N-02) avec la fausse
 * caméra des specs de bout en bout (vidéo y4m et arguments réutilisés depuis
 * `apps/web/e2e/aide.ts` — aucune duplication) ouvre la page et clique
 * « Start ». Le débit est bridé via CDP (`Network.emulateNetworkConditions`,
 * latence non émulée). Octets et durées viennent des événements CDP
 * `Network.*` (`encodedDataLength`, horodatages) : rien n'est estimé, tout
 * est mesuré par le navigateur, sur cette machine.
 *
 * Le serveur sert `/thin-air/*` (le site, base de production) ET `/models/*`
 * (la racine absolue que `DEFAULT_WASM_ROOT` demande) : la seconde existe
 * parce que le wasm est demandé hors du préfixe `/thin-air/` — défaut signalé
 * dans docs/latency.md, hors du périmètre de ce lot. L'en-tête `cache-control:
 * max-age=600` reproduit la valeur réelle observée sur l'hébergeur.
 *
 * Aucune requête vers l'extérieur : tout est servi depuis 127.0.0.1.
 *
 * Usage : node scripts/preuves/chargement.mjs [débits en Mbit/s…]
 *         défaut : 10 4 1.5  →  out/chargement-<débit>.json + tableau imprimé
 * Prérequis : npm run fetch-model && npm run build
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { hostname } from "node:os";
import { chromium } from "playwright";
import { ARGS, genereVideo } from "../../apps/web/e2e/aide.ts";

const racine = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const DIST = join(racine, "apps", "web", "dist");
const MODELS = join(racine, "public", "models");
const PORT = 4180;
const BASE = `http://127.0.0.1:${PORT}`;
const DEBITS_DEFAUT = [10, 4, 1.5];
/** Fausse caméra : la même vidéo que les specs de bout en bout. */
const VIDEO = genereVideo(join(racine, "out", "preuves", "fausse-camera.y4m"));
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".task": "application/octet-stream",
};

/** Sert un fichier d'un dossier sous un préfixe d'URL, sans en sortir. */
function servirFichier(reponse, url, dossier, prefixe) {
  const relatif = decodeURIComponent(url.slice(prefixe.length)).split("?")[0];
  const chemin = join(dossier, normalize(relatif).replace(/^(\.\.[/\\])+/, ""));
  if (!chemin.startsWith(dossier) || !existsSync(chemin)) {
    reponse.writeHead(404).end("introuvable");
    return;
  }
  stat(chemin).then(async (info) => {
    const cible = info.isDirectory() ? join(chemin, "index.html") : chemin;
    if (!existsSync(cible)) return void reponse.writeHead(404).end("introuvable");
    const infoCible = info.isDirectory() ? await stat(cible) : info;
    reponse.writeHead(200, {
      "content-type": TYPES[extname(cible)] ?? "application/octet-stream",
      "content-length": infoCible.size,
      // Valeur réelle observée sur GitHub Pages le 11 novembre 2026 : le
      // cache de l'hébergeur est de 10 minutes, pas un cache long.
      "cache-control": "max-age=600",
    });
    createReadStream(cible).pipe(reponse);
  });
}

function creerServeur() {
  const serveur = createServer((requete, reponse) => {
    const url = requete.url ?? "/";
    if (url.startsWith("/thin-air")) servirFichier(reponse, url, DIST, "/thin-air");
    else if (url.startsWith("/models")) servirFichier(reponse, url, MODELS, "/models");
    else reponse.writeHead(404).end("introuvable");
  });
  return new Promise((resoudre, refuser) => {
    serveur.once("error", (e) => refuser(new Error(`port ${PORT} occupé : ${e.code}`)));
    serveur.listen(PORT, "127.0.0.1", () => resoudre(serveur));
  });
}

/** Suivi CDP des requêtes /models/ : url, début, fin, octets réseau, cache. */
function suivreModele(cdp) {
  const entrees = new Map();
  cdp.on("Network.requestWillBeSent", (e) => {
    if (!e.request.url.includes("/models/")) return;
    entrees.set(e.requestId, {
      url: e.request.url.replace(BASE, ""),
      debutS: e.timestamp,
      finS: null,
      octets: 0,
      depuisCache: false,
    });
  });
  cdp.on("Network.requestServedFromCache", (e) => {
    const r = entrees.get(e.requestId);
    if (r) r.depuisCache = true;
  });
  cdp.on("Network.loadingFinished", (e) => {
    const r = entrees.get(e.requestId);
    if (r) {
      r.finS = e.timestamp;
      r.octets = e.encodedDataLength;
    }
  });
  return entrees;
}

/** Attend la fin réelle du téléchargement du modèle et du wasm. */
async function attendreFin(entrees, delaiMs) {
  const echeance = Date.now() + delaiMs;
  const complet = (motif) =>
    [...entrees.values()].some((r) => r.url.endsWith(motif) && r.finS !== null);
  while (!(complet("hand_landmarker.task") && complet("vision_wasm_internal.wasm"))) {
    if (Date.now() > echeance) {
      throw new Error(`téléchargement modèle+wasm non terminé avant ${delaiMs} ms`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

/** Une mesure : bridge le débit, clique « Start », journalise via CDP. */
async function mesurer(navigateur, debitMbitS) {
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();
  const cdp = await contexte.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: Math.round((debitMbitS * 1e6) / 8),
    uploadThroughput: -1,
  });
  const entrees = suivreModele(cdp);
  await page.goto(`${BASE}/thin-air/`, { waitUntil: "load" });
  await page.getByRole("button", { name: "Start", exact: true }).click();
  // Marge : le site télécharge le modèle DEUX fois (createCameraSource recharge
  // un landmarker — défaut signalé dans docs/latency.md), d'où 46 Mo attendus.
  const delaiMs = Math.max(120_000, Math.round((46e6 * 8 * 1000) / (debitMbitS * 1e6)) * 3);
  await attendreFin(entrees, delaiMs);
  // Filet : le second chargement et le reste du démarrage doivent s'achever.
  await page.waitForLoadState("networkidle", { timeout: delaiMs }).catch(() => undefined);
  const version = navigateur.version();
  await contexte.close();
  return { entrees: [...entrees.values()], version };
}

/** Agrège une mesure brute en chiffres publiables. */
function synthese(brut, debitMbitS) {
  const finies = brut.entrees.filter((r) => r.finS !== null);
  if (finies.length === 0) {
    throw new Error(`aucune ressource /models/ mesurée à ${debitMbitS} Mbit/s`);
  }
  const t0 = Math.min(...finies.map((r) => r.debutS));
  const ressources = finies.map((r) => ({
    url: r.url,
    debutMs: Math.round((r.debutS - t0) * 1000),
    finMs: Math.round((r.finS - t0) * 1000),
    octetsReseau: r.octets,
    depuisCache: r.depuisCache,
  }));
  const tempsMs = Math.max(...ressources.map((r) => r.finMs));
  return {
    debitMbitS,
    downloadThroughputOctetsS: Math.round((debitMbitS * 1e6) / 8),
    latenceEmuleeMs: 0,
    machine: `${hostname()} — Chromium headless ${brut.version}, Linux`,
    mesureLe: new Date().toISOString(),
    ressources,
    octetsTransfers: ressources.reduce((s, r) => s + r.octetsReseau, 0),
    tempsTelechargementModeleWasmMs: tempsMs,
    verdict30s: tempsMs < 30_000 ? "tient" : "ne tient pas",
  };
}

function ecrireEtImprimer(resultats) {
  mkdirSync(join(racine, "out"), { recursive: true });
  for (const r of resultats) {
    const nom = `chargement-${String(r.debitMbitS).replace(".", ",")}.json`;
    writeFileSync(join(racine, "out", nom), `${JSON.stringify(r, null, 2)}\n`, "utf8");
    process.stdout.write(`écrit : out/${nom}\n`);
  }
  process.stdout.write("\n| Débit | Octets transférés | Temps modèle + wasm | Verdict §4 (30 s) |\n");
  process.stdout.write("|---|---|---|---|\n");
  for (const r of resultats) {
    process.stdout.write(
      `| ${r.debitMbitS} Mbit/s | ${r.octetsTransfers.toLocaleString("fr-FR")} o ` +
        `| ${(r.tempsTelechargementModeleWasmMs / 1000).toFixed(1)} s | ${r.verdict30s} |\n`,
    );
  }
}

for (const dossier of [DIST, MODELS]) {
  if (!existsSync(dossier)) {
    process.stderr.write(`manquant : ${dossier}\nprérequis : npm run fetch-model && npm run build\n`);
    process.exit(1);
  }
}
const debits = process.argv.slice(2).map(Number).filter((n) => n > 0);
const liste = debits.length > 0 ? debits : DEBITS_DEFAUT;
const serveur = await creerServeur();
const navigateur = await chromium.launch({
  args: [...ARGS, `--use-file-for-fake-video-capture=${VIDEO}`],
});
const resultats = [];
try {
  for (const debit of liste) {
    process.stdout.write(`mesure à ${debit} Mbit/s…\n`);
    resultats.push(synthese(await mesurer(navigateur, debit), debit));
  }
} finally {
  await navigateur.close();
  serveur.close();
}
ecrireEtImprimer(resultats);
