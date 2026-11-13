#!/usr/bin/env node
/**
 * Le repli processeur est-il garanti ? (AIR-N-07)
 *
 * Le site sert lui-même les fichiers d'exécution du modèle (§11.9) : une
 * seule variante de wasm est publiée, pour ne pas faire télécharger 14,9 Mo
 * morts au visiteur. Cette variante doit être celle que le chargeur DEMANDE,
 * sinon le suivi des mains casse — et le repli sur le processeur (une machine
 * sans accélération graphique) casse avec lui.
 *
 * Ce script ne suppose rien : il lit la règle de nommage DANS le paquet
 * `@mediapipe/tasks-vision` installé (recherche ciblée, jamais de vidage de
 * bundle), relève les appels du site à `forVisionTasks`, et vérifie que le
 * dossier publié contient exactement ce qui sera demandé — le chargeur comme
 * le moteur de la variante demandée.
 *
 * Sort 0 : le repli processeur est garanti.
 * Sort 1 : il ne l'est pas (fichier manquant, ou preuve impossible à établir).
 *
 * Usage : node scripts/check-wasm.mjs [--paquet <dossier>] [--publie <dossier>]
 *                                      [--sources <dossier>]
 *   --paquet   le paquet `@mediapipe/tasks-vision` installé
 *               (défaut : node_modules/@mediapipe/tasks-vision)
 *   --publie   le dossier publié des fichiers d'exécution
 *               (défaut : apps/web/dist/models/wasm)
 *   --sources  la racine du dépôt, pour les appels du site et le service
 *               worker (défaut : la racine du dépôt)
 *
 * Aucune requête réseau, aucun son : ce script ne lit que des fichiers.
 */
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyserPaquet,
  appelsForVisionTasks,
  fichiersDeVariante,
  referencesDuWorker,
  variantesDemandees,
  verifierPublication,
} from "./lib/wasm.mjs";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Lit la valeur d'un drapeau (`--paquet <dossier>`). */
function lireValeur(argv, drapeau, defaut) {
  const index = argv.indexOf(drapeau);
  return index >= 0 && index + 1 < argv.length ? resolve(argv[index + 1]) : defaut;
}

const dossierPaquet = lireValeur(
  process.argv,
  "--paquet",
  join(racine, "node_modules", "@mediapipe", "tasks-vision"),
);
const dossierPublie = lireValeur(process.argv, "--publie", join(racine, "apps", "web", "dist", "models", "wasm"));
const dossierSources = lireValeur(process.argv, "--sources", racine);

/** Un fait vérifié : vrai ou faux, avec sa raison lisible. */
function fait(ok, raison) {
  return { ok, raison };
}

const analyse = await analyserPaquet(dossierPaquet);
const appels = await appelsForVisionTasks(dossierSources);
const worker = await referencesDuWorker(dossierSources);

/** Les faits vérifiés, dans l'ordre du rapport. */
async function faits() {
  const liste = [];
  liste.push(
    fait(
      analyse.fichiers.length > 0,
      `le paquet livre ${analyse.fichiers.length} fichier(s) d'exécution : ${analyse.fichiers.join(", ")}`,
    ),
  );
  liste.push(
    fait(
      analyse.regle !== null && analyse.prefixe !== null,
      analyse.regle === null
        ? "la règle de nommage est introuvable dans le paquet : la preuve est impossible"
        : `règle lue dans ${analyse.bundle} : \`${analyse.regle.extrait}\` → fichiers \`${analyse.prefixe}_${analyse.regle.tete}<suffixe>${analyse.regle.suffixeFinal}.js|.wasm\``,
    ),
  );
  liste.push(
    fait(
      analyse.delegateDansLaRegle === false && analyse.fenetre.includes("wasmBinaryPath"),
      analyse.delegateDansLaRegle
        ? "la règle de nommage mentionne un délégué : le repli processeur n'est pas garanti"
        : "le chemin du moteur est construit par la seule règle de nommage, sans delegate",
    ),
  );
  liste.push(
    fait(
      analyse.brancheDelegate,
      "le paquet choisit le délégué (processeur graphique ou processeur) dans le moteur chargé, pas dans le nom des fichiers",
    ),
  );
  liste.push(
    fait(
      analyse.defautModule === false,
      `forVisionTasks demande la variante non-module par défaut (useWasmModule par défaut : ${analyse.defautModule === false ? "false" : "true"})`,
    ),
  );
  const demandes = analyse.regle === null ? null : variantesDemandees(appels, analyse.prefixe, analyse.regle, analyse.defautModule);
  liste.push(
    fait(
      demandes !== null && appels.length > 0,
      appels.length === 0
        ? "aucun appel à forVisionTasks trouvé dans le site : la variante demandée est inconnue"
        : appels
            .map(
              (appel) =>
                `${appel.fichier}:${appel.ligne} → forVisionTasks(${appel.chemin}${
                  appel.indicateur === "" ? "" : `, ${appel.indicateur}`
                })`,
            )
            .join(" ; "),
    ),
  );
  if (demandes === null) return { liste, demandes: null, requis: [] };
  const requis = demandes.noms.flatMap((nom) => fichiersDeVariante(nom));
  liste.push(
    fait(
      demandes.expression === false,
      demandes.expression
        ? "un appel passe une expression : les deux variantes sont exigées"
        : `variante(s) demandée(s) : ${demandes.noms.join(", ")}`,
    ),
  );
  const publication = await verifierPublication(dossierPublie, requis);
  liste.push(
    fait(
      publication.manquants.length === 0,
      publication.manquants.length === 0
        ? `dossier publié complet : ${requis.join(", ")}`
        : `fichier(s) manquant(s) dans le dossier publié : ${publication.manquants.join(", ")}`,
    ),
  );
  const absentsDuWorker = worker.filter((nom) => !publication.presents.includes(nom));
  liste.push(
    fait(
      absentsDuWorker.length === 0,
      absentsDuWorker.length === 0
        ? `le service worker ne demande que des fichiers publiés (${worker.join(", ") || "aucun"})`
        : `le service worker demande des fichiers absents du dossier publié : ${absentsDuWorker.join(", ")}`,
    ),
  );
  return { liste, demandes, requis, publication };
}

const { liste, demandes, requis, publication } = await faits();
const echecs = liste.filter((entree) => !entree.ok);

process.stdout.write("repli processeur (AIR-N-07) — contrôle des fichiers d'exécution\n\n");
process.stdout.write(`paquet lu : ${dossierPaquet}\n`);
process.stdout.write(`dossier publié contrôlé : ${dossierPublie}\n`);
if (publication !== undefined) {
  process.stdout.write(
    `contenu du dossier publié : ${publication.presents.length > 0 ? publication.presents.join(", ") : "(vide)"}\n`,
  );
  if (publication.autres.length > 0) {
    process.stdout.write(`fichiers publiés hors variante demandée : ${publication.autres.join(", ")}\n`);
  }
}
process.stdout.write("\n");
for (const entree of liste) {
  process.stdout.write(`${entree.ok ? "✓" : "✗"} ${entree.raison}\n`);
}
process.stdout.write("\n");
if (echecs.length === 0) {
  process.stdout.write(
    `repli processeur GARANTI : le délégué processeur charge les mêmes fichiers que le délégué ` +
      `graphique (${demandes.noms.join(", ")}), le dossier publié les contient tous.\n` +
      "Sur une machine sans accélération graphique, le seul changement est le délégué : " +
      "aucun fichier supplémentaire n'est demandé, donc rien ne peut manquer.\n",
  );
  process.exit(0);
}
process.stderr.write(
  `repli processeur NON GARANTI (${echecs.length} fait(s) en échec) : le suivi des mains peut ` +
    `casser en silence sur une machine sans accélération graphique.\n` +
    `corrigez : ${echecs.map((entree) => entree.raison).join(" | ")}\n`,
);
process.exit(1);
