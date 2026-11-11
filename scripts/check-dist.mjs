#!/usr/bin/env node
/**
 * Contrôle du site construit — une seule implémentation pour `build.yml` et
 * `deploy.yml` (règle 4 du contrat : zéro duplication).
 *
 *   AIR-N-01  aucune requête vers une origine tierce : le site doit se suffire,
 *             le modèle et son moteur d'exécution sont servis par lui.
 *   AIR-F-25  aucun fichier sonore publié : tout est synthétisé.
 *
 * Les URL absolues qui restent dans un bundle minifié ne sont pas toutes des
 * requêtes : les espaces de noms XML/SVG et les identifiants de schéma ou de
 * licence sont des chaînes, jamais ouvertes sur le réseau. Elles sont listées
 * dans AUTORISEES, avec leur raison — une nouvelle entrée doit être justifiée.
 *
 * Usage : node scripts/check-dist.mjs [dossier-dist]
 */
import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { readFileSync } from "node:fs";

const racine = process.cwd();
const dist = join(racine, process.argv[2] ?? "apps/web/dist");

/** Préfixes d'URL présents dans le bundle sans être des requêtes. */
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
];

const EXTENSIONS_SONORES = new Set([
  ".wav", ".mp3", ".ogg", ".oga", ".flac", ".m4a", ".aac", ".opus", ".aiff", ".caf",
]);

const EXTENSIONS_TEXTE = new Set([".html", ".js", ".mjs", ".css", ".json", ".svg", ".map"]);

/**
 * Code tiers que le site sert lui-même, exclu du contrôle des ORIGINES (jamais
 * du contrôle des fichiers sonores) :
 *
 *  - `models/wasm/` : le chargeur emscripten du modèle. Ses en-têtes de licence
 *    et ses commentaires contiennent des dizaines d'URL qui ne sont jamais
 *    résolues.
 *  - `vision_bundle-*.js` : le paquet MediaPipe, découpé par Vite. Il contient
 *    l'adresse d'un hébergeur de modèles de Google, utilisée par MediaPipe quand
 *    on lui donne un NOM de modèle à télécharger. Ce site lui donne un chemin
 *    LOCAL (`models/hand_landmarker.task`), donc cette adresse n'est jamais
 *    résolue — mais un contrôle purement textuel ne peut pas le prouver.
 *
 * Ce que ce script prouve : NOTRE code ne part sur aucune origine tierce. Ce
 * qui reste à prouver à l'exécution — rien ne sort du navigateur, AIR-N-01 —
 * l'est par le journal réseau du navigateur de test (recette §18) et par le test
 * E2E, qui coupe tout et compte les requêtes.
 */
const HORS_ORIGINES = ["models/wasm/", `vision_bundle-`];

/** Les fichiers exclus du contrôle des origines sont dits, jamais passés sous silence. */
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
  if (HORS_ORIGINES.some((motif) => relatif.includes(motif))) {
    exclus.push(relatif);
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
for (const fichier of exclus.sort()) {
  process.stdout.write(`  code tiers servi par le site, hors contrôle des origines : ${fichier}\n`);
}
for (const [prefixe, raison] of AUTORISEES) {
  process.stdout.write(`  autorisée : ${prefixe} — ${raison}\n`);
}
