/**
 * L'horloge unique du dépôt — une seule façon d'écrire un instant.
 *
 * Thin Air compare des rapports venus de machines différentes (le poste `pc`,
 * les runners `r630`). Pour que ces rapports soient comparables, un instant
 * s'écrit toujours de la même façon : UTC, ISO 8601, à la milliseconde —
 * `2026-12-01T14:05:33.412Z`. Jamais une heure locale, jamais une date seule,
 * jamais une durée relative. La règle complète est dans `docs/horodatage.md`.
 *
 * Ce module est le seul endroit du dépôt qui écrit un instant : les scripts,
 * les gardes et les rapports importent `maintenant()` et `iso(d)`. Le contrôle
 * `scripts/check-timestamps.mjs` relit les rapports et refuse tout autre
 * format.
 *
 * Aucun son, aucune requête réseau, aucun périphérique : ce module ne fait
 * que lire l'horloge (AIR-N-02).
 */

/** Le format unique d'un instant : UTC, ISO 8601, à la milliseconde. */
export const FORMAT_ISO_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** Les unités, en millisecondes entières : c'est la seule unité de durée. */
export const MS_PAR_SECONDE = 1_000;
export const MS_PAR_MINUTE = 60_000;
export const MS_PAR_HEURE = 3_600_000;

/**
 * L'horloge par défaut : l'heure système, en millisecondes depuis l'époque
 * Unix. Elle est injectable partout (`maintenant(horloge)`) pour que les
 * tests n'aient jamais à attendre — et pour que la monotonicité se prouve.
 */
export function horlogeSysteme() {
  return Date.now();
}

/** Convertit une date (ou un nombre de millisecondes) en instant canonique. */
export function iso(d = new Date()) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("iso(d) : date invalide");
  }
  return date.toISOString();
}

/** L'instant courant, au format canonique. L'horloge est injectable. */
export function maintenant(horloge = horlogeSysteme) {
  return iso(typeof horloge === "function" ? horloge() : horloge);
}

/** Vrai si le texte est déjà un instant canonique. */
export function estIsoUtcMs(texte) {
  return typeof texte === "string" && FORMAT_ISO_MS.test(texte);
}

/** L'instant canonique en millisecondes entières depuis l'époque Unix. */
export function millisecondes(texte) {
  if (!estIsoUtcMs(texte)) {
    throw new TypeError(`millisecondes(texte) : « ${texte} » n'est pas un instant canonique`);
  }
  return Date.parse(texte);
}

/** La durée entre deux instants, en millisecondes entières. */
export function dureeMs(debut, fin) {
  return millisecondes(fin) - millisecondes(debut);
}

/**
 * Une horloge strictement croissante : deux appels successifs ne rendent jamais
 * le même instant. Utile quand plusieurs événements tombent dans la même
 * milliseconde — l'ordre des rapports reste alors lisible.
 */
export function horlogeMonotone(horloge = horlogeSysteme) {
  let precedent = Number.NEGATIVE_INFINITY;
  return () => {
    const instant = Math.max(Number(horloge()), precedent + 1);
    precedent = instant;
    return instant;
  };
}

/**
 * L'instant canonique, dans la forme admise par un nom de fichier : les `:`
 * deviennent des `-` (un `:` est illisible pour certains outils). Le contrôle
 * `scripts/check-timestamps.mjs` reconnaît cette forme comme canonique.
 */
export function instantFichier(d = new Date()) {
  return iso(d).replace(/:/g, "-");
}
