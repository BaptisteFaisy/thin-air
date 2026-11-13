/**
 * (g) Les doublons : fichiers identiques, ou presque, par empreinte du
 * contenu normalisé.
 *
 * Trois empreintes, de la plus forte à la plus faible :
 *   - identique  : le contenu brut est le même ;
 *   - normalisé  : commentaires et espaces effacés, le reste pareil ;
 *   - quasi      : identifiants et littéraux remplacés, la forme pareil.
 * Le quasi-doublon attrape deux copies d'un même modèle, renommées.
 */
import { hacher, normaliserFinsDeLigne, sansCommentaires, formeGenerique } from "./lecture.mjs";

/** Sous ce nombre de lignes, deux fichiers ressemblent trop pour interests. */
const LIGNES_MINIMALES = 5;

/** Les groupes de fichiers dupliqués ou quasi dupliqués. */
export function doublons(fichiers, contenus) {
  const categories = [
    { nom: "identique", empreinte: (texte) => hacher(normaliserFinsDeLigne(texte)) },
    { nom: "normalisé", empreinte: (texte) => hacher(sansCommentaires(normaliserFinsDeLigne(texte)).replace(/\s+/g, " ").trim()) },
    { nom: "quasi", empreinte: (texte) => hacher(formeGenerique(normaliserFinsDeLigne(texte))) },
  ];
  const groupes = [];
  for (const categorie of categories) {
    groupes.push(...groupesDe(categorie, fichiers, contenus));
  }
  return groupes;
}

/** Les groupes d'une catégorie d'empreinte. */
function groupesDe(categorie, fichiers, contenus) {
  const parEmpreinte = new Map();
  for (const fichier of fichiers) {
    const texte = contenus.get(fichier.relatif);
    if (!texte || texte.trim() === "") continue;
    if (compterLignesUtiles(texte) < LIGNES_MINIMALES) continue;
    const empreinte = categorie.empreinte(texte);
    if (!parEmpreinte.has(empreinte)) parEmpreinte.set(empreinte, []);
    parEmpreinte.get(empreinte).push(fichier.relatif);
  }
  const groupes = [];
  for (const [empreinte, membres] of parEmpreinte) {
    if (membres.length < 2) continue;
    groupes.push({
      categorie: categorie.nom,
      empreinte: empreinte.slice(0, 12),
      fichiers: [...membres].sort(),
    });
  }
  return groupes.sort((a, b) => b.fichiers.length - a.fichiers.length || a.categorie.localeCompare(b.categorie));
}

/** Le nombre de lignes non vides d'un texte. */
function compterLignesUtiles(texte) {
  return texte.split("\n").filter((ligne) => ligne.trim() !== "").length;
}
