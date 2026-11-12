/**
 * Formatage partagé des poids (`scripts/fetch-model.mjs`,
 * `scripts/poids-publication.mjs`) : une seule implémentation pour tous les
 * relevés (règle 4 du contrat, zéro duplication). Mégaoctets décimaux
 * (1 Mo = 1 000 000 octets) — la convention de la sortie historique de
 * `fetch-model.mjs` ; `docs/poids-publication.md` la rappelle, car certains
 * relevés de `docs/latency.md` utilisent le Mo binaire (1 048 576 octets).
 * Aucune requête réseau, aucun son : pur formatage.
 */

/** Formate un poids : octets bruts, puis mégaoctets décimaux. */
export function formaterPoids(octets) {
  return `${octets} octets (${(octets / 1e6).toFixed(2)} Mo)`;
}
