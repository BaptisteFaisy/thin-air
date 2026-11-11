#!/usr/bin/env -S tsx
/**
 * Le réglage du filtre sur des prises RÉELLES (lot N7, cahier §7.5, annexe D).
 *
 *   npx tsx apps/bench/src/tuning.ts --take takes/real/tremor-<machine>-<date>.json [--json]
 *
 * Sur une prise `tremor` (main immobile puis mouvement lent), l'outil mesure,
 * pour chaque couple (fcMin, β) d'une grille déterministe :
 *   - le tremblement résidu : écart moyen du canal lissé à sa moyenne pendant
 *     les images immobiles — la cible vient du cahier §5.3 : 0,5 % de la
 *     largeur de zone au-delà, la note bouge d'un cinquième de demi-ton ;
 *   - la traîne du geste : écart moyen canal lissé ↔ position brute pendant
 *     les images en mouvement.
 * Le couple recommandé est celui qui respecte la cible de tremblement avec la
 * plus petite traîne. Aucune caméra, aucun son : une prise lue, des nombres.
 *
 * Ce que l'outil ne fait PAS : il ne prouve rien sur une prise synthétique
 * (le tremblement y est une formule) ; il sert à régler `fcMin`, `beta`,
 * `fcD` (§7.13) sur une vraie main — le point « valeurs du filtre » de
 * l'annexe D.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { palmCenter, type Take } from "@thin-air/core";
import { OneEuroFilter, defaultFilterOptions } from "@thin-air/core";
import { readTakeFile } from "./load.js";
import { fixed } from "./format.js";

/** Grille explorée : autour des valeurs de départ du cahier §7.5. */
export const GRILLE_FC_MIN: readonly number[] = [1, 1.5, 2, 3];
export const GRILLE_BETA: readonly number[] = [2, 5, 8, 12];

/** Cible de tremblement résiduel : 0,5 % de la largeur (§5.3). */
export const CIBLE_TREMBLEMENT = 0.005;

/** Fenêtre et seuil de déplacement net : le tremblement oscille sans se déplacer. */
export const FENETRE_S = 1;
export const DEPLACEMENT_NET = 0.03;

export interface Echantillon {
  readonly t: number;
  readonly x: number;
  readonly y: number;
}

/** La trajectoire du centre de la paume (§7.4), première main de chaque image. */
export function trajectoirePaume(take: Take): readonly Echantillon[] {
  const points: Echantillon[] = [];
  for (const image of take.frames) {
    const main = image.hands[0];
    if (main === undefined) continue;
    const paume = palmCenter(main.points);
    points.push({ t: image.t, x: paume[0], y: paume[1] });
  }
  return points;
}

/**
 * Marque chaque échantillon : immobile ou en mouvement. Le critère est le
 * DÉPLACEMENT NET sur une fenêtre d'une seconde : un tremblement (même vif)
 * oscille autour d'un point et reste « immobile », une translation lente ne
 * l'est pas. La première seconde d'un mouvement reste classée immobile :
 * c'est assumé, le réglage se lit sur le reste.
 */
export function segmenter(points: readonly Echantillon[]): readonly boolean[] {
  return points.map((point, index) => {
    let precedent = index - 1;
    while (precedent >= 0 && (points[precedent] as Echantillon).t > point.t - FENETRE_S) precedent -= 1;
    if (precedent < 0) return false;
    const avant = points[precedent] as Echantillon;
    return Math.hypot(point.x - avant.x, point.y - avant.y) >= DEPLACEMENT_NET;
  });
}

export interface ResultatReglage {
  readonly fcMin: number;
  readonly beta: number;
  /** Écart moyen du lissé à sa moyenne, images immobiles (unités d'image). */
  readonly tremblement: number;
  /** Écart moyen lissé ↔ brut, images en mouvement. */
  readonly traine: number;
}

/** Filtre la trajectoire avec un couple (fcMin, β) et mesure les deux écarts. */
export function evaluerReglage(points: readonly Echantillon[], enMouvement: readonly boolean[], fcMin: number, beta: number): ResultatReglage {
  const options = { ...defaultFilterOptions(), fcMin, beta };
  const filtreX = new OneEuroFilter(options);
  const filtreY = new OneEuroFilter(options);
  let ecartImmobile = 0;
  let nImmobile = 0;
  let ecartMouvement = 0;
  let nMouvement = 0;
  const lisses: { x: number; y: number }[] = [];
  points.forEach((point, index) => {
    const lisse = { x: filtreX.filter(point.x, point.t), y: filtreY.filter(point.y, point.t) };
    lisses.push(lisse);
    if (enMouvement[index] === true) {
      ecartMouvement += Math.hypot(lisse.x - point.x, lisse.y - point.y);
      nMouvement += 1;
    }
  });
  // Tremblement résiduel : écart à la moyenne du lissé, sur les images immobiles.
  const immobiles = lisses.filter((_, index) => enMouvement[index] !== true);
  if (immobiles.length > 0) {
    const moyenneX = immobiles.reduce((somme, p) => somme + p.x, 0) / immobiles.length;
    const moyenneY = immobiles.reduce((somme, p) => somme + p.y, 0) / immobiles.length;
    for (const p of immobiles) ecartImmobile += Math.hypot(p.x - moyenneX, p.y - moyenneY);
    nImmobile = immobiles.length;
  }
  return {
    fcMin,
    beta,
    tremblement: nImmobile > 0 ? ecartImmobile / nImmobile : 0,
    traine: nMouvement > 0 ? ecartMouvement / nMouvement : 0,
  };
}

/** La grille entière, dans un ordre déterministe (AIR-N-09). */
export function explorerGrille(points: readonly Echantillon[], enMouvement: readonly boolean[]): readonly ResultatReglage[] {
  const resultats: ResultatReglage[] = [];
  for (const fcMin of GRILLE_FC_MIN) {
    for (const beta of GRILLE_BETA) resultats.push(evaluerReglage(points, enMouvement, fcMin, beta));
  }
  return resultats;
}

/** Recommandation : la plus petite traîne parmi les couples sous la cible. */
export function recommander(resultats: readonly ResultatReglage[]): ResultatReglage {
  const conformes = resultats.filter((r) => r.tremblement <= CIBLE_TREMBLEMENT);
  if (conformes.length > 0) {
    return conformes.reduce((meilleur, r) => (r.traine < meilleur.traine ? r : meilleur), conformes[0] as ResultatReglage);
  }
  return resultats.reduce(
    (meilleur, r) => (r.tremblement < meilleur.tremblement ? r : meilleur),
    resultats[0] as ResultatReglage,
  );
}

interface Options {
  readonly take: string;
  readonly json: boolean;
}

function lireOptions(argv: readonly string[]): Options {
  let take = "";
  let json = false;
  for (let i = 0; i < argv.length; i += 1) {
    const jeton = argv[i];
    if (jeton === "--take") take = argv[++i] ?? "";
    else if (jeton === "--json") json = true;
    else if (jeton === "--help" || jeton === "-h") {
      process.stdout.write("usage : tuning --take <prise.json> [--json]\n");
      process.exit(0);
    } else throw new Error(`argument inconnu : ${jeton}`);
  }
  if (take === "") throw new Error("--take attend un fichier de prise");
  return { take, json };
}

async function principal(): Promise<number> {
  const options = lireOptions(process.argv.slice(2));
  const take = await readTakeFile(options.take);
  const points = trajectoirePaume(take);
  if (points.length < 10) throw new Error(`prise trop courte : ${points.length} échantillons de paume`);
  const enMouvement = segmenter(points);
  const resultats = explorerGrille(points, enMouvement);
  const choix = recommander(resultats);
  const defaut = defaultFilterOptions();
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ take: options.take, resultats, recommande: choix }, null, 2)}\n`);
    return 0;
  }
  process.stdout.write(`prise : ${options.take} — ${points.length} échantillons, `);
  process.stdout.write(`${enMouvement.filter(Boolean).length} en mouvement\n`);
  process.stdout.write(`fcMin  beta   tremblement   traîne\n`);
  for (const r of resultats) {
    process.stdout.write(`${fixed(r.fcMin, 1).padStart(5)}  ${String(r.beta).padStart(4)}   ${fixed(r.tremblement, 5).padStart(11)}   ${fixed(r.traine, 5)}\n`);
  }
  process.stdout.write(
    `\ncible de tremblement (§5.3) : ${CIBLE_TREMBLEMENT}\n` +
      `valeurs de départ (§7.5)    : fcMin ${defaut.fcMin}, β ${defaut.beta}\n` +
      `RECOMMANDÉ                  : fcMin ${choix.fcMin}, β ${choix.beta} ` +
      `(tremblement ${fixed(choix.tremblement, 5)}, traîne ${fixed(choix.traine, 5)})\n`,
  );
  return 0;
}

/** Lancé seulement en point d'entrée : le test importe les fonctions pures. */
const estPointEntree =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (estPointEntree) {
  try {
    process.exit(await principal());
  } catch (erreur) {
    process.stderr.write(`échec : ${erreur instanceof Error ? erreur.message : String(erreur)}\n`);
    process.exit(2);
  }
}
