#!/usr/bin/env node
/**
 * Le contrôle des versions de formats (cahier §11.4, annexe B ; politique
 * `docs/versions-formats.md`).
 *
 * Trois lectures, aucune écriture, aucun réseau, aucun son (AIR-N-01,
 * AIR-N-02) :
 *   - `packages/schema/src/vocab.ts` : les constantes de format vivantes ;
 *   - `docs/versions-formats.md` : le registre, avec les dates ;
 *   - `CHANGELOG.md` : ce qui a été annoncé.
 *
 * Le contrôleur ne corrige rien : une version de format se décide, elle ne se
 * déduit pas. Il dit seulement ce qui manque, et sort 1.
 *
 * Usage : `node scripts/check-format-versions.mjs [racine]` → 0 si tout va
 * bien, 1 sinon, avec la liste des manques sur la sortie d'erreur.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const VOCABULAIRE = join("packages", "schema", "src", "vocab.ts");
const REGISTRE = join("docs", "versions-formats.md");
const JOURNAL = "CHANGELOG.md";

/** Une constante exportée du vocabulaire : `export const TAKE_FORMAT = "…/1"`. */
const CONSTANTE = /export const ([A-Z][A-Z0-9_]*) = "([^"]+)"/g;
/** Un identifiant de format : `thin-air-take/1`. */
const IDENTIFIANT = /^thin-air-[a-z-]+\/(\d+)$/;
/** Une section de registre : `### \`thin-air-take/1\``. */
const SECTION_FORMAT = /^#{2,4}\s+`([^`]+)`\s*$/;
/** Une ligne de champ : `- Statut : actuel`. */
const CHAMP = /^-\s+([^:]+?)\s*:\s*(.+?)\s*$/;
/** La fenêtre de lecture, nommée dans la politique. */
const FENETRE = /Fenêtre de lecture\s*:\s*\*\*(\d+)\s*mois\*\*/;
/** La date de la politique. */
const DATE_POLITIQUE = /Politique en vigueur depuis le (\d{4}-\d{2}-\d{2})/;
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const ACCENTS = /[\u0300-\u036f]/g;

/** Le texte d'un fichier, ou `null` s'il est illisible. */
function texte(chemin) {
  try {
    return readFileSync(chemin, "utf8");
  } catch {
    return null;
  }
}

/** Minuscules, sans accent : « Déprécié » et « deprecie » se comparent. */
function sansAccents(valeur) {
  return valeur.normalize("NFD").replace(ACCENTS, "").toLowerCase();
}

/** Les constantes de format du vocabulaire : identifiant → nom de constante. */
function formatsDuVocabulaire(source) {
  const formats = new Map();
  for (const match of source.matchAll(CONSTANTE)) {
    if (IDENTIFIANT.test(match[2])) formats.set(match[2], match[1]);
  }
  return formats;
}

/** Le registre du document : identifiant → { statut, dates, declarePar }. */
function registreDuDocument(source) {
  const registre = new Map();
  let courant = null;
  let dansCode = false;
  for (const ligne of source.split("\n")) {
    if (ligne.trim().startsWith("```")) {
      dansCode = !dansCode;
      continue;
    }
    if (dansCode) continue;
    const entete = SECTION_FORMAT.exec(ligne);
    if (entete) {
      courant = { format: entete[1], statut: null, deprecieLe: null, finLecture: null, declarePar: null };
      registre.set(courant.format, courant);
      continue;
    }
    if (ligne.trimStart().startsWith("#")) {
      courant = null;
      continue;
    }
    if (!courant) continue;
    const champ = CHAMP.exec(ligne);
    if (!champ) continue;
    const cle = sansAccents(champ[1]);
    if (cle === "statut") courant.statut = sansAccents(champ[2]);
    else if (cle === "deprecie le") courant.deprecieLe = champ[2];
    else if (cle === "fin de lecture") courant.finLecture = champ[2];
    else if (cle === "declare par") courant.declarePar = champ[2];
  }
  return registre;
}

/** La fenêtre de lecture en mois, ou `null` si la politique ne la nomme pas. */
function fenetreDuDocument(source) {
  const trouve = FENETRE.exec(source);
  return trouve ? Number(trouve[1]) : null;
}

/** La date de la politique, ou `null`. */
function dateDeLaPolitique(source) {
  const trouve = DATE_POLITIQUE.exec(source);
  return trouve ? trouve[1] : null;
}

/** Une date ISO existe-t-elle vraiment (pas de 2027-02-31) ? */
function dateValide(iso) {
  if (!DATE_ISO.test(iso)) return false;
  const [a, m, j] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(a, m - 1, j));
  return date.getUTCFullYear() === a && date.getUTCMonth() === m - 1 && date.getUTCDate() === j;
}

/** Une date ISO, décalée de `mois` mois — le jour le plus proche du dernier. */
function plusMois(iso, mois) {
  const [a, m, j] = iso.split("-").map(Number);
  const cible = new Date(Date.UTC(a, m - 1 + mois, 1));
  const annee = cible.getUTCFullYear();
  const moisCible = cible.getUTCMonth() + 1;
  const dernier = new Date(Date.UTC(annee, moisCible, 0)).getUTCDate();
  return `${annee}-${String(moisCible).padStart(2, "0")}-${String(Math.min(j, dernier)).padStart(2, "0")}`;
}

/** Le numéro de version d'un identifiant, ou `null` s'il n'en a pas. */
function numeroDeVersion(format) {
  const trouve = IDENTIFIANT.exec(format);
  return trouve ? Number(trouve[1]) : null;
}

/** Les versions déclarées par famille : `thin-air-take` → [1, 2]. */
function versionsParFamille(formats) {
  const familles = new Map();
  for (const format of formats.keys()) {
    const numero = numeroDeVersion(format);
    if (numero === null) continue;
    const famille = format.slice(0, format.lastIndexOf("/"));
    const versions = familles.get(famille) ?? [];
    versions.push(numero);
    familles.set(famille, versions);
  }
  return familles;
}

/** Les formats déclarés dont le numéro n'est pas le dernier de leur famille. */
function formatsAnciens(formats) {
  const anciens = new Set();
  for (const [famille, versions] of versionsParFamille(formats)) {
    const dernier = Math.max(...versions);
    for (const format of formats.keys()) {
      if (format.slice(0, format.lastIndexOf("/")) !== famille) continue;
      const numero = numeroDeVersion(format);
      if (numero !== null && numero < dernier) anciens.add(format);
    }
  }
  return anciens;
}

/** Une ligne de registre sans statut, ou avec un statut inconnu. */
function ecartsDeStatut(registre) {
  const ecarts = [];
  for (const [format, ligne] of registre) {
    if (!ligne.statut) {
      ecarts.push(`${format} : statut manquant dans le registre.`);
    } else if (ligne.statut !== "actuel" && ligne.statut !== "deprecie") {
      ecarts.push(`${format} : statut « ${ligne.statut} » inconnu (actuel ou deprecie).`);
    }
  }
  return ecarts;
}

/** Une constante du schéma que le registre ne déclare pas, et l'inverse. */
function ecartsDeCorrespondance(formats, registre) {
  const ecarts = [];
  for (const format of formats.keys()) {
    if (!registre.has(format)) ecarts.push(`${format} : absent de ${REGISTRE}.`);
  }
  for (const [format, ligne] of registre) {
    if (!formats.has(format)) {
      ecarts.push(`${format} : inscrit au registre, absent du vocabulaire (${VOCABULAIRE}).`);
      continue;
    }
    const constante = formats.get(format);
    const declare = ligne.declarePar?.match(/`([A-Z0-9_]+)`/)?.[1];
    if (declare && declare !== constante) {
      ecarts.push(`${format} : le registre le déclare par \`${declare}\`, le schéma par \`${constante}\`.`);
    }
  }
  return ecarts;
}

/** Un format déprécié sans date, ou déprécié trop court, est un écart. */
function ecartsDeDeprecation(registre, fenetre) {
  const ecarts = [];
  for (const [format, ligne] of registre) {
    if (ligne.statut !== "deprecie") continue;
    if (!ligne.deprecieLe || !dateValide(ligne.deprecieLe)) {
      ecarts.push(`${format} : déprécié sans date de dépréciation valide.`);
      continue;
    }
    if (!ligne.finLecture || !dateValide(ligne.finLecture)) {
      ecarts.push(`${format} : déprécié sans date de fin de lecture valide.`);
      continue;
    }
    if (fenetre === null) continue;
    const attendue = plusMois(ligne.deprecieLe, fenetre);
    if (ligne.finLecture < attendue) {
      ecarts.push(`${format} : fin de lecture le ${ligne.finLecture}, avant les ${fenetre} mois annoncés (${attendue}).`);
    }
  }
  return ecarts;
}

/** Un format ancien — non le dernier de sa famille — doit être déprécié. */
function ecartsDAnciennete(formats, registre) {
  const ecarts = [];
  for (const format of formats.keys()) {
    if (!formatsAnciens(formats).has(format)) continue;
    const ligne = registre.get(format);
    if (ligne && ligne.statut === "deprecie") continue;
    ecarts.push(`${format} : numéro périmé (un numéro plus récent existe pour cette famille) sans statut « deprecie » daté.`);
  }
  return ecarts;
}

/** Tout ce que le contrôleur a à dire sur un dépôt, sous forme de manques. */
export function controler(racine = RACINE) {
  const source = texte(join(racine, VOCABULAIRE));
  const document = texte(join(racine, REGISTRE));
  const journal = texte(join(racine, JOURNAL));
  if (source === null) return [`${VOCABULAIRE} : illisible ou absent.`];
  if (document === null) return [`${REGISTRE} : illisible ou absent.`];
  if (journal === null) return [`${JOURNAL} : illisible ou absent.`];

  const formats = formatsDuVocabulaire(source);
  const registre = registreDuDocument(document);
  const fenetre = fenetreDuDocument(document);
  const ecarts = [];

  if (formats.size === 0) ecarts.push(`${VOCABULAIRE} : aucune constante de format trouvée.`);
  if (fenetre === null) ecarts.push(`${REGISTRE} : la fenêtre de lecture n'est pas nommée (« Fenêtre de lecture : **N mois** »).`);
  if (dateDeLaPolitique(document) === null) ecarts.push(`${REGISTRE} : la politique n'est pas datée.`);

  ecarts.push(...ecartsDeCorrespondance(formats, registre));
  ecarts.push(...ecartsDeStatut(registre));
  ecarts.push(...ecartsDAnciennete(formats, registre));
  ecarts.push(...ecartsDeDeprecation(registre, fenetre));

  for (const [format, ligne] of registre) {
    if (!journal.includes(format)) {
      ecarts.push(`${format} : absent de ${JOURNAL}.`);
      continue;
    }
    if (ligne.statut === "deprecie" && ligne.deprecieLe && !journal.includes(ligne.deprecieLe)) {
      ecarts.push(`${format} : déprécié le ${ligne.deprecieLe}, date absente de ${JOURNAL}.`);
    }
  }
  return ecarts;
}

/** La ligne de commande : les manques sur la sortie d'erreur, sinon rien. */
function principal(argv) {
  const racine = argv[0] ? resolve(argv[0]) : RACINE;
  const ecarts = controler(racine);
  if (ecarts.length === 0) {
    process.stdout.write("✓ les versions de formats sont documentées et datées\n");
    return 0;
  }
  for (const ecart of ecarts) process.stderr.write(`✗ ${ecart}\n`);
  process.stderr.write(`${ecarts.length} écart(s) sur les versions de formats\n`);
  return 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(principal(process.argv.slice(2)));
}
