/**
 * Réglage du filtre « One Euro » par la mesure (cahier §7.5, annexe D).
 *
 * Pour une prise et une grille de réglages, on mesure trois nombres — jamais
 * un son (AIR-N-02), jamais une horloge : tout le temps vient des horodatages
 * de la prise, donc une même prise donne toujours les mêmes nombres au bit près
 * (AIR-N-09) :
 *   - la gigue résiduelle : écart-type du `u` lissé quand la main tremble ;
 *   - la traîne : retard en millisecondes du canal lissé sur le signal brut en
 *     mouvement constant ;
 *   - la réactivité du canal vif : retard du canal vif sur une attaque, qui
 *     doit rester faible — une attaque n'attend pas le lissage (§7.5).
 *
 * Tout le filtrage vient de `@thin-air/core` (`FeatureTracker`, `rawFeatures`) :
 * aucune formule du cahier n'est réécrite ici.
 *
 * Deux outils de réglage coexistent, et ils ne mesurent pas la même chose :
 * celui-ci (lot W7) balaye une grille de combinaisons sur des prises figées et
 * commande `bench tune` ; `./tuning.ts` (lot N7) règle `fcMin`/`beta` sur une
 * prise `tremor` RÉELLE, en ligne de commande propre. Aucun des deux ne remplace
 * l'autre : les prises synthétiques ne prouvent rien sur une vraie main.
 */
import { basename } from "node:path";
import type { DetectedHand, PointerKind, Take } from "@thin-air/core";
import { DEFAULT_SETTINGS, FeatureTracker, defaultPlayRect, rawFeatures, withSettings } from "@thin-air/core";

import type { ParsedArgs } from "./args.js";
import { optionalValue, parseArgs, wantsHelp } from "./args.js";
import type { Writers } from "./commands.js";
import { PROCESS_WRITERS } from "./commands.js";
import { BenchError } from "./errors.js";
import { fixed, pad } from "./format.js";
import { readTakeFile } from "./load.js";

/** Une combinaison de réglages du filtre (§7.5). `fcD` reste au défaut (1 Hz). */
export interface TuningCombo {
  readonly fcMin: number;
  readonly beta: number;
  readonly fcTrigger: number;
}

/** Une combinaison mesurée : les trois nombres, toujours dans cet ordre. */
export interface TuningRow extends TuningCombo {
  /** Écart-type du `u` lissé pendant le tremblement, en largeurs de zone. */
  readonly gigue: number;
  /** Retard du canal lissé sur le mouvement constant, en ms. */
  readonly traine: number;
  /** Retard du canal vif sur l'attaque, en ms. */
  readonly vif: number;
}

/** La grille à balayer (cahier §7.5, annexe D) : petite pour rester sous 60 s. */
export const TUNING_GRID: {
  readonly fcMin: readonly number[];
  readonly beta: readonly number[];
  readonly fcTrigger: readonly number[];
} = {
  fcMin: [0.8, 1.5, 2.5],
  beta: [2, 5, 10],
  fcTrigger: [4, 6, 10],
};

/** Les valeurs de départ du cahier §7.5, lues dans `defaults.ts`. */
export const CAHIER_COMBO: TuningCombo = {
  fcMin: DEFAULT_SETTINGS.fcMin,
  beta: DEFAULT_SETTINGS.beta,
  fcTrigger: DEFAULT_SETTINGS.fcTrigger,
};

/**
 * La combinaison retenue, verrouillée par `tuning.test.ts` et argumentée dans
 * `docs/filter-tuning.md` : on garde les valeurs de départ du cahier.
 */
export const COMBO_RECOMMANDEE: TuningCombo = CAHIER_COMBO;

/** Les trois prises de référence qui définissent les trois nombres. */
export const CHEMINS_TAKES = {
  gigue: "takes/reference/tremor-at-boundary.json",
  traine: "takes/reference/slow-rise.json",
  vif: "takes/reference/fast-jab.json",
} as const;

/** Un signal brut, lissé et vif d'une même main, échantillonné aux images. */
export interface SignalU {
  readonly t: readonly number[];
  readonly brut: readonly number[];
  readonly lisse: readonly number[];
  readonly vif: readonly number[];
}

/** Les trois prises qui nourrissent une mesure complète. */
export interface TuningSources {
  readonly gigue: Take;
  readonly traine: Take;
  readonly vif: Take;
}

/**
 * Le pointeur suivi : la paume, comme l'instrument Phantom des prises
 * `tremor-at-boundary` et `slow-rise`. Un décalage constant dû au pointeur
 * n'influe ni sur l'écart-type ni sur le retard (les deux signaux le partagent).
 */
const POINTER: PointerKind = "palm";
/** Format de l'image de repli pour le suivi de la main (cahier §7.4, défaut). */
const ASPECT = 4 / 3;

/** Chauffage du filtre : on écarte le premier tiers, plafonné à une seconde. */
const ECHAUFFE_S = 1;
/** Portée du balayage de retard, en ms, pour la traîne et le canal vif. */
const MAX_MS_LISSE = 400;
const MAX_MS_VIF = 200;
/** Pas du balayage de retard, en ms : la précision des mesures. */
const PAS_MS = 0.25;

/** La main suivie d'une image : la droite, sinon la première vue. */
function mainSuivie(mains: readonly DetectedHand[]): DetectedHand | null {
  return mains.find((m) => m.side === "right") ?? mains[0] ?? null;
}

/** Le flux `u` brut, lissé et vif d'une prise, pour des réglages donnés. */
export function signalU(take: Take, combo: TuningCombo): SignalU {
  const rect = defaultPlayRect();
  const reglages = withSettings({ fcMin: combo.fcMin, beta: combo.beta, fcTrigger: combo.fcTrigger });
  const suiveur = new FeatureTracker(rect, ASPECT, reglages, POINTER);
  const t: number[] = [];
  const brut: number[] = [];
  const lisse: number[] = [];
  const vif: number[] = [];
  for (const frame of take.frames) {
    const main = mainSuivie(frame.hands);
    if (main === null) continue;
    const resultat = suiveur.push(frame.t, main);
    t.push(frame.t);
    brut.push(rawFeatures(main, rect, ASPECT, POINTER).u);
    lisse.push(resultat.smooth.u);
    vif.push(resultat.fast.u);
  }
  return { t, brut, lisse, vif };
}

/** Indices des échantillons retenus pour une mesure, une fois le filtre chaud. */
export function indicesMesure(signal: SignalU): readonly number[] {
  const premier = signal.t[0];
  const dernier = signal.t[signal.t.length - 1];
  if (premier === undefined || dernier === undefined) return [];
  const seuil = premier + Math.min(ECHAUFFE_S, (dernier - premier) / 3);
  const indices: number[] = [];
  for (let i = 0; i < signal.t.length; i += 1) {
    const t = signal.t[i];
    if (t !== undefined && t >= seuil) indices.push(i);
  }
  return indices;
}

/** Écart-type, en population : déterministe, sans horloge ni hasard. */
export function ecartType(valeurs: readonly number[]): number {
  const n = valeurs.length;
  if (n === 0) return 0;
  const moyenne = valeurs.reduce((somme, v) => somme + v, 0) / n;
  const carres = valeurs.reduce((somme, v) => somme + (v - moyenne) * (v - moyenne), 0);
  return Math.sqrt(carres / n);
}

/** Gigue résiduelle : écart-type du `u` lissé, hors chauffage. */
export function gigueResiduelle(signal: SignalU): number {
  const indices = indicesMesure(signal);
  if (indices.length < 2) return 0;
  return ecartType(indices.map((i) => signal.lisse[i] ?? 0));
}

/** Valeur de `x` à un instant quelconque, par interpolation linéaire. */
function interpoler(t: readonly number[], x: readonly number[], cible: number): number {
  const premier = t[0];
  const dernier = t[t.length - 1];
  if (premier === undefined || dernier === undefined) return x[0] ?? 0;
  if (cible <= premier) return x[0] ?? 0;
  if (cible >= dernier) return x[x.length - 1] ?? 0;
  let bas = 0;
  let haut = t.length - 1;
  while (haut - bas > 1) {
    const milieu = (bas + haut) >> 1;
    if (t[milieu]! <= cible) bas = milieu;
    else haut = milieu;
  }
  const tBas = t[bas]!;
  const tHaut = t[haut]!;
  const xBas = x[bas] ?? 0;
  const xHaut = x[haut] ?? 0;
  if (tHaut === tBas) return xBas;
  return xBas + ((cible - tBas) / (tHaut - tBas)) * (xHaut - xBas);
}

export interface RetardOptions {
  /** Instant où commencent les échantillons comptés, en secondes. */
  readonly debutS?: number;
  /** Portée maximale du retard, en ms. */
  readonly maxMs?: number;
  /** Pas du balayage, en ms. */
  readonly pasMs?: number;
}

/**
 * Retard du signal `suivi` sur le signal `reference`, en ms : le décalage qui
 * minimise l'écart quadratique, sur une grille de pas `pasMs`.
 */
export function retardMs(
  t: readonly number[],
  reference: readonly number[],
  suivi: readonly number[],
  options: RetardOptions = {},
): number {
  const maxMs = options.maxMs ?? MAX_MS_LISSE;
  const pasMs = options.pasMs ?? PAS_MS;
  const debutS = options.debutS ?? (t[0] ?? 0);
  let meilleur = 0;
  let meilleureSomme = Number.POSITIVE_INFINITY;
  for (let delta = 0; delta <= maxMs; delta += pasMs) {
    let somme = 0;
    for (let i = 0; i < t.length; i += 1) {
      const ti = t[i];
      const si = suivi[i];
      if (ti === undefined || si === undefined || ti < debutS) continue;
      const r = interpoler(t, reference, ti - delta / 1000);
      const ecart = r - si;
      somme += ecart * ecart;
    }
    if (somme < meilleureSomme) {
      meilleureSomme = somme;
      meilleur = delta;
    }
  }
  return meilleur;
}

/** Traîne du canal lissé : retard sur le brut, en mouvement constant. */
export function traineMs(signal: SignalU): number {
  const premier = signal.t[0] ?? 0;
  const dernier = signal.t[signal.t.length - 1] ?? premier;
  const debutS = premier + Math.min(ECHAUFFE_S, (dernier - premier) / 3);
  return retardMs(signal.t, signal.brut, signal.lisse, { debutS, maxMs: MAX_MS_LISSE });
}

/** Réactivité du canal vif : retard sur le brut, dès la première image. */
export function vifMs(signal: SignalU): number {
  return retardMs(signal.t, signal.brut, signal.vif, { maxMs: MAX_MS_VIF });
}

/** Une combinaison mesurée sur les trois prises. */
export function mesurerCombo(combo: TuningCombo, sources: TuningSources): TuningRow {
  return {
    ...combo,
    gigue: gigueResiduelle(signalU(sources.gigue, combo)),
    traine: traineMs(signalU(sources.traine, combo)),
    vif: vifMs(signalU(sources.vif, combo)),
  };
}

/** La grille entière, dans l'ordre fcMin, beta, fcTrigger. */
export function balayer(sources: TuningSources): readonly TuningRow[] {
  const lignes: TuningRow[] = [];
  for (const fcMin of TUNING_GRID.fcMin) {
    for (const beta of TUNING_GRID.beta) {
      for (const fcTrigger of TUNING_GRID.fcTrigger) {
        lignes.push(mesurerCombo({ fcMin, beta, fcTrigger }, sources));
      }
    }
  }
  return lignes;
}

/** La meilleure combinaison par critère (le plus petit nombre gagne). */
export function meilleures(lignes: readonly TuningRow[]): {
  readonly gigue: TuningRow;
  readonly traine: TuningRow;
  readonly vif: TuningRow;
} {
  const premiere = lignes[0];
  if (premiere === undefined) throw new BenchError("aucune combinaison mesurée");
  let gigue = premiere;
  let traine = premiere;
  let vif = premiere;
  for (const ligne of lignes.slice(1)) {
    if (ligne.gigue < gigue.gigue) gigue = ligne;
    if (ligne.traine < traine.traine) traine = ligne;
    if (ligne.vif < vif.vif) vif = ligne;
  }
  return { gigue, traine, vif };
}

/** La ligne d'une combinaison précise, ou une erreur si elle sort de la grille. */
export function rowPour(lignes: readonly TuningRow[], combo: TuningCombo): TuningRow {
  const trouve = lignes.find(
    (l) => l.fcMin === combo.fcMin && l.beta === combo.beta && l.fcTrigger === combo.fcTrigger,
  );
  if (trouve === undefined) {
    throw new BenchError(`combinaison absente de la grille : fcMin=${combo.fcMin}, beta=${combo.beta}, fcTrigger=${combo.fcTrigger}`);
  }
  return trouve;
}

function colonne(texte: string, largeur: number): string {
  return pad(texte, largeur);
}

/** Le tableau humain, trié dans l'ordre de la grille. */
export function formatTableau(lignes: readonly TuningRow[]): string {
  const entete = ["fcMin", "beta", "fcTrigger", "gigue (u)", "traîne (ms)", "vif (ms)"];
  const largeurs = [7, 7, 11, 15, 14, 10];
  const haut = entete.map((titre, i) => colonne(titre, largeurs[i] ?? 0)).join("");
  const corps = lignes.map((l) =>
    colonne(fixed(l.fcMin, 1), largeurs[0] ?? 0) +
    colonne(String(l.beta), largeurs[1] ?? 0) +
    colonne(String(l.fcTrigger), largeurs[2] ?? 0) +
    colonne(fixed(l.gigue, 6), largeurs[3] ?? 0) +
    colonne(fixed(l.traine, 2), largeurs[4] ?? 0) +
    colonne(fixed(l.vif, 2), largeurs[5] ?? 0),
  );
  return [haut, ...corps].join("\n");
}

function decrit(combo: TuningCombo): string {
  return `fcMin=${fixed(combo.fcMin, 1)} beta=${combo.beta} fcTrigger=${combo.fcTrigger}`;
}

/** Le bilan : les trois meilleures combinaisons et la valeur du cahier. */
export function formatBilan(
  gagnantes: ReturnType<typeof meilleures>,
  cahier: TuningRow,
): string {
  return [
    `meilleure gigue : ${decrit(gagnantes.gigue)} → ${fixed(gagnantes.gigue.gigue, 6)} u`,
    `meilleure traîne : ${decrit(gagnantes.traine)} → ${fixed(gagnantes.traine.traine, 2)} ms`,
    `meilleur canal vif : ${decrit(gagnantes.vif)} → ${fixed(gagnantes.vif.vif, 2)} ms`,
    `cahier §7.5 (${decrit(CAHIER_COMBO)}) → gigue ${fixed(cahier.gigue, 6)} u · traîne ${fixed(cahier.traine, 2)} ms · vif ${fixed(cahier.vif, 2)} ms`,
  ].join("\n");
}

const SPEC_TUNE = {
  command: "bench tune",
  values: ["take"],
  flags: ["json", "quiet"],
} as const;

const AIDE_TUNE = [
  "bench tune — réglage du filtre One Euro par la mesure (cahier §7.5)",
  "",
  "  bench tune [--take <prise>] [options]",
  "",
  "  --take <prise>   prise JSON à mesurer pour les trois nombres",
  "                   (défaut : les trois prises de référence §13.3)",
  "  --json           sortir la grille brute, en JSON",
  "  --quiet          n'imprimer que le bilan",
  "  --help           cette aide",
].join("\n");

interface SourcesChargees {
  readonly source: TuningSources;
  readonly libelles: { readonly gigue: string; readonly traine: string; readonly vif: string };
}

async function sourcesDe(args: ParsedArgs): Promise<SourcesChargees> {
  const chemin = optionalValue(args, "take");
  if (chemin !== undefined) {
    const take = await readTakeFile(chemin);
    if (take.frames.length < 3) throw new BenchError(`prise trop courte pour régler : ${chemin}`);
    const libelle = basename(chemin);
    return { source: { gigue: take, traine: take, vif: take }, libelles: { gigue: libelle, traine: libelle, vif: libelle } };
  }
  const [gigue, traine, vif] = await Promise.all([
    readTakeFile(CHEMINS_TAKES.gigue),
    readTakeFile(CHEMINS_TAKES.traine),
    readTakeFile(CHEMINS_TAKES.vif),
  ]);
  return {
    source: { gigue, traine, vif },
    libelles: {
      gigue: basename(CHEMINS_TAKES.gigue),
      traine: basename(CHEMINS_TAKES.traine),
      vif: basename(CHEMINS_TAKES.vif),
    },
  };
}

/**
 * `bench tune` : balaie la grille, imprime le tableau et le bilan. Rien n'est
 * joué, aucune horloge n'est lue : la sortie est reproductible (AIR-N-09).
 */
export async function runTune(argv: readonly string[], writers: Writers = PROCESS_WRITERS): Promise<number> {
  const args = parseArgs(argv, SPEC_TUNE);
  if (wantsHelp(args)) {
    writers.out(AIDE_TUNE);
    return 0;
  }
  const { source, libelles } = await sourcesDe(args);
  const lignes = balayer(source);
  const gagnantes = meilleures(lignes);
  const cahier = rowPour(lignes, CAHIER_COMBO);
  if (args.flags.has("json")) {
    writers.out(JSON.stringify({ libelles, lignes, meilleures: gagnantes, cahier }, null, 2));
    return 0;
  }
  const enTete = [
    "bench tune — réglage du filtre One Euro par la mesure (cahier §7.5)",
    `main suivie : droite (pointeur paume) · fc_d = 1 Hz (défaut §7.13)`,
    `gigue ← ${libelles.gigue} · traîne ← ${libelles.traine} · canal vif ← ${libelles.vif}`,
  ].join("\n");
  if (args.flags.has("quiet")) {
    writers.out(formatBilan(gagnantes, cahier));
    return 0;
  }
  writers.out(`${enTete}`);
  writers.out(formatTableau(lignes));
  writers.out("");
  writers.out(formatBilan(gagnantes, cahier));
  return 0;
}