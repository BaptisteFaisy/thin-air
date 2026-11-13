#!/usr/bin/env node
/**
 * Garde « le repli processeur est garanti » (AIR-N-07, consolidation n°7).
 *
 * Le site sert lui-même les fichiers d'exécution du modèle (§11.9) : une
 * seule variante de wasm est publiée, pour ne pas faire télécharger 14,9 Mo
 * morts au visiteur. Cette variante doit être celle que le chargeur demande,
 * ET le service worker doit préchauffer exactement les fichiers publiés :
 * sinon le suivi des mains casse en silence — et le repli sur le processeur
 * (une machine sans accélération graphique) casse avec lui.
 *
 * Cette garde est STATIQUE : elle compare ce que le site demande (lu dans le
 * paquet `@mediapipe/tasks-vision` installé et dans les appels du site) à ce
 * que le service worker précharge. Elle ne construit rien, ne télécharge
 * rien, ne joue aucun son. Le contrôle complet, sur le site construit, est
 * `scripts/check-wasm.mjs`.
 *
 * Usage CI : `node scripts/hooks/wasm-guard.mjs` → 0 si tout concorde.
 */
import { join } from "node:path";
import {
  analyserPaquet,
  appelsForVisionTasks,
  fichiersDemandes,
  referencesDuWorker,
} from "../lib/wasm.mjs";

const RACINE = process.cwd();
const PAQUET = join(RACINE, "node_modules", "@mediapipe", "tasks-vision");

const analyse = await analyserPaquet(PAQUET);
if (analyse.regle === null || analyse.prefixe === null) {
  // Le paquet n'est pas installé : ce n'est pas une faute du dépôt.
  process.stdout.write(
    "paquet @mediapipe/tasks-vision absent : contrôle des fichiers d'exécution impossible ici " +
      "(scripts/check-wasm.mjs le fait sur le site construit)\n",
  );
  process.exit(0);
}

const appels = await appelsForVisionTasks(RACINE);
const demandes = fichiersDemandes(appels, analyse.prefixe, analyse.regle, analyse.defautModule);
const worker = await referencesDuWorker(RACINE);

const absents = worker.filter((nom) => !demandes.includes(nom));
const oublies = demandes.filter((nom) => !worker.includes(nom));

let echec = false;
if (absents.length > 0) {
  echec = true;
  process.stderr.write(
    `::error::le service worker demande des fichiers d'exécution que le site ne demande pas : ` +
      `${absents.join(", ")} — ils ne sont pas publiés, le préchauffage échoue en silence.\n`,
  );
}
if (oublies.length > 0) {
  echec = true;
  process.stderr.write(
    `::error::le service worker ne préchauffe pas les fichiers d'exécution demandés par le site : ` +
      `${oublies.join(", ")} — le mode hors ligne serait incomplet.\n`,
  );
}
if (echec) {
  process.stderr.write(
    "le repli processeur n'est pas garanti : le service worker et le chargeur doivent " +
      "demander les mêmes fichiers (preuve : docs/poids-publication.md).\n",
  );
  process.exit(1);
}
process.stdout.write(
  `fichiers d'exécution : le site demande ${demandes.join(", ")} — le service worker ` +
    "préchauffe exactement ces fichiers ; le repli processeur est garanti.\n",
);
