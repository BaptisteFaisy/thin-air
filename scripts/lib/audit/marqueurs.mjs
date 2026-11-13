/**
 * (b) et (f) Les marqueurs de travail : `todo(` restants dans `packages/` et
 * `apps/`, puis les `TODO`, `FIXME` et `HACK` du code.
 *
 * Un marqueur n'est pas une faute : c'est une dette visible. Le rapport les
 * compte et les montre, la consolidation décide.
 */
import { EXTENSIONS_CODE } from "./lecture.mjs";

/** Les répertoires où un `todo(` reste une dette de code. */
const PERIMETRE_TODO = ["packages/", "apps/"];

/** Les marqueurs cherchés dans le code. */
const MARQUEURS = ["TODO", "FIXME", "HACK"];

/** Les `todo(` restants dans `packages/` et `apps/`. */
export function todosRestants(contenus) {
  const trouves = [];
  for (const [fichier, texte] of contenus) {
    if (!PERIMETRE_TODO.some((debut) => fichier.startsWith(debut))) continue;
    for (const occurrence of occurrences(texte, /\btodo\s*\(/g)) {
      trouves.push({
        fichier,
        ligne: occurrence.ligne,
        extrait: tronquer(occurrence.texte),
      });
    }
  }
  return trouves.sort((a, b) => a.fichier.localeCompare(b.fichier) || a.ligne - b.ligne);
}

/** Les `TODO`, `FIXME` et `HACK` du code. */
export function marqueursCode(contenus, exclus = []) {
  const exclusSet = new Set(exclus);
  const trouves = [];
  for (const [fichier, texte] of contenus) {
    if (exclusSet.has(fichier)) continue;
    for (const occurrence of occurrences(texte, /\b(TODO|FIXME|HACK)\b/g)) {
      trouves.push({
        fichier,
        ligne: occurrence.ligne,
        marqueur: occurrence.marqueur,
        extrait: tronquer(occurrence.texte),
      });
    }
  }
  return trouves.sort(
    (a, b) => a.fichier.localeCompare(b.fichier) || a.ligne - b.ligne,
  );
}

/**
 * Les occurrences d'un motif, avec leur numéro de ligne et le texte de la
 * ligne. Le motif doit avoir un groupe de capture pour le marqueur.
 */
function occurrences(texte, motif) {
  const lignes = texte.split("\n");
  const trouvees = [];
  for (let i = 0; i < lignes.length; i += 1) {
    const texteLigne = lignes[i];
    motif.lastIndex = 0;
    const match = motif.exec(texteLigne);
    if (!match) continue;
    trouvees.push({
      ligne: i + 1,
      texte: texteLigne.trim(),
      marqueur: match[1] ?? match[0],
    });
  }
  return trouvees;
}

/** Un extrait de ligne, ramené à une longueur lisible. */
function tronquer(texte, maximum = 140) {
  const propre = texte.replace(/\s+/g, " ").trim();
  return propre.length > maximum ? `${propre.slice(0, maximum - 1)}…` : propre;
}

/** Les fichiers de code à passer au scan des marqueurs. */
export function fichiersDeCode(fichiers) {
  return fichiers.filter((fichier) => EXTENSIONS_CODE.has(fichier.extension));
}
