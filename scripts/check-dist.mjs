#!/usr/bin/env node
/**
 * Contrôle du site construit — une seule implémentation pour `build.yml` et
 * `deploy.yml` (règle 4 du contrat : zéro duplication).
 *
 *   AIR-N-01  aucune requête vers une origine tierce : le site doit se suffire,
 *             le modèle et son moteur d'exécution sont servis par lui.
 *   AIR-F-25  aucun fichier sonore publié : tout est synthétisé.
 *
 * Deux sortes d'URL absolues survivent dans un bundle minifié, et une seule est
 * une requête :
 *
 *   - les identifiants : espaces de noms XML/SVG/MathML, schémas JSON,
 *     licences, aide en ligne. Des chaînes qu'on cite sans jamais les joindre
 *     → AUTORISEES ;
 *   - le code tiers que le site sert lui-même : le paquet MediaPipe et son
 *     chargeur emscripten. Leurs chaînes internes (journal de télémétrie,
 *     hébergeur de modèles, commentaires de licence) ne sont jamais demandées
 *     par ce site, qui passe un chemin LOCAL au paquet → EXCLUSIONS, avec la
 *     raison écrite ci-dessous.
 *
 * Ce qui reste — un `https://` vers un autre hôte dans NOTRE code — est une
 * vraie origine tierce, et fait échouer le contrôle. Ce script prouve donc que
 * NOTRE code ne part sur aucune origine tierce ; la preuve que rien ne sort du
 * navigateur à l'exécution (AIR-N-01) est le journal réseau du navigateur de
 * test (recette §18) et l'E2E, qui coupe tout et compte les requêtes.
 *
 * Usage : node scripts/check-dist.mjs [dossier-dist]
 */
import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { readFileSync } from "node:fs";

const racine = process.cwd();
const dist = join(racine, process.argv[2] ?? "apps/web/dist");

/**
 * Préfixes d'URL présents dans le bundle sans être des requêtes.
 *
 * `odml.pa.googleapis.com` est le point de journalisation du paquet MediaPipe
 * : MediaPipe ne l'appelle que si une clé d'API de journalisation est
 * configurée, et notre code n'en configure jamais (`grep -rn "odml\|apiKey"
 * apps/web/src packages/vision/src` ne rend rien). L'adresse reste une
 * chaîne dans le bundle : elle est listée ici, avec sa raison, comme les
 * autres adresses qui ne sont jamais résolues.
 */
const AUTORISEES = [
  ["http://www.w3.org/", "espace de noms XML, SVG et MathML"],
  ["https://www.w3.org/", "espace de noms XML, SVG et MathML"],
  ["http://json-schema.org/", "identifiant de schéma JSON (zod), jamais résolu"],
  ["https://json-schema.org/", "identifiant de schéma JSON (zod), jamais résolu"],
  ["https://react.dev/errors/", "aide en ligne citée dans un message d'erreur"],
  ["https://reactjs.org/", "aide en ligne citée dans un message d'erreur"],
  ["https://opensource.org/", "identifiant de licence en commentaire"],
  ["https://choosealicense.com/", "identifiant de licence en commentaire"],
  ["https://github.com/BaptisteFaisy/thin-air", "adresse du dépôt, dans la page"],
  ["https://odml.pa.googleapis.com/", "journalisation MediaPipe, jamais activée : aucune clé d'API dans notre code"],
];

const EXTENSIONS_SONORES = new Set([
  ".wav", ".mp3", ".ogg", ".oga", ".flac", ".m4a", ".aac", ".opus", ".aiff", ".caf",
]);

const EXTENSIONS_TEXTE = new Set([".html", ".js", ".mjs", ".css", ".json", ".svg", ".map"]);

/**
 * Code tiers que le site sert lui-même, exclu du contrôle des ORIGINES —
 * jamais du contrôle des fichiers sonores. La raison de chaque exclusion est
 * écrite ici et imprimée à chaque exécution : l'exception reste un fait
 * vérifiable, pas un blanc-seing.
 *
 * `models/wasm/` couvre les DEUX variantes du chargeur emscripten que le paquet
 * fournit — `vision_wasm_internal.js` (chargée par le délégué GPU comme par le
 * processeur) et `vision_wasm_module_internal.js` (la variante `module_internal`,
 * conservée seulement par `--all`, `useWasmModule: true` à venir) : leurs
 * en-têtes de licence et leurs commentaires portent des dizaines d'URL qui ne
 * sont jamais résolues.
 */
const EXCLUSIONS = [
  [
    "models/wasm/",
    "chargeur emscripten servi par le site (vision_wasm_internal.js et " +
      "vision_wasm_module_internal.js) — URL de licence et de commentaires, jamais résolues",
  ],
  [
    "vision_bundle-",
    "paquet MediaPipe découpé par Vite — adresse d'hébergeur de Google (téléchargement " +
      "par NOM de modèle), jamais résolue : ce site passe un chemin LOCAL",
  ],
  [
    "analysis-worker-",
    "worker d'analyse — le paquet MediaPipe y est importé statiquement, les mêmes " +
      "chaînes Google y sont inaccessibles pour la même raison (chemin LOCAL)",
  ],
];

/** Les fichiers exclus du contrôle des origines, chacun avec sa raison. */
const exclus = [];

async function* fichiers(dossier) {
  let entrees;
  try {
    entrees = await readdir(dossier, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entree of entrees) {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) yield* fichiers(chemin);
    else if (entree.isFile()) yield chemin;
  }
}

async function existe(chemin) {
  try {
    return (await stat(chemin)).isDirectory();
  } catch {
    return false;
  }
}

if (!(await existe(dist))) {
  process.stderr.write(`dossier construit introuvable : ${relative(racine, dist)}\n`);
  process.stderr.write("lancer d'abord `npm run build`\n");
  process.exit(2);
}

const tierces = new Map();
const sonores = [];
let comptes = 0;

for await (const chemin of fichiers(dist)) {
  comptes += 1;
  const ext = chemin.slice(chemin.lastIndexOf(".")).toLowerCase();
  if (EXTENSIONS_SONORES.has(ext)) sonores.push(relative(racine, chemin));
  if (!EXTENSIONS_TEXTE.has(ext)) continue;
  const relatif = relative(racine, chemin);
  const exclu = EXCLUSIONS.find(([motif]) => relatif.includes(motif));
  if (exclu !== undefined) {
    exclus.push([relatif, exclu[1]]);
    continue;
  }
  let texte;
  try {
    texte = readFileSync(chemin, "utf8");
  } catch {
    continue;
  }
  for (const url of texte.match(/https?:\/\/[A-Za-z0-9._~:/?#@!$&*+,;=%-]+/g) ?? []) {
    if (AUTORISEES.some(([prefixe]) => url.startsWith(prefixe))) continue;
    const origine = url.replace(/^(https?:\/\/[^/?#]+).*$/, "$1");
    if (!tierces.has(origine)) tierces.set(origine, relative(racine, chemin));
  }
}

let echec = false;
if (tierces.size > 0) {
  echec = true;
  for (const [origine, fichier] of tierces) {
    process.stderr.write(`::error::origine tierce dans le site construit (AIR-N-01) : ${origine} — ${fichier}\n`);
  }
}
if (sonores.length > 0) {
  echec = true;
  for (const fichier of sonores) {
    process.stderr.write(`::error::fichier sonore publié (AIR-F-25) : ${fichier}\n`);
  }
}
if (echec) process.exit(1);

process.stdout.write(`${comptes} fichier(s) publié(s) : aucune origine tierce, aucun fichier sonore\n`);
for (const [fichier, raison] of exclus.sort()) {
  process.stdout.write(`  code tiers servi par le site, hors contrôle des origines : ${fichier} — ${raison}\n`);
}
for (const [prefixe, raison] of AUTORISEES) {
  process.stdout.write(`  autorisée : ${prefixe} — ${raison}\n`);
}
