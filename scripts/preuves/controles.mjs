#!/usr/bin/env node
/**
 * Quatre contrôles qui portent sur des FAITS ÉCRITS plutôt que sur du code :
 * le manifeste lui-même, le chemin du modèle servi par le site, l'état de la
 * licence du fichier de modèle, et la liste des étapes qui attendent une main
 * humaine (cahier §18).
 *
 * Un contrôle sort 0 quand le fait est vrai et écrit, 1 sinon. Aucun son,
 * aucune requête réseau : ce script ne lit que des fichiers du dépôt.
 *
 * Usage : node scripts/preuves/controles.mjs <manifeste|modele|licence|main-humaine>
 */
import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(join(fileURLToPath(new URL(".", import.meta.url)), "..", ".."));

/** Ce qui ressemble à un secret : une clé, un jeton, un mot de passe. */
const SECRET = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bghp_[A-Za-z0-9]{20,}/,
  /\bAIza[0-9A-Za-z_-]{20,}/,
  /\bsk-[A-Za-z0-9]{20,}/,
  /\bBearer\s+[A-Za-z0-9._-]{16,}/,
  /\b(api[_-]?key|secret|password|passwd|token)\s*[:=]\s*\S+/i,
];

/** Hôtes d'un modèle servi par un tiers : le nôtre vient du site lui-même. */
const HOTES_TIERS = ["googleapis.com", "jsdelivr.net", "unpkg.com", "cdn."];

/** Lit un fichier du dépôt ; une absence est une erreur de contrôle. */
async function texte(chemin) {
  return readFile(join(RACINE, chemin), "utf8");
}

/**
 * Un contrôle : des écarts (ce qui est faux ou manquant) et des notes (ce qui
 * est vrai et écrit). Le verdict ne dépend que des écarts.
 */
function verdict(ecarts, notes, mesure = null) {
  return { ok: ecarts.length === 0, lignes: [...notes, ...ecarts], mesure };
}

/**
 * Le manifeste : chaque entrée a un identifiant unique, un titre, une
 * commande, un attendu et un fichier ; aucune valeur ne ressemble à un
 * secret (le registre est public).
 */
async function controleManifeste() {
  const brut = await texte("docs/preuves.json");
  const ecarts = [];
  const notes = [];
  const manifeste = JSON.parse(brut);
  const preuves = preuvesDe(manifeste);
  if (preuves.length === 0) return verdict(["le manifeste ne contient aucune preuve"], notes, 0);
  const identifiants = new Set();
  const champs = ["id", "titre", "commande", "attendu", "fichier"];
  for (const preuve of preuves) {
    const manquants = champs.filter((champ) => typeof preuve[champ] !== "string" || preuve[champ].trim() === "");
    if (manquants.length > 0) ecarts.push(`${preuve.id ?? "(sans identifiant)"} : champ vide ou absent — ${manquants.join(", ")}`);
    if (typeof preuve.id === "string") {
      if (identifiants.has(preuve.id)) ecarts.push(`${preuve.id} : identifiant en double`);
      identifiants.add(preuve.id);
    }
  }
  const secret = SECRET.find((motif) => motif.test(brut));
  if (secret) ecarts.push(`le manifeste contient une valeur qui ressemble à un secret (${secret})`);
  if (ecarts.length === 0) notes.push(`${preuves.length} preuve(s), chaque entrée complète, aucun secret`);
  return verdict(ecarts, notes, preuves.length);
}

/** La liste des entrées du manifeste, telle qu'elle est écrite. */
function preuvesDe(manifeste) {
  return Array.isArray(manifeste.preuves) ? manifeste.preuves : [];
}

/**
 * Le modèle de vision est servi par le site lui-même : son chemin est relatif
 * à la racine du site, il est rangé dans `public/`, et aucune adresse d'un
 * hébergeur tiers n'apparaît dans le code qui le demande.
 */
async function controleModele() {
  const ecarts = [];
  const notes = [];
  const session = await texte("apps/web/src/hooks/useSession.ts");
  const vision = await texte("packages/vision/src/landmarker-core.ts");
  const fetchModel = await texte("scripts/fetch-model.mjs");
  if (!session.includes("models/hand_landmarker.task") || !session.includes("import.meta.env.BASE_URL")) {
    ecarts.push("le site ne demande pas le modèle par un chemin relatif à sa racine");
  }
  if (!/DEFAULT_MODEL_URL\s*=\s*"\/[^"]*hand_landmarker\.task"/.test(vision)) {
    ecarts.push("le paquet de vision ne garde pas un chemin local pour le modèle");
  }
  if (!fetchModel.includes("public") || !fetchModel.includes("models")) {
    ecarts.push("le script de téléchargement ne range pas le modèle dans le dossier public du site");
  }
  for (const code of [session, vision]) {
    const hote = HOTES_TIERS.find((nom) => code.includes(nom));
    if (hote) ecarts.push(`une adresse d'un hébergeur tiers (${hote}) apparaît dans le code qui demande le modèle`);
  }
  let octets = 0;
  try {
    octets = (await stat(join(RACINE, "public/models/hand_landmarker.task"))).size;
  } catch {
    octets = 0;
  }
  notes.push("le modèle est demandé à un chemin du site et rangé dans public/models");
  notes.push(octets > 0 ? `modèle présent : ${octets} octets` : "modèle absent du dossier public (téléchargement à faire)");
  return verdict(ecarts, notes, octets);
}

/**
 * L'état de la licence du fichier de modèle est un fait écrit : il est dit
 * dans `NOTICE.md` et dans le journal, avec sa source et sa date. On ne
 * contrôle pas une licence (un humain la lit), on contrôle qu'elle est écrite.
 */
async function controleLicence() {
  const ecarts = [];
  const notes = [];
  const notice = await texte("NOTICE.md");
  const journal = await texte("docs/journal.md");
  const etat = /licence of the model file itself:\s*(not established|established)/i;
  if (!notice.includes("hand_landmarker")) ecarts.push("NOTICE.md ne parle pas du fichier de modèle");
  if (!etat.test(notice)) ecarts.push("NOTICE.md n'écrit pas l'état de la licence du fichier de modèle");
  if (!journal.includes("hand_landmarker")) ecarts.push("le journal ne mentionne pas le fichier de modèle");
  if (!/licence/i.test(journal)) ecarts.push("le journal ne parle pas de licence");
  const trouve = notice.match(/Licence of the model file itself:\s*([^.]+)\./i);
  if (ecarts.length === 0) {
    notes.push(`état écrit : ${(trouve?.[1] ?? "inconnu").trim()}`);
    notes.push("source et date consignées dans docs/journal.md");
  }
  return verdict(ecarts, notes, trouve ? 1 : 0);
}

/**
 * Les étapes qui ne se prouvent pas toutes seules — journal réseau du
 * navigateur, accessibilité automatique, séance d'écoute, vidéo, licence du
 * fichier — sont listées, pas oubliées. Le contrôle compte ces étapes.
 */
async function controleMainHumaine() {
  const ecarts = [];
  const notes = [];
  const recette = await texte("docs/recette.md");
  const titre = "Ce qui demande encore une main humaine";
  const debut = recette.indexOf(titre);
  if (debut < 0) return verdict([`docs/recette.md ne contient pas la section « ${titre} »`], notes, 0);
  const suite = recette.slice(debut + titre.length);
  const fin = suite.indexOf("\n## ");
  const section = fin < 0 ? suite : suite.slice(0, fin);
  const etapes = section
    .split("\n")
    .filter((ligne) => /^\|/.test(ligne) && !/^\|\s*---/.test(ligne) && !/^\|\s*Exigence/.test(ligne));
  notes.push(`${etapes.length} étape(s) attendent une main humaine, listées dans docs/recette.md`);
  for (const etape of etapes) {
    const cellule = etape.split("|")[1]?.trim() ?? "";
    if (cellule !== "") notes.push(`  — ${cellule}`);
  }
  if (etapes.length === 0) ecarts.push("la section ne liste aucune étape");
  return verdict(ecarts, notes, etapes.length);
}

const CONTROLES = {
  manifeste: controleManifeste,
  modele: controleModele,
  licence: controleLicence,
  "main-humaine": controleMainHumaine,
};

const nom = process.argv[2];
const controle = CONTROLES[nom];
if (!controle) {
  process.stderr.write(`contrôle inconnu : ${nom ?? "(aucun)"}\ncontrôles : ${Object.keys(CONTROLES).join(", ")}\n`);
  process.exit(2);
}

const resultat = await controle();
for (const ligne of resultat.lignes) process.stdout.write(`${ligne}\n`);
if (resultat.mesure !== null) process.stdout.write(`mesure: ${resultat.mesure}\n`);
process.exit(resultat.ok ? 0 : 1);
