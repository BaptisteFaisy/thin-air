/**
 * Lecture du dépôt pour l'audit automatique (`scripts/audit-depot.mjs`).
 *
 * Le module ne fait que lire des fichiers et rendre des structures simples :
 * aucun son, aucun réseau, aucun périphérique (AIR-N-02, AIR-N-01).
 *
 * Le parcours de fichiers est repris des gardes (`scripts/hooks/lib/io.mjs`) :
 * une seule implémentation du parcours dans le dépôt.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import { extensionDe, fichiersSous } from "../../hooks/lib/io.mjs";

/** Extensions qui portent du code (la règle des 500 lignes s'y applique). */
export const EXTENSIONS_CODE = new Set([
  ".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs",
]);

/** Dossiers jamais parcourus : dépendances, build, sorties, gros modèles. */
export const DOSSIERS_IGNORES = [
  "node_modules", ".git", "out", "dist", "bench-out", "coverage", "models", ".vite",
];

/** Extensions lisibles comme du texte (code, documents, manifestes). */
export const EXTENSIONS_TEXTE = new Set([
  ...EXTENSIONS_CODE, ".md", ".mdx", ".txt", ".json", ".yml", ".yaml", ".html", ".css",
]);

/** Parcourt le dépôt et rend chaque fichier, avec sa nature. */
export async function listerFichiers(racine) {
  const fichiers = [];
  for await (const chemin of fichiersSous(racine, { ignores: DOSSIERS_IGNORES })) {
    const extension = extensionDe(chemin);
    if (!EXTENSIONS_TEXTE.has(extension)) continue;
    fichiers.push({
      chemin,
      relatif: relative(racine, chemin).split("\\").join("/"),
      extension,
      code: EXTENSIONS_CODE.has(extension),
      doc: extension === ".md",
    });
  }
  return fichiers.sort((a, b) => a.relatif.localeCompare(b.relatif));
}

/** Le contenu texte d'un fichier listé. */
export async function lire(fichier) {
  return await readFile(fichier.chemin, "utf8");
}

/** Le nombre de lignes réelles d'un texte (la ligne finale vide ne compte pas). */
export function compterLignes(texte) {
  if (texte === "") return 0;
  const lignes = texte.split("\n");
  if (lignes[lignes.length - 1] === "") lignes.pop();
  return lignes.length;
}

/** Une empreinte de contenu (sha256, hexadécimal). */
export function hacher(texte) {
  return createHash("sha256").update(texte, "utf8").digest("hex");
}

/** Les fins de ligne, normalisées : la comparaison ignore CRLF. */
export function normaliserFinsDeLigne(texte) {
  return texte.replace(/\r\n/g, "\n");
}

/** Les commentaires remplacés par des espaces, les chaînes conservées. */
export function sansCommentaires(source) {
  let sortie = "";
  let i = 0;
  while (i < source.length) {
    const deux = source.slice(i, i + 2);
    if (deux === "/*") {
      const fin = source.indexOf("*/", i + 2);
      const stop = fin < 0 ? source.length : fin + 2;
      sortie += source.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
      continue;
    }
    if (deux === "//") {
      const fin = source.indexOf("\n", i);
      const stop = fin < 0 ? source.length : fin;
      sortie += " ".repeat(stop - i);
      i = stop;
      continue;
    }
    if (source[i] === '"' || source[i] === "'" || source[i] === "`") {
      const stop = finChaine(source, i);
      sortie += source.slice(i, stop);
      i = stop;
      continue;
    }
    sortie += source[i];
    i += 1;
  }
  return sortie;
}

/** La fin d'une chaîne littérale (guillemet simple, double ou arrière). */
function finChaine(source, debut) {
  const delimiteur = source[debut];
  let i = debut + 1;
  while (i < source.length) {
    if (source[i] === "\\") {
      i += 2;
      continue;
    }
    if (source[i] === delimiteur) return i + 1;
    i += 1;
  }
  return source.length;
}

/**
 * Le texte sans commentaires ni contenu de chaînes : les accolades qu'il
 * reste sont les accolades du code, ce qui permet de compter la profondeur.
 */
export function neutreiser(source) {
  return sansCommentaires(source).replace(/"[^"\n]*"|'[^'\n]*'|`[^`]*`/g, (morceau) =>
    morceau.replace(/[^\n]/g, " "),
  );
}

/** Les mots qui ne sont jamais un nom de fonction. */
export const MOTS_RESERVES = new Set([
  "if", "for", "while", "switch", "catch", "return", "do", "else", "try",
  "finally", "typeof", "await", "yield", "case", "of", "in", "new",
]);

/** Les mots qui restent lisibles dans la forme générique d'un code. */
const MOTS_CLE = new Set([
  ...MOTS_RESERVES, "function", "class", "const", "let", "var", "export", "default",
  "import", "from", "as", "async", "await", "type", "interface", "enum", "extends",
  "implements", "public", "private", "protected", "static", "readonly", "get", "set",
]);

/**
 * La forme générique d'un code : commentaires retirés, identifiants et
 * littéraux remplacés. Deux fichiers qui ne diffèrent que par le nom de
 * leurs variables ont la même forme : c'est le quasi-doublon.
 */
export function formeGenerique(source) {
  const sans = sansCommentaires(source);
  const sansTextes = sans.replace(/"[^"\n]*"|'[^'\n]*'|`[^`]*`/g, "lit");
  const sansNoms = sansTextes.replace(/[A-Za-z_$][\w$]*/g, (mot) =>
    MOTS_CLE.has(mot) ? mot : "id",
  );
  const sansNombres = sansNoms.replace(/\b\d[\d_.]*\b/g, "num");
  return sansNombres.replace(/\s+/g, " ").trim();
}

/**
 * Les modules importés par un fichier, sans doublon. Les chaînes sont
 * masquées avant la recherche : un `from "..."` écrit dans une chaîne
 * (une fixture de test, par exemple) n'est pas un import.
 */
export function modulesImportes(source) {
  const { code, chaines } = masquer(source);
  const motifs = [
    /\bfrom\s*"@@(\d+)@@"/g,
    /\bimport\s*\(\s*"@@(\d+)@@"\s*\)/g,
    /\brequire\s*\(\s*"@@(\d+)@@"\s*\)/g,
    /\bimport\s+"@@(\d+)@@"/g,
  ];
  const trouves = new Set();
  for (const motif of motifs) {
    for (const match of code.matchAll(motif)) {
      const spec = chaines[Number(match[1])];
      if (spec && !/\s/.test(spec)) trouves.add(spec);
    }
  }
  return [...trouves];
}

/**
 * Le code sans ses chaînes, et les chaînes à part. Chaque chaîne du code
 * est remplacée par `@@n@@`, n étant son rang : les deux listes se suivent.
 */
export function masquer(source) {
  const sans = sansCommentaires(source);
  const chaines = [];
  let code = "";
  let i = 0;
  while (i < sans.length) {
    const caractere = sans[i];
    if (caractere === '"' || caractere === "'" || caractere === "`") {
      const stop = finChaine(sans, i);
      chaines.push(sans.slice(i + 1, Math.max(i + 1, stop - 1)));
      code += `"@@${chaines.length - 1}@@"`;
      i = stop;
      continue;
    }
    code += caractere;
    i += 1;
  }
  return { code, chaines };
}

/** Les fichiers désignés par `new URL(...)` ou par un motif de glob. */
export function referencesSpeciales(source) {
  const { code, chaines } = masquer(source);
  const urls = [];
  const globs = [];
  for (const match of code.matchAll(/\bnew\s+URL\s*\(\s*"@@(\d+)@@"/g)) {
    urls.push(chaines[Number(match[1])]);
  }
  for (const match of code.matchAll(/\bimport\.meta\.glob\s*\(\s*"@@(\d+)@@"/g)) {
    globs.push(chaines[Number(match[1])]);
  }
  return { urls, globs };
}

/** Un motif de glob devient une expression régulière. */
export function globEnMotif(motif) {
  const morceaux = motif.split(/(\*\*|\*)/).map((morceau) => {
    if (morceau === "**") return ".*";
    if (morceau === "*") return "[^/]*";
    return morceau.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  });
  return new RegExp(`^${morceaux.join("")}$`);
}

/** Le nom du paquet d'un module nu (« react/jsx-runtime » → « react »). */
export function nomPaquet(specificateur) {
  if (specificateur.startsWith("@")) {
    const morceaux = specificateur.split("/");
    return morceaux.slice(0, 2).join("/");
  }
  return specificateur.split("/")[0];
}
