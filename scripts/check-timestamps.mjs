/**
 * Contrôle des horodatages — une seule horloge, un seul format.
 *
 * La règle du projet (docs/horodatage.md) : un instant s'écrit en UTC, ISO
 * 8601, à la milliseconde ; une durée s'écrit en millisecondes entières ; une
 * date locale ne vit pas dans un nom de fichier ; un rapport ne dit jamais
 * « il y a trois minutes ».
 *
 * Ce contrôle relit les rapports et documents listés dans `RAPPORTS` et
 * signale tout ce qui s'écarte de la règle. Il sort en code 1 dès qu'il
 * trouve une faute, comme `scripts/check-budget.mjs` pour le budget CI.
 *
 * Usage : `node scripts/check-timestamps.mjs [chemin…]` → 0 si tout est vert.
 * Node pur, lecture seule, aucun réseau, aucun son.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Les rapports et documents sous surveillance, dans l'ordre du dépôt. */
export const RAPPORTS = [
  "docs/horodatage.md",
  "docs/postmortem.md",
  "docs/submission.md",
  "docs/recette.md",
  "docs/disponibilite.md",
  "docs/latency.md",
  "docs/accessibility-report.md",
  "docs/audit-rapport.md",
  "docs/prises-reelles.md",
  "docs/journal.md",
];

/** Un instant canonique : retiré de la ligne avant toute autre recherche. */
const ISO_CANONIQUE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g;

/** Une date-heure qui n'est pas canonique (séparateur, fuseau, millisecondes). */
const ISO_NON_CANONIQUE = /\d{4}-\d{2}-\d{2}[T ]\d{1,2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?(?:Z|[+-]\d{2}:?\d{2})?/g;

/** Une date seule, sans heure. */
const DATE = /\b\d{4}-\d{2}-\d{2}\b/g;

/** Une heure d'horloge murale. */
const HEURE = /\b\d{1,2}:\d{2}(?::\d{2})?\b/g;

/** Une heure d'horloge murale porteuse d'un fuseau : elle se veut précise. */
const HEURE_FUSEAU = /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:UTC|GMT|CET|CEST|[+-]\d{2}:?\d{2})\b/g;

/**
 * Une heure d'horloge murale seule. Le seuil à dix heures sépare les
 * instants d'un rapport des repères d'un média (un timecode de plan ne
 * dépasse pas quelques minutes) : sous ce seuil, l'ambiguïté est trop forte
 * pour être signalée à coup sûr.
 */
const HEURE_SEULE = /\b(?:[1-9]\d|1\d{2}):\d{2}(?::\d{2})?\b/g;

/** Une heure d'horloge en UTC, à la milliseconde : comparable, donc retirée
 * comme un instant canonique avant toute recherche. */
const HEURE_UTC = /\b\d{1,2}:\d{2}:\d{2}\.\d{3}Z\b/g;

/** Une durée écrite dans une autre unité que la milliseconde. */
const DUREE =
  /\b\d+(?:[.,]\d+)?\s*(?:h|heure|heures)\b(?:\s*\d+\s*(?:min|minute|minutes)\b)?|\b\d+(?:[.,]\d+)?\s*(?:min|minute|minutes)\b|\b\d+(?:[.,]\d+)?\s*(?:s|sec|seconde|secondes)\b/g;

/** Une durée relative : elle n'est comparable à rien. */
const RELATIVE = /\b(?:il y a|depuis)\s+\d+|à l'instant|tout à l'heure/gi;

/** Un nom de fichier qui porte une date locale. */
const FICHIER_DATE = /\b[\w./-]*\d{4}-\d{2}-\d{2}[\w./-]*\.[A-Za-z0-9]{1,6}\b/g;

/** La date d'un nom de fichier, quand elle n'est pas suivie d'une heure. */
const DATE_DANS_NOM = /\d{4}-\d{2}-\d{2}(?![T_]\d{2}[-_]\d{2})/;

/** Une faute, telle qu'elle est affichée. */
function decrire(faute) {
  return `${faute.fichier}:${faute.ligne} : ${faute.message} — « ${faute.extrait.trim()} »`;
}

/**
 * Les fautes d'une ligne : un instant non canonique, une heure d'horloge
 * murale, une durée hors millisecondes, une durée relative, un nom de
 * fichier daté.
 */
export function analyserLigne(ligne, fichier = "-", numero = 0) {
  const fautes = [];
  const reste = ligne.replace(ISO_CANONIQUE, " ").replace(HEURE_UTC, " ");
  const ajouter = (message, extrait) =>
    fautes.push({ fichier, ligne: numero, message, extrait });

  for (const trouve of reste.matchAll(ISO_NON_CANONIQUE)) {
    ajouter("instant non canonique (attendu : UTC, ISO 8601, milliseconde)", trouve[0]);
  }

  const heuresFuseau = [...reste.matchAll(HEURE_FUSEAU)];
  for (const trouve of heuresFuseau) {
    ajouter("heure d'horloge murale : un instant se dit en UTC, pas avec un fuseau local", trouve[0]);
  }

  if (heuresFuseau.length === 0) {
    const dates = [...reste.matchAll(DATE)];
    const heures = [...reste.matchAll(HEURE)];
    if (dates.length > 0 && heures.length > 0) {
      ajouter("date et heure d'horloge murale sur la même ligne", heures[0][0]);
    } else {
      for (const trouve of reste.matchAll(HEURE_SEULE)) {
        ajouter("heure d'horloge murale seule : un instant se dit en UTC, à la milliseconde", trouve[0]);
      }
    }
  }

  for (const trouve of reste.matchAll(DUREE)) {
    ajouter("durée hors millisecondes entières", trouve[0]);
  }

  for (const trouve of reste.matchAll(RELATIVE)) {
    ajouter("durée relative : une durée se dit en millisecondes entières", trouve[0]);
  }

  for (const trouve of ligne.matchAll(FICHIER_DATE)) {
    if (DATE_DANS_NOM.test(trouve[0])) {
      ajouter("date locale dans un nom de fichier", trouve[0]);
    }
  }

  return fautes;
}

/** Les fautes d'un document entier, ligne par ligne. */
export function analyserDocument(contenu, fichier = "-") {
  const fautes = [];
  const lignes = contenu.split("\n");
  for (let index = 0; index < lignes.length; index += 1) {
    fautes.push(...analyserLigne(lignes[index], fichier, index + 1));
  }
  return fautes;
}

/** Les fautes de tous les documents demandés (les rapports par défaut). */
export function analyserDepot(racine, cibles = RAPPORTS) {
  const fautes = [];
  for (const cible of cibles) {
    const chemin = join(racine, cible);
    let contenu = "";
    try {
      contenu = readFileSync(chemin, "utf8");
    } catch {
      fautes.push({
        fichier: cible,
        ligne: 0,
        message: "document introuvable",
        extrait: cible,
      });
      continue;
    }
    fautes.push(...analyserDocument(contenu, cible));
    const nom = chemin.split(sep).pop() ?? cible;
    if (DATE_DANS_NOM.test(nom)) {
      fautes.push({
        fichier: cible,
        ligne: 0,
        message: "date locale dans un nom de fichier",
        extrait: nom,
      });
    }
  }
  return fautes;
}

/** Point d'entrée : affiche le rapport et rend un code non nul s'il y a faute. */
export function principale(argv) {
  const racine = resolve(join(ICI, ".."));
  const cibles = argv.length > 0 ? argv : RAPPORTS;
  const fautes = analyserDepot(racine, cibles);
  for (const faute of fautes) {
    process.stdout.write(`  ✗ ${decrire(faute)}\n`);
  }
  for (const faute of fautes) {
    process.stderr.write(`::error::${decrire(faute)}\n`);
  }
  process.stdout.write(
    `horodatages : ${cibles.length} document(s), ${fautes.length} faute(s)` +
      " — un seul format : UTC, ISO 8601, millisecondes entières\n",
  );
  return fautes.length === 0 ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(principale(process.argv.slice(2)));
}
