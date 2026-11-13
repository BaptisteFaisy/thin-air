/**
 * La taille d'une ressource servie, sans la télécharger.
 *
 * Une plage d'un octet suffit : la réponse dit la taille TOTALE
 * (`Content-Range: bytes 0-0/7819105`). C'est la seule mesure fiable quand
 * l'hébergeur sert le fichier compressé : un HEAD y annonce la taille
 * COMPRESSÉE (5 882 509 o pour un modèle de 7 819 105 o), et une comparaison
 * avec la taille du fichier local dirait « tronqué » à tort.
 *
 * Quand l'hébergeur répond en 200 sans `Content-Range`, la taille de
 * `Content-Length` est reprise — mais elle peut être celle du fichier
 * compressé : le résultat est alors marqué `fiable: false`, et le contrôle
 * appelant le dit au lieu de trancher sur une mesure fausse.
 *
 * UNE seule implémentation, partagée par `scripts/check-deployed.mjs` et
 * `scripts/check-offline.mjs` : les deux ne peuvent pas diverger.
 *
 * Aucun son, aucune requête hors de l'adresse testée : une requête d'un
 * octet, jamais le fichier (AIR-N-01, AIR-N-02).
 */

/** Le délai maximal d'une mesure, en millisecondes. */
const DELAI_MS = 20_000;

/**
 * Mesure la taille d'une ressource servie.
 *
 * Renvoie `{ statut, taille, fiable }` : `taille` est la taille totale quand
 * l'hébergeur la donne, `null` quand il ne la donne pas du tout ; `fiable`
 * dit si cette taille vient d'un `Content-Range` (donc du fichier entier).
 * Lève l'erreur du réseau si l'adresse est injoignable.
 */
export async function tailleServeur(url, { delaiMs = DELAI_MS } = {}) {
  const reponse = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(delaiMs),
    headers: { Range: "bytes=0-0" },
  });
  const entete = reponse.headers.get("content-range") ?? "";
  const total = entete.includes("/") ? Number(entete.slice(entete.lastIndexOf("/") + 1)) : 0;
  const longueur = Number(reponse.headers.get("content-length") ?? 0);
  await reponse.body?.cancel().catch(() => {});
  if (total > 0) return { statut: reponse.status, taille: total, fiable: true };
  if (reponse.status === 200) {
    return { statut: reponse.status, taille: longueur === 0 ? null : longueur, fiable: false };
  }
  return { statut: reponse.status, taille: null, fiable: false };
}
