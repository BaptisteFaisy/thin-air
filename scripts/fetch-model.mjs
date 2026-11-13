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
 * Quelle variante de wasm est publiée ?
 * ------------------------------------
 * Le paquet `@mediapipe/tasks-vision` en livre deux :
 * `vision_wasm_internal.*` (non-module) et `vision_wasm_module_internal.*`
 * (module). Le site n'en demande qu'UNE, et ce script ne publie que celle-là :
 * celle que le chargeur demande, lue dans le code du paquet installé
 * (`scripts/lib/wasm.mjs`, une seule implémentation partagée avec
 * `scripts/check-wasm.mjs`).
 *
 *   - `FilesetResolver.forVisionTasks(racine)` prend la variante NON-module
 *     par défaut ; la variante module ne serait demandée que par un appel
 *     passant `useWasmModule: true`, et aucun appel du site ne le fait
 *     (`packages/vision/src/landmarker-core.ts`, ligne relevée par le script).
 *   - Le DÉLÉGUÉ (processeur graphique ou processeur) ne change rien : le
 *     chemin du moteur est construit par la seule règle de nommage du
 *     paquet, qui ne dépend ni de `GPU` ni de `CPU`. Sur une machine sans
 *     accélération graphique, le repli (AIR-N-07) charge donc EXACTEMENT les
 *     mêmes fichiers : ils sont publiés, rien ne peut manquer.
 *
 * La preuve complète, et son contrôle automatique, sont dans
 * `docs/poids-publication.md` et `scripts/check-wasm.mjs` (qui sort 1 si le
 * repli processeur n'est pas garanti).
 *
 * Usage : npm run fetch-model                          (défaut)
 *         node scripts/fetch-model.mjs --variante cpu  (délégué processeur)
 *         node scripts/fetch-model.mjs --variante gpu  (délégué graphique)
 *         node scripts/fetch-model.mjs --all           (toutes les variantes)
 *
 * `--variante` nomme le délégué à servir : `gpu`, `cpu` ou `les-deux` (le
 * défaut). Les trois copient le MÊME fileset — le délégué est choisi dans
 * `createFromOptions`, après le chargement des fichiers d'exécution — et le
 * rappel des poids le dit à chaque exécution. `--all` seul publie en plus la
 * variante module : du poids mort tant qu'aucun appel ne passe
 * `useWasmModule: true`.
 */
import { mkdir, writeFile, readFile, stat, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formaterPoids } from "./lib/poids.mjs";
import { analyserPaquet, appelsForVisionTasks, fichiersDemandes } from "./lib/wasm.mjs";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const cible = join(racine, "public", "models");

const MODELE =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";

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

/**
 * Les fichiers d'exécution à publier : ceux que le site demande, lus dans le
 * paquet installé et dans les appels du site. `--all` publie en plus tout ce
 * que le paquet livre.
 */
async function fichiersAPublier(wasmSource) {
  const paquet = join(racine, "node_modules", "@mediapipe", "tasks-vision");
  const analyse = await analyserPaquet(paquet);
  if (analyse.regle === null || analyse.prefixe === null) {
    process.stderr.write(
      "la règle de nommage du paquet est introuvable : le paquet installé est-il complet ?\n",
    );
    process.exit(1);
  }
  const appels = await appelsForVisionTasks(racine);
  const demandes = fichiersDemandes(appels, analyse.prefixe, analyse.regle, analyse.defautModule);
  const livres = await readdir(wasmSource);
  const aCopier = toutGarder ? livres.filter((nom) => !nom.endsWith(".map")) : demandes;
  const manquants = aCopier.filter((nom) => !livres.includes(nom));
  if (manquants.length > 0) {
    process.stderr.write(
      `fichiers d'exécution introuvables dans node_modules (${manquants.join(", ")}) : ` +
        "lancer `npm ci` d'abord\n",
    );
    process.exit(1);
  }
  return { aCopier, analyse, appels };
}

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
async function copierWasm(wasmSource, wasmCible, aCopier) {
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
      process.stdout.write(`retiré (non demandé par le site) : wasm/${nom}\n`);
    }
  }
  return poids;
}

/** Rappel : ce que pèse chaque variante, mesuré sur les fichiers réels. */
async function rappelerPoids(wasmSource, wasmCible, poidsModele, aCopier) {
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
  const publiee = await mesurer(wasmCible, aCopier);
  const autre = (await readdir(wasmSource)).filter((nom) => !aCopier.includes(nom));
  const morte = await mesurer(wasmSource, autre);
  process.stdout.write(
    "rappel des poids (mesurés sur les fichiers réels) :\n" +
      `  modèle hand_landmarker.task : ${formaterPoids(poidsModele)}\n` +
      `  variante demandée par le site (délégué graphique comme délégué processeur) : ${formaterPoids(publiee)}\n` +
      `  variante(s) non demandée(s), jamais publiées (--all seulement) : ${formaterPoids(morte)}\n` +
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
const { aCopier, analyse, appels } = await fichiersAPublier(wasmSource);
const poidsWasm = await copierWasm(wasmSource, wasmCible, aCopier);

const total = poids + poidsWasm;
process.stdout.write(
  `poids du modèle : ${formaterPoids(poids)} · ` +
    `fichiers d'exécution publiés : ${formaterPoids(poidsWasm)} ` +
    `(${aCopier.join(", ")}) · total premier chargement : ${formaterPoids(total)}\n`,
);
process.stdout.write(
  "pourquoi ces fichiers : le chargeur demande la variante " +
    `${analyse.prefixe}_${analyse.regle.tete}${analyse.regle.suffixeSimple}${analyse.regle.suffixeFinal} ` +
    `(forVisionTasks sans useWasmModule) ; le délégué est choisi plus tard, ` +
    "donc le repli processeur charge les mêmes fichiers.\n" +
    appels
      .map((appel) => `  appel du site : ${appel.fichier}:${appel.ligne} → forVisionTasks(${appel.chemin})`)
      .join("\n") +
    "\n" +
    "preuve et contrôle : docs/poids-publication.md, scripts/check-wasm.mjs\n",
);
await rappelerPoids(wasmSource, wasmCible, poids, aCopier);
process.stdout.write("à reporter dans docs/latency.md (ligne « poids du premier chargement »)\n");
