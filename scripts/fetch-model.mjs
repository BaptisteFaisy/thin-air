#!/usr/bin/env node
/**
 * Télécharge le modèle de suivi des mains et ses fichiers d'exécution dans
 * `public/models/`, pour que le site les serve lui-même : aucune dépendance à
 * un tiers, et le site fonctionne hors ligne après la première visite
 * (AIR-N-01, cahier §7.3 et §11.9).
 *
 * Les fichiers ne sont PAS versionnés (voir .gitignore) : ils pèsent plusieurs
 * mégaoctets et le poids exact est à mesurer puis à noter dans docs/latency.md.
 *
 * Une seule variante de wasm est publiée par défaut. Le paquet en fournit deux
 * (`vision_wasm_internal.*` et `vision_wasm_module_internal.*`, 13,93 Mo
 * chacune), mais le site n'en charge qu'une : `FilesetResolver.forVisionTasks`
 * est appelé sans son second argument (`useWasmModule`, défaut `false`) dans
 * `packages/vision/src/landmarker.ts`, donc le chargeur demande la variante
 * NON-module. Le délégué (GPU ou processeur, AIR-N-07) ne change pas ce
 * choix : les deux délégués partagent le même fileset — vérifié par le
 * journal des requêtes Playwright (scripts/preuves/chargement.mjs). Publier
 * la variante module ajouterait 13,93 Mo morts au site ; `--all` la conserve
 * si un appel futur passe `useWasmModule: true`.
 *
 * Usage : npm run fetch-model                          (défaut : --variante les-deux)
 *         node scripts/fetch-model.mjs --variante gpu  (délégué GPU)
 *         node scripts/fetch-model.mjs --variante cpu  (délégué processeur, AIR-N-07)
 *         node scripts/fetch-model.mjs --all           (les deux variantes de wasm)
 *
 * `--variante` nomme le ou les délégués à servir : `gpu`, `cpu`, ou `les-deux`
 * (le défaut, qui garde le repli processeur AIR-N-07). Les trois chargent le
 * MÊME fileset non-module — le délégué est choisi dans `createFromOptions`,
 * après le fileset, et la preuve par journal de requêtes est dans
 * docs/latency.md : l'option ne change donc pas les fichiers copiés, et le
 * rappel des poids le dit à chaque exécution. `--all` seul ajoute la variante
 * module (poids mort tant qu'aucun appel ne passe `useWasmModule: true`).
 */
import { mkdir, writeFile, readFile, stat, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formaterPoids } from "./lib/poids.mjs";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const cible = join(racine, "public", "models");

const MODELE =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";

/** La variante réellement chargée (voir l'en-tête) : non-module. */
const VARIANTE_UTILE = ["vision_wasm_internal.js", "vision_wasm_internal.wasm"];
/** La variante que le site ne demande jamais, sauf `useWasmModule: true`. */
const VARIANTE_MODULE = ["vision_wasm_module_internal.js", "vision_wasm_module_internal.wasm"];
/** Valeurs acceptées par `--variante` : les délégués à servir. */
const DELEGUES = ["gpu", "cpu", "les-deux"];

/** Lit la valeur qui suit un drapeau (`--variante gpu` → `gpu`). */
function lireValeur(argv, drapeau) {
  const index = argv.indexOf(drapeau);
  return index >= 0 && index + 1 < argv.length ? argv[index + 1] : undefined;
}

const delegue = lireValeur(process.argv, "--variante") ?? "les-deux";
if (!DELEGUES.includes(delegue)) {
  process.stderr.write(`--variante attend ${DELEGUES.join(" | ")} : reçu « ${delegue} »\n`);
  process.exit(1);
}
const toutGarder = process.argv.includes("--all");
// GPU, processeur, ou les deux (repli AIR-N-07) chargent le même fileset
// non-module (voir l'en-tête) : les trois valeurs retiennent la variante
// utile. `--all` seul ajoute la variante module — du poids mort tant qu'aucun
// appel futur ne passe `useWasmModule: true`.
const aCopier = toutGarder ? [...VARIANTE_UTILE, ...VARIANTE_MODULE] : VARIANTE_UTILE;

async function telecharger(url, fichier) {
  const chemin = join(cible, fichier);
  try {
    const deja = await stat(chemin);
    if (deja.size > 0) {
      process.stdout.write(`déjà présent : ${fichier} (${deja.size} octets)\n`);
      return deja.size;
    }
  } catch {
    /* absent : on télécharge */
  }
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(`${url} → HTTP ${reponse.status}`);
  const octets = new Uint8Array(await reponse.arrayBuffer());
  await writeFile(chemin, octets);
  process.stdout.write(`téléchargé : ${fichier} (${octets.byteLength} octets)\n`);
  return octets.byteLength;
}

/** Copie la variante retenue depuis le paquet installé, et retire le reste. */
async function copierWasm(wasmSource, wasmCible) {
  const presents = await readdir(wasmSource);
  const manquants = aCopier.filter((nom) => !presents.includes(nom));
  if (manquants.length > 0) {
    process.stderr.write(
      `fichiers d'exécution introuvables dans node_modules (${manquants.join(", ")}) : ` +
        "lancer `npm ci` d'abord\n",
    );
    process.exit(1);
  }
  let poids = 0;
  for (const nom of aCopier) {
    const octets = await readFile(join(wasmSource, nom));
    await writeFile(join(wasmCible, nom), octets);
    poids += octets.byteLength;
  }
  // Une copie antérieure avec --all laisse la variante morte : la retirer
  // garde le poids publié égal au poids réellement téléchargé.
  for (const nom of await readdir(wasmCible)) {
    if (!aCopier.includes(nom)) {
      await rm(join(wasmCible, nom));
      process.stdout.write(`retiré (non chargé par le site) : wasm/${nom}\n`);
    }
  }
  return poids;
}

/** Rappel : ce que pèse chaque variante, mesuré sur les fichiers réels. */
async function rappelerPoids(wasmSource, wasmCible, poidsModele) {
  const mesurer = async (dossier, noms) => {
    let total = 0;
    for (const nom of noms) {
      try {
        total += (await stat(join(dossier, nom))).size;
      } catch {
        /* fichier absent : non compté */
      }
    }
    return total;
  };
  const utile = await mesurer(wasmSource, VARIANTE_UTILE);
  const morte = await mesurer(wasmSource, VARIANTE_MODULE);
  const publiee = await mesurer(wasmCible, [...VARIANTE_UTILE, ...VARIANTE_MODULE]);
  process.stdout.write(
    "rappel des poids (mesurés sur les fichiers réels) :\n" +
      `  modèle hand_landmarker.task : ${formaterPoids(poidsModele)}\n` +
      `  variante non-module, chargée par le délégué GPU comme par le processeur : ${formaterPoids(utile)}\n` +
      `  variante module, jamais chargée (--all seulement) : ${formaterPoids(morte)}\n` +
      `  fichiers d'exécution effectivement publiés : ${formaterPoids(publiee)}\n`,
  );
}

await mkdir(cible, { recursive: true });
const poids = await telecharger(MODELE, "hand_landmarker.task");

// Les fichiers d'exécution (wasm) sont copiés depuis le paquet installé :
// c'est la même version que celle des tests, et le site n'appelle aucun CDN
// (AIR-N-01). La racine attendue par le chargeur est `models/wasm`.
const wasmSource = join(racine, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const wasmCible = join(cible, "wasm");
await mkdir(wasmCible, { recursive: true });
const poidsWasm = await copierWasm(wasmSource, wasmCible);

const total = poids + poidsWasm;
process.stdout.write(
  `poids du modèle : ${formaterPoids(poids)} · ` +
    `fichiers d'exécution publiés : ${formaterPoids(poidsWasm)} ` +
    `(${toutGarder ? "deux variantes, --all" : `variante utile seule, --variante ${delegue}`}) · ` +
    `total premier chargement : ${formaterPoids(total)}\n`,
);
await rappelerPoids(wasmSource, wasmCible, poids);
process.stdout.write("à reporter dans docs/latency.md (ligne « poids du premier chargement »)\n");
