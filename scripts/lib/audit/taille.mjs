/**
 * (a) La taille : fichiers de code au-delà de 500 lignes, fonctions au-delà
 * de 50 lignes (règle du dépôt, `docs/CONTRACT.md` §3).
 *
 * Le découpage des fonctions est une heuristique de lecture des accolades :
 * elle compte les lignes d'une fonction, pas sa complexité. Une fonction
 * signalée est une piste à regarder, pas un verdict (voir le rapport).
 */
import { compterLignes, MOTS_RESERVES, neutreiser } from "./lecture.mjs";

/** Le seuil de lignes d'un fichier de code. */
export const SEUIL_FICHIER = 500;

/** Le seuil de lignes d'une fonction. */
export const SEUIL_FONCTION = 50;

/** Les fichiers de code trop longs. */
export function fichiersTropLongs(contenus, seuil = SEUIL_FICHIER) {
  const tropLongs = [];
  for (const [fichier, texte] of contenus) {
    const lignes = compterLignes(texte);
    if (lignes > seuil) tropLongs.push({ fichier, lignes });
  }
  return tropLongs.sort((a, b) => b.lignes - a.lignes);
}

/** Les fonctions trop longues, avec leur fichier et leurs bornes. */
export function fonctionsTropLonges(contenus, seuil = SEUIL_FONCTION) {
  const tropLongues = [];
  for (const [fichier, texte] of contenus) {
    tropLongues.push(...fonctionsDUnFichier(fichier, texte, seuil));
  }
  return tropLongues.sort((a, b) => b.lignes - a.lignes);
}

/** Les fonctions trop longues d'un seul fichier. */
function fonctionsDUnFichier(fichier, texte, seuil) {
  const lignes = neutreiser(texte).split("\n");
  const trouvees = [];
  let profondeur = 0;
  const ouverts = [];
  for (let i = 0; i < lignes.length; i += 1) {
    const nom = detecteDebut(ligne(lignes[i]));
    const delta = deltaAccolades(lignes[i]);
    if (nom && delta > 0) ouverts.push({ nom, debut: i + 1, profondeur });
    profondeur += delta;
    while (ouverts.length > 0 && ouverts[ouverts.length - 1].profondeur === profondeur) {
      const fermee = ouverts.pop();
      const longueur = i + 1 - fermee.debut + 1;
      if (longueur > seuil) {
        trouvees.push({ fichier, nom: fermee.nom, debut: fermee.debut, fin: i + 1, lignes: longueur });
      }
    }
  }
  return trouvees;
}

/** Une ligne, sans sa fin de ligne. */
function ligne(texte) {
  return texte.replace(/\r$/, "");
}

/** Le nombre d'accolades ouvertes moins fermées sur une ligne. */
function deltaAccolades(texte) {
  let delta = 0;
  for (const caractere of texte) {
    if (caractere === "{") delta += 1;
    else if (caractere === "}") delta -= 1;
  }
  return delta;
}

/**
 * Le nom d'une fonction si la ligne en ouvre une, sinon rien. Les mots
 * réservés (`if`, `for`, …) ne sont jamais des fonctions.
 */
export function detecteDebut(texte) {
  const t = texte.trim();
  if (!t) return null;
  const nommee = /\b(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)?/.exec(t);
  if (nommee) return nommee[1] ?? "(anonyme)";
  const flechee = /([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/.exec(t);
  if (flechee) return flechee[1];
  const bloc = /\b(it|test|describe)\s*\(/.exec(t);
  if (bloc) return `${bloc[1]}(…)`;
  if (/=>\s*\{/.test(t)) return "(fléchée)";
  const methode = /^(?:export\s+)?(?:public\s+|private\s+|protected\s+|static\s+|readonly\s+|abstract\s+|override\s+|async\s+|get\s+|set\s+)*\*?\s*([A-Za-z_$][\w$]*)\s*\([^;]*\)\s*(?::[^=]*)?\{/.exec(t);
  if (methode && !MOTS_RESERVES.has(methode[1])) return methode[1];
  return null;
}
