#!/usr/bin/env node
/**
 * Poids de publication : liste les fichiers réellement publiés par le site
 * (`apps/web/dist` par défaut), avec le poids de chacun, leur total, et
 * signale les doublons de 14 Mo — la seconde variante de wasm du paquet
 * MediaPipe (`vision_wasm_module_internal.*`), que le site ne charge jamais
 * (preuve par journal de requêtes dans docs/latency.md) et dont la présence
 * ajouterait ~14 Mo morts au premier chargement.
 *
 * Aucune requête réseau, aucun son, aucun périphérique : ce script ne fait
 * que lire le dossier construit (AIR-N-01, AIR-N-02).
 *
 * Usage : node scripts/poids-publication.mjs [dossier-publie]
 * Codes de sortie :
 *   0  le dossier a été listé (un doublon est signalé, pas bloquant ici :
 *      c'est `scripts/fetch-model.mjs` qui décide ce qu'il copie) ;
 *   1  le dossier est absent — construire d'abord (`npm run build`, et
 *      `npm run fetch-model` pour le modèle et son moteur d'exécution).
 */
import { readdir, stat } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { formaterPoids } from "./lib/poids.mjs";

const racine = process.cwd();
// `resolve` (et non `join`) : un dossier passé en argument absolu le reste.
const dist = resolve(racine, process.argv[2] ?? join("apps", "web", "dist"));

/**
 * Paires qui ne doivent pas coexister dans le dossier publié : la variante
 * non-module (chargée par les deux délégués, GPU et processeur) et la variante
 * module (jamais chargée). Les poids réels, eux, sont mesurés et affichés.
 */
const DOUBLONS = [
  ["vision_wasm_internal.wasm", "vision_wasm_module_internal.wasm"],
  ["vision_wasm_internal.js", "vision_wasm_module_internal.js"],
];

/** Parcourt un dossier en profondeur et rend chaque fichier avec sa taille. */
async function* parcourir(dossier) {
  for (const entree of await readdir(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) yield* parcourir(chemin);
    else if (entree.isFile()) yield { chemin, taille: (await stat(chemin)).size };
  }
}

/** Liste les fichiers, chemin relatif au dossier publié, triés par chemin. */
async function lister(dossier) {
  const fichiers = [];
  for await (const { chemin, taille } of parcourir(dossier)) {
    fichiers.push({ relatif: relative(dossier, chemin), taille });
  }
  return fichiers.sort((a, b) => a.relatif.localeCompare(b.relatif));
}

/** Signale les doublons : les deux variantes de wasm publiées ensemble. */
function signalerDoublons(fichiers) {
  let trouves = 0;
  for (const [utile, mort] of DOUBLONS) {
    const garde = fichiers.find((f) => basename(f.relatif) === utile);
    const doublon = fichiers.find((f) => basename(f.relatif) === mort);
    if (!garde || !doublon) continue;
    trouves += 1;
    process.stdout.write(
      `DOUBLON : ${doublon.relatif} (${formaterPoids(doublon.taille)}) fait double emploi ` +
        `avec ${garde.relatif} — le site ne charge que la variante non-module ` +
        "(docs/latency.md) : c'est du poids mort au premier chargement.\n",
    );
  }
  if (trouves === 0) {
    process.stdout.write("aucun doublon de 14 Mo : au plus une variante de wasm est publiée.\n");
  }
}

try {
  if (!(await stat(dist)).isDirectory()) throw new Error("pas un dossier");
} catch {
  process.stderr.write(
    `dossier publié introuvable : ${dist}\n` +
      "construisez d'abord le site : npm run build " +
      "(et npm run fetch-model pour le modèle et son moteur d'exécution).\n",
  );
  process.exit(1);
}

const fichiers = await lister(dist);
let total = 0;
process.stdout.write(`fichiers publiés dans ${relative(racine, dist) || dist} :\n`);
for (const fichier of fichiers) {
  total += fichier.taille;
  process.stdout.write(`  ${fichier.relatif} : ${formaterPoids(fichier.taille)}\n`);
}
process.stdout.write(`total publié : ${formaterPoids(total)} — ${fichiers.length} fichiers\n`);
signalerDoublons(fichiers);
