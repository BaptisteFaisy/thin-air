/**
 * (e) Les documents : ceux que ni le README ni un autre document ne cite.
 *
 * Un document orphelin n'est pas perdu : il peut être lu par une personne,
 * par une garde ou par un script. Le rapport le signale comme une piste.
 */

/** Les documents d'entrée de dépôt : jamais orphelins par construction. */
const ENTREE = new Set(["README.md", "NOTICE.md", "LICENSE"]);

/**
 * Les documents sans lien vers eux depuis le README ou un autre document.
 * `exclus` permet de ne pas signaler le rapport lui-même.
 */
export function documentsOrphelins(fichiers, contenus, exclus = []) {
  const docs = fichiers.filter((fichier) => fichier.doc);
  const exclusSet = new Set(exclus);
  const orphelins = [];
  for (const doc of docs) {
    if (ENTREE.has(doc.relatif)) continue;
    if (exclusSet.has(doc.relatif)) continue;
    if (estCite(doc, docs, contenus, exclusSet)) continue;
    orphelins.push({ document: doc.relatif });
  }
  return orphelins.sort((a, b) => a.document.localeCompare(b.document));
}

/**
 * Un document est-il cité par un autre document du dépôt ? Le rapport
 * lui-même n'est pas une source : il listerait les orphelins qu'il vient
 * de trouver, et le compte ne convergerait jamais.
 */
function estCite(doc, docs, contenus, exclusSet) {
  const nom = doc.relatif.split("/").pop();
  const chemin = doc.relatif.replace(/\.md$/, "");
  for (const autre of docs) {
    if (autre.relatif === doc.relatif) continue;
    if (exclusSet.has(autre.relatif)) continue;
    const texte = contenus.get(autre.relatif);
    if (!texte) continue;
    if (texte.includes(nom)) return true;
    if (texte.includes(chemin)) return true;
  }
  return false;
}

/** Le nombre de documents du dépôt (pour situer les orphelins). */
export function nombreDocuments(fichiers) {
  return fichiers.filter((fichier) => fichier.doc).length;
}
