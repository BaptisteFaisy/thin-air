/**
 * Repère de jeu et calibration (cahier §7.4).
 * Propriétés : AIR-P-01 (u,v bornés, u monotone), AIR-P-22 (calibration).
 *
 * Conventions, écrites une fois pour toutes :
 *  - les coordonnées d'image brutes sont normalisées : x de 0 à 1 vers la
 *    droite de l'IMAGE, y de 0 à 1 vers le BAS ;
 *  - l'affichage est en miroir (AIR-F-05) : `mirrorX` retourne l'abscisse, donc
 *    bouger la main vers la droite de l'ÉCRAN déplace son repère vers la
 *    droite ;
 *  - dans la zone de jeu, `u` croît de gauche à droite et `v` de bas en haut ;
 *  - `u` et `v` sont des fractions du rectangle : ils sont donc indépendants
 *    du rapport largeur/hauteur. La correction d'isotropie (`aspect`) porte sur
 *    les DISTANCES entre deux points d'image, pas sur ces fractions — c'est
 *    `isotropicDistance` qui l'applique, et `features` qui s'en sert.
 */
import type { PlayRect } from "./types.js";
import { defaultPlayRect } from "./defaults.js";

/** Borne une valeur dans [0, 1] et remplace tout non-fini par 0. */
export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Miroir : l'abscisse est retournée (AIR-F-05). */
export function mirrorX(x: number): number {
  return clamp01(1 - x);
}

/** Récupère un pointeur ou lève une erreur lisible — `noUncheckedIndexedAccess`. */
function at(table: readonly number[], index: number): number {
  const valeur = table[index];
  if (valeur === undefined) {
    throw new RangeError(`index ${index} hors de la table (longueur ${table.length})`);
  }
  return valeur;
}

export interface PlayPosition {
  readonly u: number;
  readonly v: number;
  readonly edge: boolean;
}

/**
 * Position d'un point d'image dans la zone de jeu. Hors du rectangle, les
 * valeurs sont bornées et l'indicateur « bord » s'allume (§7.4).
 *
 * `aspect` (largeur / hauteur de l'image) ne change pas les fractions u et v :
 * il est accepté ici pour que toute la chaîne de calcul partage un seul appel,
 * et il sert aux distances via `isotropicDistance`.
 */
export function toPlayPosition(
  x: number,
  y: number,
  rect: PlayRect,
  aspect: number,
): PlayPosition {
  void aspect;
  const ecranX = mirrorX(x);
  const ecranY = clamp01(1 - y);
  const spanU = rect.u1 - rect.u0;
  const spanV = rect.v1 - rect.v0;
  const u = spanU > 0 ? clamp01((ecranX - rect.u0) / spanU) : 0;
  const v = spanV > 0 ? clamp01((ecranY - rect.v0) / spanV) : 0;
  // Un rectangle dégénéré (épaisseur nulle) met tout le monde au bord.
  const edge =
    spanU <= 0 || spanV <= 0 ||
    ecranX < rect.u0 || ecranX > rect.u1 || ecranY < rect.v0 || ecranY > rect.v1;
  return { u, v, edge };
}

/**
 * Facteurs d'isotropie : multiplie les écarts en x et en y pour que les
 * distances soient comparables dans un monde physique, et non dans une image
 * dont les pixels ne sont pas carrés (§7.4).
 */
export function isotropicFactors(aspect: number): { readonly kx: number; readonly ky: number } {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  return a >= 1 ? { kx: a, ky: 1 } : { kx: 1, ky: 1 / a };
}

/** Distance corrigée du rapport largeur/hauteur, entre deux points d'image. */
export function isotropicDistance(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  aspect: number,
): number {
  const { kx, ky } = isotropicFactors(aspect);
  const dx = (bx - ax) * kx;
  const dy = (by - ay) * ky;
  return Math.hypot(dx, dy);
}

export interface CalibrationSample {
  readonly u: number;
  readonly v: number;
}

export interface CalibrationOptions {
  /** Du 5ᵉ au 95ᵉ centile, élargi de 5 % (§7.4). */
  readonly lowPercentile?: number;
  readonly highPercentile?: number;
  readonly expand?: number;
  /** En dessous de cette fraction de l'image, la zone est jugée trop petite. */
  readonly minSpan?: number;
  /**
   * Horodatage de la calibration. `core` ne lit jamais l'horloge (AIR-N-09) :
   * c'est l'appelant — la page — qui donne l'instant. À défaut, 0.
   */
  readonly calibratedAt?: number;
}

const OPTIONS_DEFAUT = {
  lowPercentile: 5,
  highPercentile: 95,
  expand: 0.05,
  minSpan: 0.2,
  calibratedAt: 0,
} as const;

/** Centile par interpolation linéaire, sur une table déjà triée. */
function percentile(sorted: readonly number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return at(sorted, 0);
  const rank = (Math.min(100, Math.max(0, p)) / 100) * (n - 1);
  const bas = Math.floor(rank);
  const haut = Math.min(n - 1, bas + 1);
  const poids = rank - bas;
  return at(sorted, bas) * (1 - poids) + at(sorted, haut) * poids;
}

function trier(valeurs: readonly number[]): number[] {
  return [...valeurs].sort((a, b) => a - b);
}

/**
 * Rectangle de jeu déduit d'un relevé de portée (AIR-F-09).
 * Rend `null` si le relevé couvre moins de `minSpan` de l'image sur un axe :
 * l'écran propose alors de recommencer ou de garder la zone par défaut.
 */
export function calibratePlayRect(
  samples: readonly CalibrationSample[],
  options?: CalibrationOptions,
): PlayRect | null {
  const opts = { ...OPTIONS_DEFAUT, ...(options ?? {}) };
  if (samples.length === 0) return null;
  const points = samples.map((s) => ({ u: clamp01(s.u), v: clamp01(s.v) }));
  const us = trier(points.map((p) => p.u));
  const vs = trier(points.map((p) => p.v));
  return etendre(points, us, vs, opts);
}

interface ResolvedOptions {
  readonly lowPercentile: number;
  readonly highPercentile: number;
  readonly expand: number;
  readonly minSpan: number;
  readonly calibratedAt: number;
}

function etendre(
  points: readonly CalibrationSample[],
  us: readonly number[],
  vs: readonly number[],
  opts: ResolvedOptions,
): PlayRect | null {
  const uBrut = [percentile(us, opts.lowPercentile), percentile(us, opts.highPercentile)] as const;
  const vBrut = [percentile(vs, opts.lowPercentile), percentile(vs, opts.highPercentile)] as const;
  let u = elargir(uBrut[0], uBrut[1], opts.expand);
  let v = elargir(vBrut[0], vBrut[1], opts.expand);
  if (u[1] - u[0] < opts.minSpan || v[1] - v[0] < opts.minSpan) return null;
  // AIR-P-22 exige au moins 90 % du nuage dans le rectangle. Les centiles
  // seuls ne le garantissent pas sur un petit relevé très regroupé : on élargit
  // donc symétriquement, par pas de 5 % de l'image, jusqu'à tenir la promesse
  // (ou jusqu'aux bords de l'image). Élargir ne peut pas réduire la couverture
  // ni passer sous la taille minimale.
  for (let pas = 0; pas < 20 && couverture(points, u, v) < 0.9; pas += 1) {
    u = [clamp01(u[0] - 0.05), clamp01(u[1] + 0.05)] as const;
    v = [clamp01(v[0] - 0.05), clamp01(v[1] + 0.05)] as const;
  }
  return { u0: u[0], u1: u[1], v0: v[0], v1: v[1], calibratedAt: opts.calibratedAt };
}

/**
 * Part du relevé qui tombe dans le rectangle candidat. Les couples (u, v) sont
 * conservés : trier chaque axe séparément détruirait l'appariement.
 */
function couverture(
  points: readonly CalibrationSample[],
  u: readonly [number, number],
  v: readonly [number, number],
): number {
  if (points.length === 0) return 1;
  let dedans = 0;
  for (const p of points) {
    if (p.u >= u[0] && p.u <= u[1] && p.v >= v[0] && p.v <= v[1]) dedans += 1;
  }
  return dedans / points.length;
}

/** Élargit un intervalle de `expand` fois sa largeur, de chaque côté, dans [0,1]. */
function elargir(low: number, high: number, expand: number): readonly [number, number] {
  const span = high - low;
  const marge = span * expand;
  return [clamp01(low - marge), clamp01(high + marge)];
}

/** Position relative dans un axe de corde ou de zone (0 = première, 1 = dernière). */
export function axisValue(position: PlayPosition, axis: "u" | "v"): number {
  return axis === "u" ? position.u : position.v;
}

/** La zone par défaut, relue depuis `defaults.ts` : une seule définition. */
export function fallbackPlayRect(): PlayRect {
  return defaultPlayRect();
}
