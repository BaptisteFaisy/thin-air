#!/usr/bin/env node
/**
 * Garde de vie privée des prises (AIR-F-47, AIR-N-01, cahier §7.11).
 *
 * Une prise ne contient que des points : la cadence, puis pour chaque image
 * un instant et, par main, le côté, le score et les 21 points de trois
 * coordonnées. Toute autre clé — une image, une vidéo, un chemin de fichier,
 * une donnée encodée — est refusée.
 *
 * Le poids est aussi une preuve : une prise pèse environ 26 Ko/s en JSON brut
 * (§7.11). Au-delà du plafond, quelque chose d'autre que des points a été
 * glissé dedans ; la garde refuse.
 *
 * Usage : `node scripts/hooks/take-privacy-guard.mjs` → 0 si toutes les
 * prises de `takes/` sont conformes, ou s'il n'y en a pas encore.
 */
import { readFile, stat } from "node:fs/promises";
import { relative } from "node:path";
import { accepter, extensionDe, fichiersSous, journaliser, lireChargeUtile, racine, refuser } from "./lib/io.mjs";

const NOM = "take-privacy-guard";
const FORMAT = "thin-air-take/1";
/** Une session de boucle (cahier §7.10) vit sous `takes/pieces/`, pas une prise. */
const SESSION_FORMAT = "thin-air-session/1";
const CLES_PRISE = new Set(["format", "fps", "frames"]);
const CLES_IMAGE = new Set(["t", "hands"]);
const CLES_MAIN = new Set(["side", "score", "points"]);
const POINTS_PAR_MAIN = 21;
const COORDONNEES = 3;
/**
 * Plafond de poids, en octets par seconde de prise.
 * §7.11 annonce environ 26 Ko/s en JSON brut ; le pire cas légitime est une
 * prise à 60 images par seconde dont les coordonnées ne sont pas arrondies,
 * soit environ 76 Ko/s. À 150 Ko/s, on est au double du pire cas légitime et
 * six fois au-dessus de l'attendu : ce qui passe encore est une prise, ce qui
 * dépasse transporte autre chose que des points (une vignette de 100 × 100 en
 * nombres pèserait plus de 1 Mo/s).
 */
const PLAFOND_OCTETS_PAR_SECONDE = 150_000;
const IGNORES = ["node_modules", ".git", "out", "dist"];

function estNombre(valeur) {
  return typeof valeur === "number" && Number.isFinite(valeur);
}

function clesInconnues(objet, autorisees) {
  return Object.keys(objet).filter((cle) => !autorisees.has(cle));
}

function validerMain(main, etiquette, erreurs) {
  if (!main || typeof main !== "object") return void erreurs.push(`${etiquette} : objet attendu`);
  const inconnues = clesInconnues(main, CLES_MAIN);
  if (inconnues.length) erreurs.push(`${etiquette} : clés refusées ${inconnues.join(", ")} — une prise ne contient que des points`);
  if (main.side !== "left" && main.side !== "right") erreurs.push(`${etiquette}.side : « left » ou « right » attendu`);
  if (!estNombre(main.score)) erreurs.push(`${etiquette}.score : nombre attendu`);
  const points = main.points;
  if (!Array.isArray(points) || points.length !== POINTS_PAR_MAIN) {
    return void erreurs.push(`${etiquette}.points : ${POINTS_PAR_MAIN} points attendus`);
  }
  points.forEach((point, index) => {
    if (!Array.isArray(point) || point.length !== COORDONNEES || !point.every(estNombre)) {
      erreurs.push(`${etiquette}.points[${index}] : ${COORDONNEES} nombres attendus`);
    }
  });
}

/** Valide une prise déjà décodée : rend la liste des raisons de refus. */
export function validerPrise(prise) {
  const erreurs = [];
  if (!prise || typeof prise !== "object" || Array.isArray(prise)) return ["objet attendu"];
  const inconnues = clesInconnues(prise, CLES_PRISE);
  if (inconnues.length) erreurs.push(`clés refusées ${inconnues.join(", ")} — une prise ne contient que des points`);
  if (prise.format !== FORMAT) erreurs.push(`format : « ${FORMAT} » attendu`);
  if (!estNombre(prise.fps) || prise.fps <= 0) erreurs.push("fps : nombre strictement positif attendu");
  if (!Array.isArray(prise.frames)) {
    erreurs.push("frames : liste attendue");
    return erreurs;
  }
  prise.frames.forEach((image, index) => {
    const etiquette = `frames[${index}]`;
    if (!image || typeof image !== "object") return void erreurs.push(`${etiquette} : objet attendu`);
    const inconnues = clesInconnues(image, CLES_IMAGE);
    if (inconnues.length) erreurs.push(`${etiquette} : clés refusées ${inconnues.join(", ")}`);
    if (!estNombre(image.t)) erreurs.push(`${etiquette}.t : nombre attendu`);
    if (!Array.isArray(image.hands)) return void erreurs.push(`${etiquette}.hands : liste attendue`);
    image.hands.forEach((main, numero) => validerMain(main, `${etiquette}.hands[${numero}]`, erreurs));
    return undefined;
  });
  return erreurs;
}

/** Le poids par seconde de la prise : une image glissée dedans explose le plafond. */
function poidsParSeconde(octets, prise) {
  const images = Array.isArray(prise.frames) ? prise.frames.length : 0;
  const duree = estNombre(prise.fps) && prise.fps > 0 ? images / prise.fps : 0;
  if (duree <= 0 || images === 0) return null;
  return octets / duree;
}

const chargeUtile = await lireChargeUtile();
const base = racine(chargeUtile);
let verifiees = 0;
let sessions = 0;
const refus = [];

for await (const chemin of fichiersSous(`${base}/takes`, { ignores: IGNORES })) {
  if (extensionDe(chemin) !== ".json") continue;
  // Un rapport de rendu figé (`takes/reference/<nom>.expected.json`) n'est pas
  // une prise : il ne contient que les nombres d'un rendu de référence.
  if (chemin.endsWith(".expected.json")) continue;
  const brut = await readFile(chemin, "utf8");
  const etiquette = relative(base, chemin);
  let prise;
  try {
    prise = JSON.parse(brut);
  } catch (erreur) {
    refus.push(`${etiquette} : JSON illisible (${String(erreur)})`);
    continue;
  }
  // Une session (`takes/pieces/seance-1min.json`) n'est pas une prise : elle
  // ne contient que des `MusicEvent` datés, jamais de points de main. Elle est
  // validée par `parseSession` (banc d'essai + tests), pas par cette garde.
  if (prise && typeof prise === "object" && prise.format === SESSION_FORMAT) {
    sessions += 1;
    continue;
  }
  verifiees += 1;
  const erreurs = validerPrise(prise);
  const info = await stat(chemin);
  const poids = poidsParSeconde(info.size, prise);
  if (poids !== null && poids > PLAFOND_OCTETS_PAR_SECONDE) {
    erreurs.push(
      `${Math.round(poids)} octets par seconde, plafond ${PLAFOND_OCTETS_PAR_SECONDE} : ` +
        "autre chose que des points (§7.11)",
    );
  }
  for (const raison of erreurs) refus.push(`${etiquette} — ${raison}`);
}

if (refus.length > 0) {
  await journaliser(base, { garde: NOM, evenement: "refus", prises: verifiees, refus });
  for (const raison of refus) process.stderr.write(`${raison}\n`);
  refuser(`${NOM} : ${refus.length} refus sur ${verifiees} prise(s) — aucune image, aucun poids hors plafond`);
}
await journaliser(base, { garde: NOM, evenement: "acceptation", prises: verifiees, sessions });
accepter(`${verifiees} prise(s) conforme(s), ${sessions} session(s) écartée(s) : des points, et rien d'autre`);
