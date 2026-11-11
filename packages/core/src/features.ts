/**
 * Mesures de la main (cahier §7.6) : u, v, pince, ouverture, vitesses,
 * présence. Deux canaux sortent du filtrage (§7.5) : le canal **lissé** pour
 * les réglages continus, le canal **vif** pour les déclenchements — une
 * attaque ne doit pas attendre le lissage.
 *
 * Deux conventions écrites une fois :
 *  - `palmScale` est une distance en coordonnées d'image brutes : `pinch` et
 *    `open` sont des RAPPORTS à cette échelle, donc déjà indépendants du
 *    rapport largeur/hauteur et de la distance à la caméra (§7.4). Les
 *    distances qui ne sont pas des rapports (`u`, `v`, vitesses) passent par
 *    `space.toPlayPosition`, qui corrige l'isotropie.
 *  - `OPEN_FIST` et `OPEN_FLAT` bornent la normalisation de l'ouverture. Ce
 *    sont des valeurs de départ, à régler sur des prises réelles (annexe D).
 */
import type { DetectedHand, Features, HandPoint, PlayRect, PointerKind, Settings } from "./types.js";
import { clamp01, toPlayPosition } from "./space.js";
import { makeDualChannel, type DualChannel } from "./filter.js";

/** Index des points du modèle (§7.3). */
export const POIGNET = 0;
export const POUCE_BOUT = 4;
export const INDEX_BASE = 5;
export const INDEX_BOUT = 8;
export const MAJEUR_BASE = 9;
export const MAJEUR_BOUT = 12;
export const ANNULAIRE_BASE = 13;
export const ANNULAIRE_BOUT = 16;
export const AURICULAIRE_BASE = 17;
export const AURICULAIRE_BOUT = 20;

/** Les cinq points dont la moyenne est le centre de la paume (§7.4). */
export const POINTS_PAUME = [POIGNET, INDEX_BASE, MAJEUR_BASE, ANNULAIRE_BASE, AURICULAIRE_BASE] as const;
/** Les quatre bouts de doigts qui mesurent l'ouverture (§7.6). */
export const BOUTS_DOIGTS = [INDEX_BOUT, MAJEUR_BOUT, ANNULAIRE_BOUT, AURICULAIRE_BOUT] as const;

/** Poing : les bouts reviennent près du poignet (1,5 échelle de paume). */
export const OPEN_FIST = 1.5;
/** Main à plat : les bouts sont loin du poignet (2,2 échelles de paume). */
export const OPEN_FLAT = 2.2;

const POINT_VIDE: HandPoint = [0, 0, 0];

/** Un point de la main, avec un repli sûr si la main est malformée. */
function pointDe(points: readonly HandPoint[], index: number): HandPoint {
  return points[index] ?? POINT_VIDE;
}

function distance(a: HandPoint, b: HandPoint): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Distance du poignet (0) à la base du majeur (9) : l'échelle `s` (§7.4). */
export function palmScale(points: readonly HandPoint[]): number {
  return distance(pointDe(points, POIGNET), pointDe(points, MAJEUR_BASE));
}

/** Centre de la paume : moyenne des points 0, 5, 9, 13 et 17 (§7.4). */
export function palmCenter(points: readonly HandPoint[]): HandPoint {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const index of POINTS_PAUME) {
    const p = pointDe(points, index);
    x += p[0];
    y += p[1];
    z += p[2];
  }
  const n = POINTS_PAUME.length;
  return [x / n, y / n, z / n];
}

/** Le point qui vise : bout de l'index (gestes fins) ou centre de la paume (gestes amples). */
export function pointerPoint(points: readonly HandPoint[], pointer: PointerKind): HandPoint {
  return pointer === "index" ? pointDe(points, INDEX_BOUT) : palmCenter(points);
}

/** Écart pouce-index divisé par `s` : 0 doigts joints, 1 et plus main ouverte. */
export function pinchValue(points: readonly HandPoint[]): number {
  const s = palmScale(points);
  if (s <= 0) return 0;
  return distance(pointDe(points, POUCE_BOUT), pointDe(points, INDEX_BOUT)) / s;
}

/**
 * Ouverture de la main, ramenée entre 0 (poing) et 1 (main à plat) : moyenne
 * des distances des quatre bouts au poignet, divisée par `s`, puis normalisée
 * entre `OPEN_FIST` et `OPEN_FLAT`.
 */
export function openValue(points: readonly HandPoint[]): number {
  const s = palmScale(points);
  if (s <= 0) return 0;
  const poignet = pointDe(points, POIGNET);
  let somme = 0;
  for (const bout of BOUTS_DOIGTS) somme += distance(pointDe(points, bout), poignet);
  const brut = somme / BOUTS_DOIGTS.length / s;
  return clamp01((brut - OPEN_FIST) / (OPEN_FLAT - OPEN_FIST));
}

/** Mesures brutes d'une main, avant filtrage. Les vitesses restent à zéro. */
export function rawFeatures(
  hand: DetectedHand,
  rect: PlayRect,
  aspect: number,
  pointer: PointerKind,
): Features {
  const points = hand.points;
  const vise = pointerPoint(points, pointer);
  const place = toPlayPosition(vise[0], vise[1], rect, aspect);
  return {
    u: place.u,
    v: place.v,
    pinch: pinchValue(points),
    open: openValue(points),
    speedU: 0,
    speedV: 0,
    present: true,
    edge: place.edge,
  };
}

/** Les quatre grandeurs continues suivies par le filtre, dans un ordre fixe. */
const GRANDEURS = ["u", "v", "pinch", "open"] as const;
type Grandeur = (typeof GRANDEURS)[number];

interface EtatMain {
  canaux: Record<Grandeur, DualChannel>;
  dernier: Features | null;
  dernierT: number | null;
  /** u et v du canal vif à l'image précédente : les vitesses en découlent. */
  vifPrecedent: { u: number; v: number } | null;
  vitesseU: number;
  vitesseV: number;
}

function etatNeuf(settings: Settings): EtatMain {
  const options = { fcMin: settings.fcMin, beta: settings.beta, fcD: settings.fcD };
  const canaux = {} as Record<Grandeur, DualChannel>;
  for (const g of GRANDEURS) canaux[g] = makeDualChannel(options, settings.fcTrigger);
  return { canaux, dernier: null, dernierT: null, vifPrecedent: null, vitesseU: 0, vitesseV: 0 };
}

/**
 * Suit une main : possède ses filtres, rend le canal lissé et le canal vif,
 * tient les dernières valeurs pendant le délai de grâce, puis déclare la main
 * absente (AIR-F-15).
 */
export class FeatureTracker {
  private etat: EtatMain;

  constructor(
    readonly rect: PlayRect,
    readonly aspect: number,
    readonly settings: Settings,
    readonly pointer: PointerKind,
  ) {
    this.etat = etatNeuf(settings);
  }

  /** `hand` = null si la main n'est pas vue sur cette image. */
  push(tSeconds: number, hand: DetectedHand | null): { readonly smooth: Features; readonly fast: Features } {
    const graceS = this.settings.graceMs / 1000;
    if (hand === null) return this.mainAbsente(tSeconds, graceS);
    const brut = rawFeatures(hand, this.rect, this.aspect, this.pointer);
    return this.filtrer(tSeconds, brut);
  }

  /** Main absente : valeurs tenues pendant le délai de grâce, puis absence. */
  private mainAbsente(tSeconds: number, graceS: number): { smooth: Features; fast: Features } {
    const dernier = this.etat.dernier;
    if (dernier === null) return { smooth: VIDE, fast: VIDE };
    const dansLaGrace = this.etat.dernierT !== null && tSeconds - this.etat.dernierT <= graceS;
    const tenu: Features = { ...dernier, present: dansLaGrace, speedU: 0, speedV: 0 };
    return { smooth: tenu, fast: tenu };
  }

  /** Filtrage des quatre grandeurs, sur les deux canaux, plus les vitesses. */
  private filtrer(tSeconds: number, brut: Features): { smooth: Features; fast: Features } {
    const precedent = this.etat.vifPrecedent;
    const pas = precedent === null || this.etat.dernierT === null ? 0 : tSeconds - this.etat.dernierT;
    const lisse = {} as Record<Grandeur, number>;
    const vif = {} as Record<Grandeur, number>;
    for (const g of GRANDEURS) {
      const canaux = this.etat.canaux[g];
      lisse[g] = canaux.smooth.filter(brut[g], tSeconds);
      vif[g] = canaux.fast.filter(brut[g], tSeconds);
    }
    // Les vitesses sont lues sur le canal VIF : c'est lui qui sert aux
    // déclenchements (§7.5), et une attaque ne doit pas attendre le lissage.
    if (pas > 0 && precedent !== null) {
      this.etat.vitesseU = (vif.u - precedent.u) / pas;
      this.etat.vitesseV = (vif.v - precedent.v) / pas;
    }
    this.etat.vifPrecedent = { u: vif.u, v: vif.v };
    this.etat.dernierT = tSeconds;
    const smooth: Features = { ...lisse, speedU: this.etat.vitesseU, speedV: this.etat.vitesseV, present: true, edge: brut.edge };
    this.etat.dernier = smooth;
    const fast: Features = { ...vif, speedU: this.etat.vitesseU, speedV: this.etat.vitesseV, present: true, edge: brut.edge };
    return { smooth, fast };
  }

  reset(): void {
    this.etat = etatNeuf(this.settings);
  }
}

const VIDE: Features = { u: 0, v: 0, pinch: 0, open: 0, speedU: 0, speedV: 0, present: false, edge: false };
