#!/usr/bin/env node
/**
 * Synthèse des feuilles d'audit d'utilisateurs (docs/audit-utilisateurs.md §9).
 *
 * Lit des feuilles TSV **remplies** (une par participant, gabarit :
 * `scripts/audit/feuille.tsv`) et affiche un tableau récapitulatif Markdown :
 * tâche × profil → temps moyen, nombre d'abandons, note moyenne.
 *
 * Toute feuille mal formée est refusée en entier (code de sortie 2) : un
 * tableau partiel vaut mieux qu'un tableau faux. Aucune donnée personnelle
 * n'est attendue ni acceptée : la colonne `participant` porte un code anonyme
 * (lettre + chiffres), et sa forme est vérifiée.
 *
 * Usage :
 *   node scripts/audit/synthese.mjs out/audit/A1.tsv out/audit/B2.tsv …
 *
 * Codes de sortie : 0 succès · 1 usage · 2 feuille mal formée.
 * Aucun son, aucun réseau, aucune dépendance (Node ≥ 22).
 */
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const COLONNES = [
  "participant", "profil", "tache", "note", "temps_s", "abandon", "erreurs", "commentaire",
];
const EN_TETE = COLONNES.join("\t");

const PROFILS = ["fauteuil", "malvoyant", "tremblement"];
const TACHES = ["melodie", "instrument", "calibrage", "note", "retard"];

const LIBELLES_TACHES = {
  melodie: "T1 · Jouer une mélodie",
  instrument: "T2 · Changer l'instrument",
  calibrage: "T3 · Calibrer",
  note: "T4 · Lire la note en cours",
  retard: "T5 · Trouver le retard",
};
const LIBELLES_PROFILS = {
  fauteuil: "assis, portée courte",
  malvoyant: "malvoyante",
  tremblement: "tremblement des mains",
};

/** Code anonyme de participant : une lettre puis des lettres/chiffres/tirets. */
const CODE_PARTICIPANT = /^[A-Za-z][A-Za-z0-9_-]{0,15}$/;

class ErreurFeuille extends Error {}

function erreur(fichier, ligne, message) {
  return new ErreurFeuille(`${fichier}:${ligne}: ${message}`);
}

function entier(texte, minimum, maximum, etiquette, fichier, ligne) {
  if (!/^\d+$/.test(texte)) {
    throw erreur(fichier, ligne, `${etiquette} attend un entier, reçu « ${texte} »`);
  }
  const valeur = Number(texte);
  if (valeur < minimum || valeur > maximum) {
    throw erreur(fichier, ligne, `${etiquette} hors bornes [${minimum}, ${maximum}] : ${valeur}`);
  }
  return valeur;
}

function decimal(texte, etiquette, fichier, ligne) {
  if (!/^\d+(\.\d+)?$/.test(texte)) {
    throw erreur(fichier, ligne, `${etiquette} attend un nombre ≥ 0, reçu « ${texte} »`);
  }
  return Number(texte);
}

/**
 * Une ligne de feuille → une observation validée. `temps` vaut `null` quand
 * la tâche a été abandonnée sans chronomètre arrêté.
 */
function analyserLigne(ligne, fichier, numero) {
  const champs = ligne.split("\t");
  if (champs.length !== COLONNES.length) {
    throw erreur(fichier, numero, `${COLONNES.length} colonnes attendues, ${champs.length} reçues`);
  }
  const [participant, profil, tache, note, temps, abandon, erreurs, commentaire] = champs;
  if (!CODE_PARTICIPANT.test(participant)) {
    throw erreur(fichier, numero, "participant : code anonyme attendu (ex. A1), reçu « " + participant + " »");
  }
  if (!PROFILS.includes(profil)) {
    throw erreur(fichier, numero, `profil inconnu « ${profil} » (${PROFILS.join(", ")})`);
  }
  if (!TACHES.includes(tache)) {
    throw erreur(fichier, numero, `tâche inconnue « ${tache} » (${TACHES.join(", ")})`);
  }
  const noteValeur = entier(note, 0, 3, "note", fichier, numero);
  const abandonValeur = entier(abandon, 0, 1, "abandon", fichier, numero);
  const erreursValeur = entier(erreurs, 0, 999, "erreurs", fichier, numero);
  if (abandonValeur === 0 && temps === "") {
    throw erreur(fichier, numero, "temps_s est obligatoire quand la tâche n'est pas abandonnée");
  }
  const tempsValeur = temps === "" ? null : decimal(temps, "temps_s", fichier, numero);
  return { participant, profil, tache, note: noteValeur, temps: tempsValeur, abandon: abandonValeur, erreurs: erreursValeur, commentaire };
}

/** Le texte d'une feuille → ses observations. L'en-tête doit être exact. */
function analyserFeuille(texte, fichier) {
  const lignes = texte.replace(/\r\n?/g, "\n").split("\n");
  if (lignes[0] !== EN_TETE) {
    throw erreur(fichier, 1, `en-tête attendu : « ${EN_TETE} »`);
  }
  const observations = [];
  for (let i = 1; i < lignes.length; i += 1) {
    const ligne = lignes[i] ?? "";
    if (ligne === "" && i === lignes.length - 1) continue; // fin de fichier
    if (ligne.trim() === "") {
      throw erreur(fichier, i + 1, "ligne vide : les lignes non utilisées doivent être supprimées");
    }
    observations.push(analyserLigne(ligne, fichier, i + 1));
  }
  if (observations.length === 0) {
    throw erreur(fichier, 1, "feuille vide : aucune observation à synthétiser");
  }
  return observations;
}

/**
 * Garde-fous entre lignes : un code de participant n'apparaît qu'avec un
 * seul profil, et une tâche n'est tentée qu'une fois par participant.
 */
function verifierCoherence(observations) {
  const profils = new Map();
  const tentatives = new Set();
  for (const o of observations) {
    const profilVu = profils.get(o.participant);
    if (profilVu !== undefined && profilVu !== o.profil) {
      throw new ErreurFeuille(
        `participant ${o.participant} : deux profils différents (${profilVu}, ${o.profil})`,
      );
    }
    profils.set(o.participant, o.profil);
    const cle = `${o.participant}|${o.tache}`;
    if (tentatives.has(cle)) {
      throw new ErreurFeuille(`participant ${o.participant} : tâche « ${o.tache} » en double`);
    }
    tentatives.add(cle);
  }
}

function moyenne(valeurs) {
  return valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
}

/** Regroupe les observations par tâche puis par profil. */
function agreger(observations) {
  const agregat = new Map();
  for (const tache of TACHES) {
    agregat.set(tache, new Map(PROFILS.map((profil) => [profil, { temps: [], abandons: 0, notes: [], nombre: 0 }])));
  }
  for (const o of observations) {
    const case_ = agregat.get(o.tache).get(o.profil);
    case_.nombre += 1;
    case_.notes.push(o.note);
    case_.abandons += o.abandon;
    if (o.temps !== null) case_.temps.push(o.temps);
  }
  return agregat;
}

function celluleTemps(case_) {
  return case_.temps.length === 0 ? "—" : moyenne(case_.temps).toFixed(1);
}

function tableauMarkdown(agregat) {
  const lignes = [
    "| Tâche | Profil | Participants | Temps moyen (s) | Abandons | Note moyenne |",
    "|---|---|---|---|---|---|",
  ];
  for (const tache of TACHES) {
    for (const profil of PROFILS) {
      const case_ = agregat.get(tache).get(profil);
      const participants = case_.nombre === 0 ? "—" : String(case_.nombre);
      const note = case_.nombre === 0 ? "—" : moyenne(case_.notes).toFixed(1);
      lignes.push(
        `| ${LIBELLES_TACHES[tache]} | ${profil} (${LIBELLES_PROFILS[profil]}) | ${participants} | ${celluleTemps(case_)} | ${case_.abandons} | ${note} |`,
      );
    }
  }
  return lignes.join("\n");
}

async function charger(chemins) {
  const observations = [];
  for (const chemin of chemins) {
    let texte;
    try {
      texte = await readFile(chemin, "utf8");
    } catch (cause) {
      throw new ErreurFeuille(`impossible de lire « ${chemin} » : ${cause.message}`);
    }
    observations.push(...analyserFeuille(texte, basename(chemin)));
  }
  verifierCoherence(observations);
  return observations;
}

const chemins = process.argv.slice(2);
if (chemins.length === 0) {
  process.stderr.write(
    "usage : node scripts/audit/synthese.mjs <feuille.tsv> […]\n" +
      "  (gabarit vide : scripts/audit/feuille.tsv ; protocole : docs/audit-utilisateurs.md)\n",
  );
  process.exit(1);
}

try {
  const observations = await charger(chemins);
  const participants = new Set(observations.map((o) => o.participant));
  process.stdout.write(
    "# Synthèse de l'audit d'utilisateurs\n\n" +
      `Feuilles lues : ${chemins.length} · participants : ${participants.size} · observations : ${observations.length}.\n` +
      "Notation : 0 impossible · 1 pénible · 2 possible · 3 naturel (protocole §4).\n\n" +
      tableauMarkdown(agreger(observations)) + "\n",
  );
} catch (cause) {
  if (cause instanceof ErreurFeuille) {
    process.stderr.write(`feuille refusée — ${cause.message}\n`);
    process.exit(2);
  }
  throw cause;
}
