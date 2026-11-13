#!/usr/bin/env node
/**
 * Vérification du formatage — les règles de `.editorconfig`, sans dépendance.
 *
 * Le script ne réinvente pas les règles : il lit `.editorconfig` à la racine
 * du dépôt et applique, fichier par fichier, ce qui y est écrit :
 *
 *   charset = utf-8            → le contenu est de l'UTF-8 valide
 *   end_of_line = lf           → aucun retour à la ligne CR (donc pas de CRLF)
 *   indent_style = space       → aucune tabulation
 *   insert_final_newline       → le fichier se termine par un saut de ligne
 *   trim_trailing_whitespace   → aucune espace en fin de ligne
 *
 * Un fichier texte ne doit pas être vide non plus : c'est la seule règle qui
 * n'a pas de clé dans `.editorconfig`.
 *
 * Deux listes de fichiers sont ignorées, chacune pour une raison :
 *   - les fichiers binaires (extension connue ou octet nul dans l'en-tête) :
 *     un modèle de vision ou une image ne se corrige pas au saut de ligne ;
 *   - les fichiers listés dans `scripts/format-heritage.txt` : ils précèdent
 *     l'adoption des règles et sont signalés sans bloquer.
 *
 * Aucun son, aucune requête réseau, aucune dépendance : le script lit des
 * fichiers et écrit des lignes (AIR-N-02, AIR-N-01).
 *
 * Usage : `node scripts/check-format.mjs [racine]` → 0 si tout est conforme,
 * 1 sinon (une ligne par problème, sur la sortie d'erreur).
 */
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const FICHIER_HERITAGE = join(ICI, "format-heritage.txt");

/** Règles par défaut, appliquées quand le dépôt n'a pas de `.editorconfig`. */
const REGLES_DEFAUT = {
  charset: "utf-8",
  end_of_line: "lf",
  indent_style: "space",
  insert_final_newline: "true",
  trim_trailing_whitespace: "true",
};

/** Dossiers jamais parcourus (dépendances, sorties, caches). */
const DOSSIERS_IGNORES = new Set([
  ".git",
  ".cache",
  ".next",
  "bench-out",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "__pycache__",
]);

/** Extensions binaires : leur contenu ne se corrige pas au formatage. */
const EXTENSIONS_BINAIRES = new Set([
  ".bmp",
  ".bz2",
  ".db",
  ".dll",
  ".dylib",
  ".eot",
  ".exe",
  ".flac",
  ".gif",
  ".gz",
  ".ico",
  ".jpeg",
  ".jpg",
  ".m4a",
  ".mov",
  ".mp3",
  ".mp4",
  ".ogg",
  ".onnx",
  ".otf",
  ".pdf",
  ".png",
  ".pyc",
  ".so",
  ".sqlite",
  ".task",
  ".tgz",
  ".tflite",
  ".ttf",
  ".wasm",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
  ".xz",
  ".zip",
]);

/** Au-delà, le fichier n'est pas un texte source : il n'est pas vérifié. */
const TAILLE_MAX = 5 * 1024 * 1024;

/** Un motif de `.editorconfig` (`*`, `**`, `?`) devient une expression. */
export function motifVersRegExte(motif) {
  const source = motif
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*")
    .replace(/\?/g, "[^/]");
  return new RegExp(`^${source}$`);
}

/** Lit `.editorconfig` : une liste de sections `{ motif, regles }`. */
export function analyserConfig(texte) {
  const sections = [];
  let courante = null;
  for (const ligne of texte.split("\n")) {
    const nette = ligne.replace(/\s*[#;].*$/, "").trim();
    if (!nette) continue;
    const entete = nette.match(/^\[(.+)\]$/);
    if (entete) {
      courante = { motif: entete[1].trim(), regles: {} };
      sections.push(courante);
      continue;
    }
    const pair = nette.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*(.*)$/);
    if (pair && courante) courante.regles[pair[1].toLowerCase()] = pair[2].trim();
  }
  return sections;
}

/** Les règles qui s'appliquent à un chemin donné (la dernière section gagne). */
export function reglesPour(chemin, sections) {
  const regles = { ...REGLES_DEFAUT };
  for (const section of sections) {
    if (motifVersRegExte(section.motif).test(chemin)) Object.assign(regles, section.regles);
  }
  return regles;
}

/** La configuration du dépôt, ou une liste vide s'il n'y a pas de fichier. */
function lireConfig(racine) {
  try {
    return analyserConfig(readFileSync(join(racine, ".editorconfig"), "utf8"));
  } catch {
    return [];
  }
}

/** Les fichiers hérités : un chemin par ligne, les `#` sont des commentaires. */
function heritage() {
  try {
    return new Set(
      readFileSync(FICHIER_HERITAGE, "utf8")
        .split("\n")
        .map((ligne) => ligne.trim())
        .filter((ligne) => ligne && !ligne.startsWith("#")),
    );
  } catch {
    return new Set();
  }
}

/** Les fichiers suivis par git (suivis et nouveaux, hors ignorés). */
function listerParGit(racine) {
  try {
    const haut = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: racine,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (resolve(haut) !== resolve(racine)) return null;
    const sortie = execFileSync(
      "git",
      ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
      { cwd: racine, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] },
    );
    return sortie.split("\0").filter(Boolean);
  } catch {
    return null;
  }
}

/** Le parcours du dossier, pour un arbre qui n'est pas un dépôt git. */
function listerParParcours(racine, prefixe = "") {
  const fichiers = [];
  let entrees;
  try {
    entrees = readdirSync(join(racine, prefixe), { withFileTypes: true });
  } catch {
    return fichiers;
  }
  for (const entree of entrees) {
    if (entree.isSymbolicLink()) continue;
    const chemin = prefixe ? `${prefixe}/${entree.name}` : entree.name;
    if (entree.isDirectory()) {
      if (DOSSIERS_IGNORES.has(entree.name)) continue;
      fichiers.push(...listerParParcours(racine, chemin));
    } else if (entree.isFile()) {
      fichiers.push(chemin);
    }
  }
  return fichiers;
}

/** Les fichiers à vérifier : ceux de git s'il y en a, sinon le parcours. */
export function listerFichiers(racine) {
  const parGit = listerParGit(racine);
  return (parGit ?? listerParParcours(racine)).map((chemin) => chemin.split("\\").join("/"));
}

/** Un fichier dont le contenu est du texte lisible et pas un gros binaire. */
function estTextuel(chemin, contenu) {
  if (contenu.length > TAILLE_MAX) return false;
  if (EXTENSIONS_BINAIRES.has(extname(chemin).toLowerCase())) return false;
  return !contenu.subarray(0, 4096).includes(0);
}

/** Les problèmes d'un fichier au regard des règles : vide, CR, tabulation… */
export function problemes(contenu, regles) {
  if (contenu.length === 0) return [{ regle: "vide", detail: "fichier vide" }];
  const texte = contenu.toString("utf8");
  const trouves = [];
  if (regles.charset === "utf-8" && !estUtf8Valide(contenu)) {
    trouves.push({ regle: "charset", detail: "octets qui ne sont pas de l'UTF-8" });
  }
  if (regles.end_of_line === "lf" && texte.includes("\r")) {
    trouves.push({ regle: "end_of_line", detail: "retour à la ligne CR ou CRLF" });
  }
  if (regles.indent_style === "space" && texte.includes("\t")) {
    trouves.push({ regle: "indent_style", detail: "tabulation" });
  }
  if (regles.insert_final_newline === "true" && !texte.endsWith("\n")) {
    trouves.push({ regle: "insert_final_newline", detail: "pas de saut de ligne final" });
  }
  if (regles.trim_trailing_whitespace === "true" && /[ \t]+$/m.test(texte)) {
    trouves.push({ regle: "trim_trailing_whitespace", detail: "espace en fin de ligne" });
  }
  return trouves;
}

/** Le contenu est-il de l'UTF-8 valide ? (le décodeur lève si non) */
function estUtf8Valide(contenu) {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(contenu);
    return true;
  } catch {
    return false;
  }
}

/** La vérification : parcourt, applique les règles, rend le compte rendu. */
function verifier(racine) {
  const sections = lireConfig(racine);
  const heritages = heritage();
  const rapport = { verifies: 0, problemes: [], heritages: [] };
  for (const relatif of listerFichiers(racine).sort()) {
    const absolu = join(racine, relatif);
    let contenu;
    try {
      if (lstatSync(absolu).isSymbolicLink()) continue;
      contenu = readFileSync(absolu);
    } catch {
      continue;
    }
    if (!estTextuel(relatif, contenu)) continue;
    const trouves = problemes(contenu, reglesPour(relatif, sections));
    if (!trouves.length) {
      rapport.verifies += 1;
      continue;
    }
    if (heritages.has(relatif)) {
      rapport.heritages.push(relatif);
      continue;
    }
    rapport.verifies += 1;
    for (const probleme of trouves) {
      rapport.problemes.push({ chemin: relatif, ...probleme });
    }
  }
  return rapport;
}

/** Point d'entrée : vérifie et sort 1 s'il y a un problème. */
function main(argv) {
  const racine = resolve(argv[0] ?? process.cwd());
  const rapport = verifier(racine);
  for (const probleme of rapport.problemes) {
    process.stderr.write(`✗ ${probleme.chemin} : ${probleme.regle} — ${probleme.detail}\n`);
  }
  if (rapport.heritages.length) {
    process.stdout.write(
      `· ${rapport.heritages.length} fichier(s) hérité(s) non conformes, signalés sans bloquer ` +
        `(scripts/format-heritage.txt)\n`,
    );
  }
  process.stdout.write(
    rapport.problemes.length
      ? `✗ ${rapport.problemes.length} problème(s) sur ${rapport.verifies} fichier(s) vérifié(s)\n`
      : `✓ ${rapport.verifies} fichier(s) vérifié(s) — aucun problème\n`,
  );
  return rapport.problemes.length ? 1 : 0;
}

/** Le module est importé sans déclencher le contrôle ; lancé seul, il vérifie. */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
